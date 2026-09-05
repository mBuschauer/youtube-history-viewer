use crate::history::HistoryEntry;
use rusqlite::{params, Connection, Error};
use std::path::Path;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct WatchedHistoryEntry {
    pub id: i64,
    pub action: Option<String>,
    pub video_title: Option<String>,
    pub video_url: Option<String>,
    pub video_id: Option<String>,
    pub channel_name: Option<String>,
    pub channel_url: Option<String>,
    pub timestamp: Option<i64>,
}

pub fn get_watched_history(db_path: &Path) -> Result<Vec<WatchedHistoryEntry>, Error> {
    let conn = Connection::open(db_path)?;

    // Select all fields EXCEPT header, products, and details
    let mut stmt = conn.prepare(
        "SELECT id, action, video_title, video_url, video_id, channel_name, channel_url, timestamp 
         FROM history_entries 
         WHERE LOWER(action) = 'watched'"
    )?;

    let rows = stmt.query_map([], |row| {
        Ok(WatchedHistoryEntry {
            id: row.get(0)?,
            action: row.get(1)?,
            video_title: row.get(2)?,
            video_url: row.get(3)?,
            video_id: row.get(4)?,
            channel_name: row.get(5)?,
            channel_url: row.get(6)?,
            timestamp: row.get(7)?,
        })
    })?;

    let mut entries = Vec::new();
    for entry in rows {
        entries.push(entry?);
    }

    Ok(entries)
}

pub fn save_history_to_db(entries: &[HistoryEntry], db_path: &Path) -> Result<(), Error> {
    let mut conn = Connection::open(db_path)?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS history_entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            header TEXT,
            action TEXT,
            video_title TEXT,
            video_url TEXT,
            video_id TEXT,
            channel_name TEXT,
            channel_url TEXT,
            timestamp INTEGER,
            products TEXT,
            details TEXT
        )",
        [],
    )?;

    let tx = conn.transaction()?;
    
    {
        let mut stmt = tx.prepare(
            "INSERT INTO history_entries (
                header, action, video_title, video_url, video_id, channel_name, channel_url, timestamp, products, details
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        )?;

        for entry in entries {
            stmt.execute(params![
                entry.header,
                entry.action,
                entry.video_title,
                entry.video_url,
                entry.video_id,
                entry.channel_name,
                entry.channel_url,
                entry.timestamp,
                entry.products,
                entry.details,
            ])?;
        }
    }
    
    tx.commit()?;

    Ok(())
}