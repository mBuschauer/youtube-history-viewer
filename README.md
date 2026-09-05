# YouTube History Viewer

Browse, filter, and explore your YouTube watch history. Upload the
`watch-history.html` file from a [Google Takeout](https://takeout.google.com/)
export and get a sortable, filterable grid of everything you've watched.

## Features

- **Upload & parse** Google Takeout watch history (`watch-history.html` & `watch-history.json`)
- **Grid view** of all watched videos with thumbnails, title, channel, watch date, duration, and view count (AG Grid: column sorting, per-column filters, quick search)
- **Detail side panel** on row click: embedded player, publish date, stats, description, and tags
- **Local metadata cache** - each video is fetched from the YouTube API once and stored in SQLite; deleted/private videos are "tombstoned" so they don't waste API quota

## Getting started


## Roadmap
- [ ] Properly handle hitting usage limits
  - [ ] Handle invalid API Key
- [x] Clean up UI
  - [x] Make it look less like a webapp
  - [ ] Loading Screen
  - [x] Implement UI to display while parsing
  - [ ] Refetch video from VideoPanel
  - [x] Dark Mode
