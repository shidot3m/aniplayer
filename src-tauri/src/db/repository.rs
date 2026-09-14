use std::path::Path;
use std::sync::Mutex;
use rusqlite::{params, Connection, Result};
use crate::db::models::{BookmarkItem, DownloadedEpisodeMeta, HistoryItem};

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn new(path: &Path) -> Result<Self> {
        let conn = Connection::open(path)?;
        let db = Self {
            conn: Mutex::new(conn),
        };
        db.init_tables()?;
        Ok(db)
    }

    pub fn init_in_memory() -> Result<Self> {
        let conn = Connection::open_in_memory()?;
        let db = Self {
            conn: Mutex::new(conn),
        };
        db.init_tables()?;
        Ok(db)
    }

    fn lock_conn(&self) -> Result<std::sync::MutexGuard<'_, Connection>> {
        self.conn.lock().map_err(|e| {
            rusqlite::Error::ToSqlConversionFailure(Box::new(std::io::Error::new(
                std::io::ErrorKind::Other,
                e.to_string(),
            )))
        })
    }

    fn init_tables(&self) -> Result<()> {
        let conn = self.lock_conn()?;
        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS bookmarks (
                release_id INTEGER PRIMARY KEY,
                category TEXT NOT NULL CHECK (category IN ('WATCHING', 'PLANNED', 'POSTPONED', 'ABANDONED', 'NOT_INTERESTED', 'FAVORITES', 'WATCHED')),
                release_data_json TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS history (
                release_id INTEGER NOT NULL,
                episode_id TEXT NOT NULL,
                episode_ordinal REAL NOT NULL,
                last_position REAL NOT NULL DEFAULT 0,
                duration REAL NOT NULL DEFAULT 0,
                is_completed BOOLEAN NOT NULL DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (release_id, episode_id)
            );

            CREATE TABLE IF NOT EXISTS downloaded_episodes (
                episode_id TEXT PRIMARY KEY,
                release_id INTEGER NOT NULL,
                episode_ordinal REAL NOT NULL,
                file_path TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                quality TEXT NOT NULL,
                opening_start REAL,
                opening_stop REAL,
                ending_start REAL,
                ending_stop REAL,
                download_status TEXT NOT NULL CHECK (download_status IN ('PENDING', 'DOWNLOADING', 'COMPLETED', 'FAILED')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            "#,
        )?;
        Ok(())
    }

    // App Settings
    pub fn save_setting(&self, key: &str, value: &str) -> Result<()> {
        let conn = self.lock_conn()?;
        conn.execute(
            "INSERT INTO app_settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = ?2",
            params![key, value],
        )?;
        Ok(())
    }

    pub fn get_setting(&self, key: &str) -> Result<Option<String>> {
        let conn = self.lock_conn()?;
        let mut stmt = conn.prepare("SELECT value FROM app_settings WHERE key = ?1")?;
        let mut rows = stmt.query(params![key])?;
        if let Some(row) = rows.next()? {
            Ok(Some(row.get(0)?))
        } else {
            Ok(None)
        }
    }

    // Bookmarks
    pub fn save_bookmark(&self, item: &BookmarkItem) -> Result<()> {
        let conn = self.lock_conn()?;
        conn.execute(
            r#"INSERT INTO bookmarks (release_id, category, release_data_json, updated_at) 
               VALUES (?1, ?2, ?3, CURRENT_TIMESTAMP)
               ON CONFLICT(release_id) DO UPDATE SET category = ?2, release_data_json = ?3, updated_at = CURRENT_TIMESTAMP"#,
            params![item.release_id, item.category, item.release_data_json],
        )?;
        Ok(())
    }

    pub fn get_bookmarks(&self, category: Option<String>) -> Result<Vec<BookmarkItem>> {
        let conn = self.lock_conn()?;
        let mut items = Vec::new();
        if let Some(cat) = category {
            let mut stmt = conn.prepare("SELECT release_id, category, release_data_json, updated_at FROM bookmarks WHERE category = ?1 ORDER BY updated_at DESC")?;
            let rows = stmt.query_map(params![cat], |row| {
                Ok(BookmarkItem {
                    release_id: row.get(0)?,
                    category: row.get(1)?,
                    release_data_json: row.get(2)?,
                    updated_at: row.get(3)?,
                })
            })?;
            for row in rows {
                items.push(row?);
            }
        } else {
            let mut stmt = conn.prepare("SELECT release_id, category, release_data_json, updated_at FROM bookmarks ORDER BY updated_at DESC")?;
            let rows = stmt.query_map([], |row| {
                Ok(BookmarkItem {
                    release_id: row.get(0)?,
                    category: row.get(1)?,
                    release_data_json: row.get(2)?,
                    updated_at: row.get(3)?,
                })
            })?;
            for row in rows {
                items.push(row?);
            }
        }
        Ok(items)
    }

    pub fn delete_bookmark(&self, release_id: i64) -> Result<()> {
        let conn = self.lock_conn()?;
        conn.execute("DELETE FROM bookmarks WHERE release_id = ?1", params![release_id])?;
        Ok(())
    }

    // History
    pub fn save_history(&self, item: &HistoryItem) -> Result<()> {
        let conn = self.lock_conn()?;
        conn.execute(
            r#"INSERT INTO history (release_id, episode_id, episode_ordinal, last_position, duration, is_completed, updated_at)
               VALUES (?1, ?2, ?3, ?4, ?5, ?6, CURRENT_TIMESTAMP)
               ON CONFLICT(release_id, episode_id) DO UPDATE SET 
                 last_position = ?4, duration = ?5, is_completed = ?6, updated_at = CURRENT_TIMESTAMP"#,
            params![
                item.release_id,
                item.episode_id,
                item.episode_ordinal,
                item.last_position,
                item.duration,
                item.is_completed,
            ],
        )?;
        Ok(())
    }

    pub fn get_continue_watching(&self) -> Result<Vec<HistoryItem>> {
        let conn = self.lock_conn()?;
        let mut stmt = conn.prepare(
            r#"SELECT release_id, episode_id, episode_ordinal, last_position, duration, is_completed, updated_at 
               FROM history 
               WHERE is_completed = 0 AND last_position > 0 
               ORDER BY updated_at DESC LIMIT 20"#
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(HistoryItem {
                release_id: row.get(0)?,
                episode_id: row.get(1)?,
                episode_ordinal: row.get(2)?,
                last_position: row.get(3)?,
                duration: row.get(4)?,
                is_completed: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })?;
        let mut items = Vec::new();
        for row in rows {
            items.push(row?);
        }
        Ok(items)
    }

    // Downloaded Episodes & Skip Codes
    pub fn save_downloaded_episode(&self, item: &DownloadedEpisodeMeta) -> Result<()> {
        let conn = self.lock_conn()?;
        conn.execute(
            r#"INSERT INTO downloaded_episodes (episode_id, release_id, episode_ordinal, file_path, file_size, quality, opening_start, opening_stop, ending_start, ending_stop, download_status)
               VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
               ON CONFLICT(episode_id) DO UPDATE SET 
                 file_path = ?4, file_size = ?5, quality = ?6, opening_start = ?7, opening_stop = ?8, ending_start = ?9, ending_stop = ?10, download_status = ?11"#,
            params![
                item.episode_id,
                item.release_id,
                item.episode_ordinal,
                item.file_path,
                item.file_size,
                item.quality,
                item.opening_start,
                item.opening_stop,
                item.ending_start,
                item.ending_stop,
                item.download_status,
            ],
        )?;
        Ok(())
    }

    pub fn get_downloaded_episode(&self, episode_id: &str) -> Result<Option<DownloadedEpisodeMeta>> {
        let conn = self.lock_conn()?;
        let mut stmt = conn.prepare(
            r#"SELECT episode_id, release_id, episode_ordinal, file_path, file_size, quality, opening_start, opening_stop, ending_start, ending_stop, download_status 
               FROM downloaded_episodes WHERE episode_id = ?1"#
        )?;
        let mut rows = stmt.query(params![episode_id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(DownloadedEpisodeMeta {
                episode_id: row.get(0)?,
                release_id: row.get(1)?,
                episode_ordinal: row.get(2)?,
                file_path: row.get(3)?,
                file_size: row.get(4)?,
                quality: row.get(5)?,
                opening_start: row.get(6)?,
                opening_stop: row.get(7)?,
                ending_start: row.get(8)?,
                ending_stop: row.get(9)?,
                download_status: row.get(10)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn delete_downloaded_episode(&self, episode_id: &str) -> Result<()> {
        let conn = self.lock_conn()?;
        conn.execute("DELETE FROM downloaded_episodes WHERE episode_id = ?1", params![episode_id])?;
        Ok(())
    }
}
