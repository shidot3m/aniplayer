use serde::Serialize;
use serde_json::Value;

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum PlayerEvent {
    Time { position: f64, duration: f64 },
    Ended,
    Fault { message: String },
    HardwareDecoder { decoder: Option<String> },
}

#[derive(Debug, Default)]
pub struct PlaybackEvents {
    position: f64,
    duration: f64,
}

impl PlaybackEvents {
    pub fn handle_line(&mut self, line: &str) -> Option<PlayerEvent> {
        let message: Value = serde_json::from_str(line).ok()?;
        match message.get("event")?.as_str()? {
            "property-change" => self.property_changed(&message),
            "end-file" => match message.get("reason").and_then(Value::as_str) {
                Some("eof") => Some(PlayerEvent::Ended),
                Some("error") => Some(PlayerEvent::Fault {
                    message: message
                        .get("file_error")
                        .and_then(Value::as_str)
                        .unwrap_or("mpv could not play this episode")
                        .to_string(),
                }),
                _ => None,
            },
            _ => None,
        }
    }

    fn property_changed(&mut self, message: &Value) -> Option<PlayerEvent> {
        let name = message.get("name")?.as_str()?;
        let data = message.get("data")?;
        match name {
            "time-pos" => {
                self.position = data.as_f64()?;
                Some(self.time_event())
            }
            "duration" => {
                self.duration = data.as_f64()?;
                Some(self.time_event())
            }
            "hwdec-current" => {
                let decoder = data.as_str().and_then(|value| {
                    if value.is_empty() || value == "no" {
                        None
                    } else {
                        Some(value.to_string())
                    }
                });
                Some(PlayerEvent::HardwareDecoder { decoder })
            }
            _ => None,
        }
    }

    fn time_event(&self) -> PlayerEvent {
        PlayerEvent::Time {
            position: self.position,
            duration: self.duration,
        }
    }
}
