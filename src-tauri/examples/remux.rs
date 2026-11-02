//! Remuxes a Matroska file into MP4 and writes it out, for inspection with an
//! external demuxer. Not part of the app: it exists so the stream copy can be
//! checked against a second implementation.
//!
//! cargo run --example remux -- in.mkv out.mp4

use aniplayer_lib::remux::Plan;
use std::io::Write;

fn main() {
    let mut arguments = std::env::args().skip(1);
    let (Some(input), Some(output)) = (arguments.next(), arguments.next()) else {
        eprintln!("usage: remux <input.mkv> <output.mp4>");
        std::process::exit(2);
    };

    let started = std::time::Instant::now();
    let plan = match Plan::build(std::path::Path::new(&input)) {
        Ok(plan) => plan,
        Err(error) => {
            eprintln!("remux failed: {error}");
            std::process::exit(1);
        }
    };
    let scanned = started.elapsed();

    let mut file =
        std::io::BufWriter::new(std::fs::File::create(&output).expect("output must be writable"));
    let mut offset = 0u64;
    let chunk = 1 << 20;
    while offset < plan.len() {
        let bytes = plan
            .read_range(offset, chunk)
            .expect("range must be readable");
        if bytes.is_empty() {
            break;
        }
        file.write_all(&bytes).expect("output must be writable");
        offset += bytes.len() as u64;
    }
    file.flush().expect("output must flush");

    println!(
        "{} -> {} ({} bytes, index {} ms, total {} ms)",
        input,
        output,
        plan.len(),
        scanned.as_millis(),
        started.elapsed().as_millis()
    );
}
