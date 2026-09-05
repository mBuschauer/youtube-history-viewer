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

Prebuilt installers for Linux, macOS, and Windows are attached to each
[release](https://github.com/mBuschauer/youtube-history-viewer/releases).

### Nix / NixOS

Run it without installing anything:

```sh
nix run github:mBuschauer/youtube-history-viewer
```

Build it, or install it into your profile:

```sh
nix build github:mBuschauer/youtube-history-viewer   # ./result/bin/youtube-history-viewer
```

Add it to a NixOS configuration as a flake input:

```nix
{
  inputs.youtube-history-viewer.url = "github:mBuschauer/youtube-history-viewer";

  # in your system module, with `inputs` passed through specialArgs:
  environment.systemPackages = [
    inputs.youtube-history-viewer.packages.${pkgs.system}.default
  ];
}
```

### Development

```sh
git clone https://github.com/mBuschauer/youtube-history-viewer
cd youtube-history-viewer
nix develop
pnpm install
pnpm run tauri dev 
```

### First run

1. Export your watch history from [Google Takeout](https://takeout.google.com/) as a `.html` or `.json` file (I found exporting as HTML gives a much longer history)
2. Add a [YouTube Data API v3](https://console.cloud.google.com/apis/library/youtube.googleapis.com) key in the settings page
3. Upload `watch-history.html` (or `.json`) and let it parse.

## Roadmap
- [ ] Properly handle hitting usage limits
  - [ ] Handle invalid API Key
- [x] Clean up UI
  - [x] Make it look less like a webapp
  - [ ] Loading Screen
  - [x] Implement UI to display while parsing
  - [ ] Refetch video from VideoPanel
  - [x] Dark Mode
