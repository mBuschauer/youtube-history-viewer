#![allow(dead_code)]

use crate::storage::data_root;
use rusqlite::{Connection, Result as SqlResult, params};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;

fn video_cache_path() -> PathBuf {
    data_root().join("videos.sqlite")
}


const MISSING_TTL_SECS: i64 = 30 * 24 * 60 * 60;

fn now_unix() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

fn parse_youtube_duration(duration_str: &str) -> i64 {
    let mut total_seconds = 0;
    let mut current_number = 0;

    for c in duration_str.chars() {
        if let Some(digit) = c.to_digit(10) {
            current_number = current_number * 10 + digit as i64;
        } else {
            match c {
                'D' => total_seconds += current_number * 86400,
                'H' => total_seconds += current_number * 3600,
                'M' => total_seconds += current_number * 60,
                'S' => total_seconds += current_number,
                _ => {}
            }
            current_number = 0;
        }
    }

    total_seconds
}

fn deserialize_youtube_duration<'de, D>(deserializer: D) -> Result<i64, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let s: String = serde::Deserialize::deserialize(deserializer)?;
    Ok(parse_youtube_duration(&s))
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct VideoListResponse {
    pub kind: String,
    pub etag: String,
    pub items: Vec<VideoEntry>,
    pub next_page_token: Option<String>,
    pub prev_page_token: Option<String>,
    pub page_info: PageInfo,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PageInfo {
    pub total_results: i32,
    pub results_per_page: i32,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct VideoEntry {
    pub kind: String,
    pub etag: String,
    pub id: String,
    pub snippet: Option<VideoSnippet>,
    pub content_details: Option<VideoContentDetails>,
    pub status: Option<VideoStatus>,
    pub statistics: Option<VideoStatistics>,
    pub player: Option<VideoPlayer>,
    pub topic_details: Option<VideoTopicDetails>,
    pub live_streaming_details: Option<VideoLiveStreamingDetails>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct VideoSnippet {
    pub published_at: String,
    pub channel_id: String,
    pub title: String,
    pub description: String,
    pub thumbnails: HashMap<String, Thumbnail>,
    pub channel_title: String,
    pub tags: Option<Vec<String>>,
    pub category_id: String,
    pub live_broadcast_content: String,
    pub default_language: Option<String>,
    pub localized: Option<Localized>,
    pub default_audio_language: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Thumbnail {
    pub url: String,
    pub width: Option<i32>,
    pub height: Option<i32>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Localized {
    pub title: String,
    pub description: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct VideoContentDetails {
    #[serde(deserialize_with = "deserialize_youtube_duration")]
    pub duration: i64,
    pub dimension: String,
    pub definition: String,
    pub caption: String,
    pub licensed_content: bool,
    pub content_rating: Option<HashMap<String, String>>,
    pub projection: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct VideoStatus {
    pub upload_status: String,
    pub privacy_status: String,
    pub license: String,
    pub embeddable: bool,
    pub public_stats_viewable: bool,
    pub made_for_kids: bool,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct VideoStatistics {
    pub view_count: Option<String>,
    pub like_count: Option<String>,
    pub favorite_count: Option<String>,
    pub comment_count: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct VideoPlayer {
    pub embed_html: String,
    pub embed_height: Option<i64>,
    pub embed_width: Option<i64>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct VideoTopicDetails {
    pub topic_ids: Option<Vec<String>>,
    pub relevant_topic_ids: Option<Vec<String>>,
    pub topic_categories: Option<Vec<String>>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct VideoLiveStreamingDetails {
    pub actual_start_time: Option<String>,
    pub actual_end_time: Option<String>,
    pub scheduled_start_time: Option<String>,
    pub scheduled_end_time: Option<String>,
    pub concurrent_viewers: Option<String>,
    pub active_live_chat_id: Option<String>,
}

pub fn init_db(conn: &Connection) -> SqlResult<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS videos (
            id TEXT PRIMARY KEY,
            kind TEXT,
            etag TEXT,
            snippet_published_at TEXT,
            snippet_channel_id TEXT,
            snippet_title TEXT,
            snippet_description TEXT,
            snippet_thumbnails TEXT,
            snippet_channel_title TEXT,
            snippet_tags TEXT,
            snippet_category_id TEXT,
            snippet_live_broadcast_content TEXT,
            snippet_default_language TEXT,
            snippet_localized TEXT,
            snippet_default_audio_language TEXT,
            content_details_duration INTEGER,
            content_details_dimension TEXT,
            content_details_definition TEXT,
            content_details_caption TEXT,
            content_details_licensed_content BOOLEAN,
            content_details_content_rating TEXT,
            content_details_projection TEXT,
            status_upload_status TEXT,
            status_privacy_status TEXT,
            status_license TEXT,
            status_embeddable BOOLEAN,
            status_public_stats_viewable BOOLEAN,
            status_made_for_kids BOOLEAN,
            statistics_view_count TEXT,
            statistics_like_count TEXT,
            statistics_favorite_count TEXT,
            statistics_comment_count TEXT,
            player_embed_html TEXT,
            player_embed_height INTEGER,
            player_embed_width INTEGER,
            topic_details TEXT,
            live_streaming_details TEXT
        )",
        [],
    )?;
    // Negative cache: ids the YouTube API was asked for but did not return
    // (deleted/private videos). Prevents re-requesting them on every load.
    conn.execute(
        "CREATE TABLE IF NOT EXISTS missing_videos (
            id TEXT PRIMARY KEY,
            checked_at INTEGER NOT NULL
        )",
        [],
    )?;
    Ok(())
}

/// Return the subset of `ids` that have a still-valid "missing" tombstone.
fn get_valid_tombstones(conn: &Connection, ids: &[String]) -> SqlResult<HashSet<String>> {
    let cutoff = now_unix() - MISSING_TTL_SECS;
    let mut stmt = conn.prepare("SELECT checked_at FROM missing_videos WHERE id = ?1")?;

    let mut tombstoned = HashSet::new();
    for id in ids {
        let checked_at: Option<i64> = stmt
            .query_row(params![id], |row| row.get(0))
            .map(Some)
            .or_else(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => Ok(None),
                other => Err(other),
            })?;
        if matches!(checked_at, Some(ts) if ts >= cutoff) {
            tombstoned.insert(id.clone());
        }
    }
    Ok(tombstoned)
}

fn mark_missing(conn: &Connection, ids: &[String]) -> SqlResult<()> {
    let now = now_unix();
    let mut stmt =
        conn.prepare("INSERT OR REPLACE INTO missing_videos (id, checked_at) VALUES (?1, ?2)")?;
    for id in ids {
        stmt.execute(params![id, now])?;
    }
    Ok(())
}

fn clear_missing(conn: &Connection, id: &str) -> SqlResult<()> {
    conn.execute("DELETE FROM missing_videos WHERE id = ?1", params![id])?;
    Ok(())
}

fn insert_video(conn: &Connection, video: &VideoEntry) -> SqlResult<()> {
    conn.execute(
        "INSERT OR REPLACE INTO videos (
            id, kind, etag, 
            snippet_published_at, snippet_channel_id, snippet_title, snippet_description, snippet_thumbnails, snippet_channel_title, snippet_tags, snippet_category_id, snippet_live_broadcast_content, snippet_default_language, snippet_localized, snippet_default_audio_language,
            content_details_duration, content_details_dimension, content_details_definition, content_details_caption, content_details_licensed_content, content_details_content_rating, content_details_projection,
            status_upload_status, status_privacy_status, status_license, status_embeddable, status_public_stats_viewable, status_made_for_kids,
            statistics_view_count, statistics_like_count, statistics_favorite_count, statistics_comment_count,
            player_embed_html, player_embed_height, player_embed_width,
            topic_details, live_streaming_details
        ) VALUES (
            ?1, ?2, ?3,
            ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15,
            ?16, ?17, ?18, ?19, ?20, ?21, ?22,
            ?23, ?24, ?25, ?26, ?27, ?28,
            ?29, ?30, ?31, ?32,
            ?33, ?34, ?35,
            ?36, ?37
        )",
        params![
            video.id,
            video.kind,
            video.etag,
            video.snippet.as_ref().map(|s| &s.published_at),
            video.snippet.as_ref().map(|s| &s.channel_id),
            video.snippet.as_ref().map(|s| &s.title),
            video.snippet.as_ref().map(|s| &s.description),
            video.snippet.as_ref().and_then(|s| serde_json::to_string(&s.thumbnails).ok()),
            video.snippet.as_ref().map(|s| &s.channel_title),
            video.snippet.as_ref().and_then(|s| serde_json::to_string(&s.tags).ok()),
            video.snippet.as_ref().map(|s| &s.category_id),
            video.snippet.as_ref().map(|s| &s.live_broadcast_content),
            video.snippet.as_ref().and_then(|s| s.default_language.as_ref()),
            video.snippet.as_ref().and_then(|s| serde_json::to_string(&s.localized).ok()),
            video.snippet.as_ref().and_then(|s| s.default_audio_language.as_ref()),
            video.content_details.as_ref().map(|c| c.duration),
            video.content_details.as_ref().map(|c| &c.dimension),
            video.content_details.as_ref().map(|c| &c.definition),
            video.content_details.as_ref().map(|c| &c.caption),
            video.content_details.as_ref().map(|c| c.licensed_content),
            video.content_details.as_ref().and_then(|c| serde_json::to_string(&c.content_rating).ok()),
            video.content_details.as_ref().map(|c| &c.projection),
            video.status.as_ref().map(|s| &s.upload_status),
            video.status.as_ref().map(|s| &s.privacy_status),
            video.status.as_ref().map(|s| &s.license),
            video.status.as_ref().map(|s| s.embeddable),
            video.status.as_ref().map(|s| s.public_stats_viewable),
            video.status.as_ref().map(|s| s.made_for_kids),
            video.statistics.as_ref().and_then(|s| s.view_count.as_ref()),
            video.statistics.as_ref().and_then(|s| s.like_count.as_ref()),
            video.statistics.as_ref().and_then(|s| s.favorite_count.as_ref()),
            video.statistics.as_ref().and_then(|s| s.comment_count.as_ref()),
            video.player.as_ref().map(|p| &p.embed_html),
            video.player.as_ref().and_then(|p| p.embed_height),
            video.player.as_ref().and_then(|p| p.embed_width),
            video.topic_details.as_ref().and_then(|t| serde_json::to_string(t).ok()),
            video.live_streaming_details.as_ref().and_then(|l| serde_json::to_string(l).ok())
        ],
    )?;
    Ok(())
}

fn get_video(conn: &Connection, id: &str) -> SqlResult<Option<VideoEntry>> {
    let mut stmt = conn.prepare(
        "SELECT 
            id, kind, etag, 
            snippet_published_at, snippet_channel_id, snippet_title, snippet_description, snippet_thumbnails, snippet_channel_title, snippet_tags, snippet_category_id, snippet_live_broadcast_content, snippet_default_language, snippet_localized, snippet_default_audio_language,
            content_details_duration, content_details_dimension, content_details_definition, content_details_caption, content_details_licensed_content, content_details_content_rating, content_details_projection,
            status_upload_status, status_privacy_status, status_license, status_embeddable, status_public_stats_viewable, status_made_for_kids,
            statistics_view_count, statistics_like_count, statistics_favorite_count, statistics_comment_count,
            player_embed_html, player_embed_height, player_embed_width,
            topic_details, live_streaming_details
        FROM videos WHERE id = ?1"
    )?;

    let mut rows = stmt.query(params![id])?;
    if let Some(row) = rows.next()? {
        let snippet_published_at: Option<String> = row.get(3)?;
        let snippet = if let Some(published_at) = snippet_published_at {
            Some(VideoSnippet {
                published_at,
                channel_id: row.get(4)?,
                title: row.get(5)?,
                description: row.get(6)?,
                thumbnails: row
                    .get::<_, Option<String>>(7)?
                    .and_then(|s| serde_json::from_str(&s).ok())
                    .unwrap_or_default(),
                channel_title: row.get(8)?,
                tags: row
                    .get::<_, Option<String>>(9)?
                    .and_then(|s| serde_json::from_str(&s).ok()),
                category_id: row.get(10)?,
                live_broadcast_content: row.get(11)?,
                default_language: row.get(12)?,
                localized: row
                    .get::<_, Option<String>>(13)?
                    .and_then(|s| serde_json::from_str(&s).ok()),
                default_audio_language: row.get(14)?,
            })
        } else {
            None
        };

        let duration_val: Option<rusqlite::types::Value> = row.get(15)?;
        let duration = match duration_val {
            Some(rusqlite::types::Value::Integer(i)) => Some(i),
            Some(rusqlite::types::Value::Text(t)) => Some(parse_youtube_duration(&t)),
            _ => None,
        };

        let content_details = if let Some(duration) = duration {
            Some(VideoContentDetails {
                duration,
                dimension: row.get(16)?,
                definition: row.get(17)?,
                caption: row.get(18)?,
                licensed_content: row.get(19)?,
                content_rating: row
                    .get::<_, Option<String>>(20)?
                    .and_then(|s| serde_json::from_str(&s).ok()),
                projection: row.get(21)?,
            })
        } else {
            None
        };

        let status_upload_status: Option<String> = row.get(22)?;
        let status = if let Some(upload_status) = status_upload_status {
            Some(VideoStatus {
                upload_status,
                privacy_status: row.get(23)?,
                license: row.get(24)?,
                embeddable: row.get(25)?,
                public_stats_viewable: row.get(26)?,
                made_for_kids: row.get(27)?,
            })
        } else {
            None
        };

        let statistics = if row.get::<_, Option<String>>(28)?.is_some()
            || row.get::<_, Option<String>>(29)?.is_some()
            || row.get::<_, Option<String>>(30)?.is_some()
            || row.get::<_, Option<String>>(31)?.is_some()
        {
            Some(VideoStatistics {
                view_count: row.get(28)?,
                like_count: row.get(29)?,
                favorite_count: row.get(30)?,
                comment_count: row.get(31)?,
            })
        } else {
            None
        };

        let player_embed_html: Option<String> = row.get(32)?;
        let player = if let Some(embed_html) = player_embed_html {
            Some(VideoPlayer {
                embed_html,
                embed_height: row.get(33)?,
                embed_width: row.get(34)?,
            })
        } else {
            None
        };

        let topic_details = row
            .get::<_, Option<String>>(35)?
            .and_then(|s| serde_json::from_str(&s).ok());
        let live_streaming_details = row
            .get::<_, Option<String>>(36)?
            .and_then(|s| serde_json::from_str(&s).ok());

        Ok(Some(VideoEntry {
            id: row.get(0)?,
            kind: row.get(1)?,
            etag: row.get(2)?,
            snippet,
            content_details,
            status,
            statistics,
            player,
            topic_details,
            live_streaming_details,
        }))
    } else {
        Ok(None)
    }
}

/// Fetch video data from YouTube API
/// Takes in a slice of video IDs and a YouTube API key.
/// Limits the request to a maximum of 50 video IDs.
pub async fn fetch_videos(ids: &[String], api_key: &str) -> Result<Vec<VideoEntry>, String> {
    if ids.len() > 50 {
        return Err("Cannot request more than 50 video IDs at once".to_string());
    }

    if ids.is_empty() {
        return Ok(Vec::new());
    }

    // Open connection and initialize
    let conn = Connection::open(video_cache_path())
        .map_err(|e| format!("Failed to open DB: {}", e))?;
    if let Err(e) = init_db(&conn) {
        return Err(format!("Failed to initialize DB: {}", e));
    }

    let mut result = Vec::new();
    let mut missing_ids = Vec::new();

    // Check DB first
    for id in ids {
        match get_video(&conn, id) {
            Ok(Some(video)) => result.push(video),
            _ => missing_ids.push(id.clone()),
        }
    }

    if missing_ids.is_empty() {
        return Ok(result);
    }

    let tombstoned = get_valid_tombstones(&conn, &missing_ids).map_err(|e| format!("Failed to read missing-video cache: {}", e))?;
    let to_fetch: Vec<String> = missing_ids
        .into_iter()
        .filter(|id| !tombstoned.contains(id))
        .collect();

    if to_fetch.is_empty() {
        return Ok(result);
    }

    let client = reqwest::Client::new();
    let parts = "snippet,contentDetails,statistics,status,topicDetails,player,liveStreamingDetails";
    let ids_csv = to_fetch.join(",");
    let url = format!(
        "https://www.googleapis.com/youtube/v3/videos?part={}&id={}&key={}",
        parts, ids_csv, api_key
    );

    let res = client.get(&url).send().await.map_err(|e| e.to_string())?;

    if res.status().is_success() {
        let data: VideoListResponse = res.json().await.map_err(|e| e.to_string())?;
        let mut returned: HashSet<String> = HashSet::new();
        for video in data.items {
            if let Err(e) = insert_video(&conn, &video) {
                eprintln!("Failed to insert video into DB: {}", e);
            }
            // A previously-tombstoned video may have become available again
            if let Err(e) = clear_missing(&conn, &video.id) {
                eprintln!("Failed to clear missing-video entry: {}", e);
            }

            returned.insert(video.id.clone());
            result.push(video);
        }

        // Anything requested but not returned is gone (deleted/private):
        // tombstone it so we never spend quota on it again.
        // Only done on a successful response, so API failures don't create tombstones.
        let absent: Vec<String> = to_fetch
            .into_iter()
            .filter(|id| !returned.contains(id))
            .collect();
        if !absent.is_empty() {
            if let Err(e) = mark_missing(&conn, &absent) {
                eprintln!("Failed to record missing videos: {}", e);
            }
        }
    } else {
        return Err(format!("YouTube API request failed with status: {}", res.status()));
    }

    Ok(result)
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalVideosResponse {
    /// Videos found in the local cache
    pub videos: Vec<VideoEntry>,
    /// Ids known to be unavailable from the YouTube API (deleted/private)
    pub missing: Vec<String>,
}

pub async fn fetch_local_videos(ids: &[String]) -> Result<LocalVideosResponse, String> {
    if ids.is_empty() {
        return Ok(LocalVideosResponse {
            videos: Vec::new(),
            missing: Vec::new(),
        });
    }

    // Open connection and initialize
    let conn = Connection::open(video_cache_path())
        .map_err(|e| format!("Failed to open DB: {}", e))?;
    if let Err(e) = init_db(&conn) {
        return Err(format!("Failed to initialize DB: {}", e));
    }

    let mut videos = Vec::new();
    let mut uncached = Vec::new();

    for id in ids {
        match get_video(&conn, id) {
            Ok(Some(video)) => videos.push(video),
            _ => uncached.push(id.clone()),
        }
    }

    // Of the uncached ids, report the ones known to be unavailable so the
    // frontend doesn't ask the YouTube API for them.
    let missing = get_valid_tombstones(&conn, &uncached)
        .map_err(|e| format!("Failed to read missing-video cache: {}", e))?
        .into_iter()
        .collect();

    Ok(LocalVideosResponse { videos, missing })
}