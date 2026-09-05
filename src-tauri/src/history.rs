use crate::storage::RawType;
use chrono::{DateTime, NaiveDateTime};
use regex::Regex;
use scraper::{Html, Selector};
use serde::Deserialize;
use std::fs;
use std::path::Path;

fn get_youtube_id(url: &str) -> Option<String> {
    let re = Regex::new(
        r#"(?x)
        (?:https?://)?
        (?:www\.)?
        (?:
            youtu\.be/([0-9A-Za-z_-]{11})
            |
            youtube\.com/(?:embed/|v/|watch\?v=|watch\?.+&v=)([0-9A-Za-z_-]{11})
        )"#,
    )
    .ok()?;

    let caps = re.captures(url)?;

    caps.get(1)
        .or_else(|| caps.get(2))
        .map(|m| m.as_str().to_string())
}

fn process_url(url: &str) -> Option<String> {
    match get_youtube_id(url) {
        Some(id) => {
            return Some(id);
        }
        None => {
            if url.contains("youtube.com/post/") || url.contains("youtube.com/playables/") {
            } else {
                println!(
                    "Invalid YouTube URL: '{}' does not contain a valid video ID.",
                    url
                );
            }
            return None;
        }
    }
}

#[derive(Debug, Clone)]
pub struct HistoryEntry {
    pub header: Option<String>,
    pub action: Option<String>,
    pub video_title: Option<String>,
    pub video_url: String,
    pub video_id: Option<String>,
    pub channel_name: Option<String>,
    pub channel_url: Option<String>,
    pub timestamp: i64,
    pub products: Option<String>,
    pub details: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RawSubtitle {
    name: Option<String>,
    url: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RawJsonEntry {
    header: Option<String>,
    title: Option<String>,
    #[serde(rename = "titleUrl")]
    title_url: Option<String>,
    #[serde(default)]
    subtitles: Vec<RawSubtitle>,
    time: Option<String>,
    #[serde(default)]
    products: Vec<String>,
    #[serde(default, rename = "activityControls")]
    activity_controls: Vec<String>,
}

pub fn parse_watch_history_file<P: AsRef<Path>>(
    raw_type: RawType,
    file_path: P,
) -> Option<Vec<HistoryEntry>> {
    match raw_type {
        RawType::Json => {
            println!("Parsing JSON file");
            let json_content = fs::read_to_string(file_path).ok()?;
            parse_json_watch_history(&json_content)
        }
        RawType::Html => {
            println!("Parsing HTML file");
            let html_content = fs::read_to_string(file_path).ok()?;
            parse_html_watch_history(&html_content)
        }
    }
}

pub fn parse_json_watch_history(json_content: &str) -> Option<Vec<HistoryEntry>> {
    fn clean(s: &str) -> String {
        s.replace('\u{a0}', " ").trim().to_string()
    }

    fn split_action(title: &str) -> (Option<String>, Option<String>) {
        const ACTIONS: [&str; 4] = ["Watched ", "Viewed ", "Searched for ", "Visited "];
        for prefix in ACTIONS {
            if let Some(rest) = title.strip_prefix(prefix) {
                return (
                    Some(prefix.trim().to_string()),
                    Some(rest.trim().to_string()),
                );
            }
        }
        (None, Some(title.trim().to_string()))
    }

    println!("  Parsing History...");
    let raw_entries: Vec<RawJsonEntry> = match serde_json::from_str(json_content) {
        Ok(v) => v,
        Err(e) => {
            println!("  [Error] Failed to parse JSON: {}", e);
            return None;
        }
    };

    let mut entries: Vec<HistoryEntry> = Vec::with_capacity(raw_entries.len());

    for raw in raw_entries {
        let header = raw.header.as_deref().map(clean).filter(|h| !h.is_empty());
        let (action, video_title) = match raw.title.as_deref() {
            Some(t) => split_action(&clean(t)),
            None => (None, None),
        };
        let (channel_name, channel_url) = match raw.subtitles.into_iter().next() {
            Some(s) => (
                Some(s.name.as_deref().map(clean).unwrap_or_default()),
                s.url.as_deref().map(clean),
            ),
            None => (None, None),
        };

        let video_url = match raw.title_url.as_deref().map(clean) {
            Some(url) if !url.is_empty() => url,
            _ => continue,
        };

        let video_id = match process_url(&video_url) {
            Some(id) => Some(id),
            None => continue,
        };

        let time_str = match raw.time {
            Some(t) => t,
            None => continue,
        };

        let timestamp = match DateTime::parse_from_rfc3339(&time_str) {
            Ok(dt) => dt.timestamp(),
            Err(e) => {
                println!(
                    "  [Warning] Failed to parse timestamp: '{}' (Error: {}). Discarding entry.",
                    time_str, e
                );
                continue;
            }
        };
        let products = match raw.products.is_empty() {
            true => None,
            false => Some(raw.products.join(" ")),
        };
        let details = match raw.activity_controls.is_empty() {
            true => None,
            false => Some(raw.activity_controls.join(" ")),
        };
        entries.push(HistoryEntry {
            header,
            action,
            video_title,
            video_url,
            video_id,
            channel_name,
            channel_url,
            timestamp,
            products,
            details,
        });
    }

    if entries.is_empty() {
        None
    } else {
        Some(entries)
    }
}

pub fn parse_html_watch_history(html_content: &str) -> Option<Vec<HistoryEntry>> {
    let document = Html::parse_document(html_content);
    let mut entries = Vec::new();

    println!("  Parsing History...");

    // Match either the outer-cell or directly the mdl-grid
    let container_selector =
        Selector::parse("div.outer-cell.mdl-cell.mdl-cell--12-col.mdl-shadow--2dp").unwrap();
    let header_selector = Selector::parse("div.header-cell").unwrap();
    let content_cell_selector =
        Selector::parse("div.content-cell.mdl-cell--6-col:not(.mdl-typography--text-right)")
            .unwrap();
    let caption_cell_selector =
        Selector::parse("div.content-cell.mdl-typography--caption").unwrap();
    let link_selector = Selector::parse("a").unwrap();

    for element in document.select(&container_selector) {
        let mut header = None;
        if let Some(header_cell) = element.select(&header_selector).next() {
            let h_text = header_cell.text().collect::<String>().trim().to_string();
            if !h_text.is_empty() {
                header = Some(h_text);
            }
        }

        let mut action = None;
        let mut video_title = None;
        let mut video_url = None;
        let mut channel_name = None;
        let mut channel_url = None;
        let mut timestamp = None;

        if let Some(content_cell) = element.select(&content_cell_selector).next() {
            let links: Vec<_> = content_cell.select(&link_selector).collect();

            if let Some(video_link) = links.get(0) {
                video_title = Some(video_link.text().collect::<String>().trim().to_string());
                video_url = video_link.value().attr("href").map(|s| s.to_string());
            }

            if let Some(channel_link) = links.get(1) {
                channel_name = Some(channel_link.text().collect::<String>().trim().to_string());
                channel_url = channel_link.value().attr("href").map(|s| s.to_string());
            }

            let text_nodes: Vec<_> = content_cell
                .text()
                .map(|t| t.replace("\u{a0}", " ").trim().to_string())
                .filter(|t| !t.is_empty())
                .collect();

            if let Some(first_text) = text_nodes.first() {
                if Some(first_text.as_str()) != video_title.as_deref()
                    && Some(first_text.as_str()) != channel_name.as_deref()
                {
                    action = Some(first_text.to_string());
                }
            }

            if let Some(last_text) = text_nodes.last() {
                if Some(last_text.as_str()) != video_title.as_deref()
                    && Some(last_text.as_str()) != channel_name.as_deref()
                    && Some(last_text.as_str()) != action.as_deref()
                {
                    timestamp = Some(last_text.to_string());
                }
            }
        }

        let mut products = None;
        let mut details = None;
        if let Some(caption_cell) = element.select(&caption_cell_selector).next() {
            let mut current_product = String::new();
            let mut current_details = String::new();
            let mut in_products = false;
            let mut in_details = false;

            for node in caption_cell.text() {
                let text = node.replace("\u{a0}", " ").trim().to_string();
                if text.is_empty() {
                    continue;
                }

                if text == "Products:" {
                    in_products = true;
                    in_details = false;
                    continue;
                } else if text == "Why is this here?" {
                    in_products = false;
                    in_details = true;
                    continue;
                }

                if in_products {
                    if !current_product.is_empty() {
                        current_product.push(' ');
                    }
                    current_product.push_str(&text);
                } else if in_details {
                    if !current_details.is_empty() {
                        current_details.push(' ');
                    }
                    current_details.push_str(&text);
                }
            }

            if !current_product.is_empty() {
                products = Some(current_product);
            }
            if !current_details.is_empty() {
                details = Some(current_details);
            }
        }

        let video_url = match video_url {
            Some(url) => url,
            None => continue,
        };

        let video_id = match process_url(&video_url) {
            Some(id) => Some(id),
            None => continue, // Discards if video_id resolution fails
        };

        let timestamp_str = match timestamp {
            Some(ts) if !ts.is_empty() => ts,
            _ => continue, // Discards if timestamp is missing or empty
        };

        let normalized_ts = timestamp_str.replace('\u{202f}', " ");

        let datetime_part = match normalized_ts.rfind(' ') {
            Some(idx) => &normalized_ts[..idx],
            None => &normalized_ts,
        };

        let unix_timestamp =
            match NaiveDateTime::parse_from_str(datetime_part, "%b %d, %Y, %I:%M:%S %p") {
                Ok(naive_dt) => naive_dt.and_utc().timestamp(),
                Err(e) => {
                    println!(
                    "  [Warning] Failed to parse timestamp: '{}' (Error: {}). Discarding entry.",
                    timestamp_str, e
                );
                    continue; // Discard entry on failure
                }
            };

        entries.push(HistoryEntry {
            header,
            action,
            video_title,
            video_url,
            video_id,
            channel_name,
            channel_url,
            timestamp: unix_timestamp,
            products,
            details,
        });
    }
    if entries.is_empty() {
        None
    } else {
        Some(entries)
    }
}
