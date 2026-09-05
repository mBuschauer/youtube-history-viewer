// Shared types for the history view.

/** One row of the watch history grid (from the `get_dataset_history` command). */
export interface HistoryRow {
    id: number;
    action: string | null;
    video_title: string | null;
    video_url: string | null;
    video_id: string | null;
    channel_name: string | null;
    channel_url: string | null;
    /** Unix seconds */
    timestamp: number | null;
    // Enriched fields (filled in from the videos API)
    duration?: number;
    views?: number;
    enriched: boolean;
}

/** Video metadata from the `get_videos` command (YouTube API shape, camelCase). */
export interface VideoEntry {
    id: string;
    snippet?: {
        publishedAt: string;
        channelId: string;
        title: string;
        description: string;
        thumbnails: Record<string, { url: string; width?: number; height?: number }>;
        channelTitle: string;
        tags?: string[] | null;
    } | null;
    contentDetails?: {
        /** Seconds (parsed server-side) */
        duration: number;
        definition: string;
    } | null;
    statistics?: {
        viewCount?: string | null;
        likeCount?: string | null;
        commentCount?: string | null;
    } | null;
    status?: {
        embeddable: boolean;
        privacyStatus: string;
    } | null;
}

export interface VideosResponse {
    videos: VideoEntry[];
    missing: string[];
}

/** Format seconds as H:MM:SS (or M:SS under an hour). */
export function formatDuration(seconds: number | null | undefined): string {
    if (seconds == null || isNaN(seconds)) return "-";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const pad = (n: number) => String(n).padStart(2, "0");
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}


export interface Selection {
    row: HistoryRow;
    video: VideoEntry | null;
    loading: boolean;
}


export const HydrationStage = {
    None: 0,
    Local: 1,
    Remote: 2,
} as const;

export type HydrationStage = (typeof HydrationStage)[keyof typeof HydrationStage];

const STAGE_ORDER = [HydrationStage.Local, HydrationStage.Remote] as const;

export function nextStage(done: HydrationStage): HydrationStage | null {
    return STAGE_ORDER.find((s) => s > done) ?? null;
}