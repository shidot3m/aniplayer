//! EBML reading: the variable-length integers every Matroska element is built
//! from, plus a buffered cursor over a file on disk.
//!
//! Element identifiers keep their length marker bit, data sizes drop it. The
//! distinction is where a hand-rolled EBML reader goes wrong, so the decoders
//! stay pure functions over byte slices.

use std::fs::File;
use std::io::{self, Read, Seek, SeekFrom};

const BUFFER_BYTES: usize = 1 << 20;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DataSize {
    /// A concrete payload length.
    Known(u64),
    /// The all-ones size Matroska uses for the Segment: the element runs to the
    /// end of its parent.
    Unbounded,
}

/// Number of bytes an EBML integer spans, read from its length descriptor.
fn marker_len(first: u8) -> usize {
    for index in 0..8 {
        if first & (0x80 >> index) != 0 {
            return index + 1;
        }
    }
    8
}

/// Value bits held by the first byte of an n-byte EBML integer: the marker and
/// its leading zeros are not part of the number. An eight-byte integer carries
/// none of its value in the first byte.
fn first_byte_mask(len: usize) -> u8 {
    if len >= 8 {
        0
    } else {
        0xFFu8 >> len
    }
}

fn read_bits(bytes: &[u8]) -> u64 {
    bytes
        .iter()
        .fold(0u64, |acc, byte| (acc << 8) | u64::from(*byte))
}

/// Reads an element identifier, marker bit included.
pub fn read_element_id(bytes: &[u8]) -> Option<(u32, usize)> {
    let first = *bytes.first()?;
    let len = marker_len(first);
    if bytes.len() < len || len > 4 {
        return None;
    }
    Some((read_bits(&bytes[..len]) as u32, len))
}

/// Reads an element data size, marker bit dropped.
pub fn read_data_size(bytes: &[u8]) -> Option<(DataSize, usize)> {
    let first = *bytes.first()?;
    let len = marker_len(first);
    if bytes.len() < len || len > 8 {
        return None;
    }
    let value_bits = 7 * len;
    let all_ones = (1u64 << value_bits) - 1;
    let value = read_bits(&[&[first & first_byte_mask(len)], &bytes[1..len]].concat());
    if value == all_ones {
        return Some((DataSize::Unbounded, len));
    }
    Some((DataSize::Known(value), len))
}

/// Unsigned big-endian payload, as Matroska stores counts and dimensions.
pub fn read_uint(bytes: &[u8]) -> u64 {
    read_bits(bytes)
}

/// Signed big-endian payload of a fixed width, as blocks store timecodes.
pub fn read_int(bytes: &[u8]) -> i64 {
    let unsigned = read_bits(bytes);
    let sign_bit = 1u64 << (8 * bytes.len() - 1);
    if bytes.is_empty() || unsigned & sign_bit == 0 {
        return unsigned as i64;
    }
    unsigned as i64 - sign_bit as i64
}

pub fn read_float(bytes: &[u8]) -> Option<f64> {
    match bytes.len() {
        4 => Some(f64::from(f32::from_bits(read_bits(bytes) as u32))),
        8 => Some(f64::from_bits(read_bits(bytes))),
        _ => None,
    }
}

/// An element header: where its payload starts and where it ends.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ElementHeader {
    pub id: u32,
    pub payload_start: u64,
    pub payload_end: u64,
}

impl ElementHeader {
    pub fn payload_len(&self) -> u64 {
        self.payload_end - self.payload_start
    }
}

/// Buffered cursor over a file. Positions stay absolute so a payload read later
/// can jump back to the same offset.
pub struct Cursor {
    file: File,
    buffer: Vec<u8>,
    buffer_start: u64,
    position: u64,
}

impl Cursor {
    /// Takes over a file and reads it from its first byte, wherever the caller
    /// had left it.
    pub fn new(mut file: File) -> io::Result<Self> {
        file.seek(SeekFrom::Start(0))?;
        let mut buffer = vec![0u8; BUFFER_BYTES];
        let read = file.read(buffer.as_mut_slice())?;
        buffer.truncate(read);
        Ok(Self {
            file,
            buffer,
            buffer_start: 0,
            position: 0,
        })
    }

    pub fn position(&self) -> u64 {
        self.position
    }

    pub fn seek(&mut self, position: u64) -> io::Result<()> {
        self.position = position;
        self.ensure(1)
    }

    pub fn skip(&mut self, count: u64) {
        self.position += count;
    }

    /// Makes sure `count` bytes from the current position are buffered.
    fn ensure(&mut self, count: usize) -> io::Result<()> {
        // A position outside what is buffered — a backwards seek into an earlier
        // element, or a skip past the end — cannot be served from the old window,
        // so that window is dropped and read again from where the cursor is now.
        let outside = self.position < self.buffer_start
            || self.position - self.buffer_start > self.buffer.len() as u64;
        if outside {
            self.buffer.clear();
            self.buffer_start = self.position;
        }

        let offset = (self.position - self.buffer_start) as usize;
        if offset + count <= self.buffer.len() {
            return Ok(());
        }
        self.file.seek(SeekFrom::Start(self.position))?;
        let mut buffer = vec![0u8; BUFFER_BYTES.max(count)];
        let read = self.file.read(buffer.as_mut_slice())?;
        buffer.truncate(read);
        self.buffer = buffer;
        self.buffer_start = self.position;
        Ok(())
    }

    fn window(&mut self, count: usize) -> io::Result<Vec<u8>> {
        self.ensure(count)?;
        let offset = (self.position - self.buffer_start) as usize;
        let end = (offset + count).min(self.buffer.len());
        Ok(self.buffer[offset..end].to_vec())
    }

    pub fn read_bytes(&mut self, count: usize) -> io::Result<Vec<u8>> {
        let bytes = self.window(count)?;
        self.position += count as u64;
        Ok(bytes)
    }

    /// Reads the next element header and leaves the cursor on its payload.
    ///
    /// Containers are padded with bytes no element can start with — SeekHead
    /// alignment, void fill from muxers. Resynchronising one byte at a time keeps
    /// a padded file readable; a stretch that never yields an element is a real
    /// defect and is reported as one.
    pub fn read_element(&mut self, limit: u64) -> io::Result<Option<ElementHeader>> {
        const RESYNC_LIMIT: u64 = 4096;
        let resync_floor = self.position.min(limit).saturating_sub(RESYNC_LIMIT);

        while self.position + 2 <= limit {
            let attempt = self.position;
            if let Some((id, id_len)) = read_element_id(&self.window(4)?) {
                self.position += id_len as u64;
                if self.position < limit {
                    if let Some((size, size_len)) = read_data_size(&self.window(8)?) {
                        self.position += size_len as u64;
                        let payload_start = self.position;
                        let payload_end = match size {
                            DataSize::Known(length) => payload_start + length,
                            DataSize::Unbounded => limit,
                        };
                        return Ok(Some(ElementHeader {
                            id,
                            payload_start,
                            payload_end: payload_end.min(limit).max(payload_start),
                        }));
                    }
                }
            }
            self.position = attempt + 1;
            if self.position <= resync_floor {
                break;
            }
        }

        Ok(None)
    }

    /// Reads an element's payload and leaves the cursor on the next element.
    pub fn read_payload(&mut self, element: &ElementHeader) -> io::Result<Vec<u8>> {
        self.seek(element.payload_start)?;
        self.read_bytes(element.payload_len() as usize)
    }
}
