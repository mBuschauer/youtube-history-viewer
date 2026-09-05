import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { HistoryRow, VideoEntry, formatDuration } from "./types";
import { LuX, LuLoaderCircle, LuCircleSlash, LuExternalLink, LuRefreshCw } from "react-icons/lu";
import { useSettings } from "@/contexts/SettingsContext";

interface VideoPanelProps {
    row: HistoryRow;
    video: VideoEntry | null;
    loading: boolean;
    onClose: () => void;
}

function formatCount(value: string | null | undefined): string {
    return value != null ? Number(value).toLocaleString() : "-";
}

export default function VideoPanel({ row, video, loading, onClose }: VideoPanelProps) {
    const { settings } = useSettings();


    const [refreshing, setRefreshing] = useState(false);

    const onRefresh = async () => {
        if (!row.video_id) return;
        setRefreshing(true);
        try {
            await invoke("force_get_videos", {
                ids: [row.video_id],
                apiKey: settings.YouTubeApiKey,
            });
        } catch (err) {
            console.error("Forced video refresh failed:", err);
        } finally {
            setRefreshing(false);
        }
    };

    // Close on Escape
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [onClose]);

    const snippet = video?.snippet;
    const title = snippet?.title ?? row.video_title ?? "Untitled";

    return (
        <aside className="flex w-95 shrink-0 flex-col border-l border-line bg-surface">
            <div className="chrome flex h-9 shrink-0 items-center justify-between border-b border-line px-2.5">
                <span className="text-[12px] font-medium text-fg">Details</span>
                <div className="flex items-center gap-0.5">
                    <button
                        type="button"
                        onClick={onRefresh}
                        disabled={!row.video_id || refreshing}
                        title="Refetch from YouTube (shows on next open)"
                        className="grid size-6 cursor-pointer place-items-center rounded-sm text-fg-subtle transition-colors hover:bg-sunken hover:text-fg disabled:cursor-default disabled:opacity-40"
                    >
                        <LuRefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        title="Close (Esc)"
                        className="grid size-6 cursor-pointer place-items-center rounded-sm text-fg-subtle transition-colors hover:bg-sunken hover:text-fg"
                    >
                        <LuX className="size-3.5" />
                    </button>
                </div>
            </div>

            <div className="selectable min-h-0 flex-1 overflow-y-auto">
                {row.video_id ? (
                    <div className="aspect-video w-full border-b border-line bg-sunken">
                        <iframe
                            key={row.video_id}
                            src={`https://www.youtube-nocookie.com/embed/${row.video_id}`}
                            title={title}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            className="h-full w-full"
                        />
                    </div>
                ) : (
                    <div className="flex aspect-video w-full items-center justify-center border-b border-line bg-sunken text-[12px] text-fg-subtle">
                        No video ID in this entry
                    </div>
                )}

                <div className="p-3">
                    <h3 className="text-[13px] leading-snug font-semibold text-fg">
                        {row.video_url ? (
                            <a
                                href={row.video_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group inline-flex items-start gap-1 hover:text-accent-text"
                            >
                                <span>{title}</span>
                                <LuExternalLink className="mt-0.5 size-3 shrink-0 text-fg-subtle group-hover:text-accent-text" />
                            </a>
                        ) : (
                            title
                        )}
                    </h3>

                    <div className="mt-1 text-[12px] text-fg-muted">
                        {row.channel_url ? (
                            <a
                                href={row.channel_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-accent-text hover:underline"
                            >
                                {snippet?.channelTitle ?? row.channel_name ?? "Unknown channel"}
                            </a>
                        ) : (
                            snippet?.channelTitle ?? row.channel_name ?? "Unknown channel"
                        )}
                    </div>
                </div>

                <dl className="border-t border-line text-[12px]">
                    <Field
                        label="Watched"
                        value={row.timestamp != null ? new Date(row.timestamp * 1000).toLocaleString() : "-"}
                    />

                    {loading ? (
                        <div className="flex items-center gap-2 px-3 py-2 text-[12px] text-fg-muted">
                            <LuLoaderCircle className="size-3.5 animate-spin" />
                            Loading metadata
                        </div>
                    ) : video ? (
                        <>
                            <Field
                                label="Published"
                                value={snippet?.publishedAt ? new Date(snippet.publishedAt).toLocaleDateString() : "-"}
                            />
                            <Field label="Duration" value={formatDuration(video.contentDetails?.duration)} />
                            <Field label="Views" value={formatCount(video.statistics?.viewCount)} />
                            <Field label="Likes" value={formatCount(video.statistics?.likeCount)} />
                            <Field label="Comments" value={formatCount(video.statistics?.commentCount)} />
                        </>
                    ) : (
                        <div className="flex items-start gap-2 px-3 py-2.5 text-[12px] text-fg-muted">
                            <LuCircleSlash className="mt-px size-3.5 shrink-0 text-fg-subtle" />
                            <span>
                                No metadata available. This video is private, deleted, or otherwise
                                not returned by the YouTube API.
                            </span>
                        </div>
                    )}
                </dl>

                {snippet?.description && (
                    <details className="group border-t border-line">
                        <summary className="cursor-pointer list-none px-3 py-2 text-[12px] font-medium text-fg-muted select-none hover:text-fg">
                            Description
                        </summary>
                        <p className="px-3 pb-3 text-[12px] leading-relaxed whitespace-pre-wrap text-fg-muted">
                            {snippet.description}
                        </p>
                    </details>
                )}

                {snippet?.tags && snippet.tags.length > 0 && (
                    <div className="border-t border-line p-3">
                        <div className="mb-2 text-[11px] font-medium tracking-wide text-fg-subtle uppercase">
                            Tags
                        </div>
                        <div className="flex flex-wrap gap-1">
                            {snippet.tags.map((tag) => (
                                <span
                                    key={tag}
                                    className="rounded-xs bg-sunken px-1.5 py-px text-[11px] text-fg-muted ring-1 ring-line ring-inset"
                                >
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </aside>
    );
}

function Field({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-baseline justify-between gap-3 px-3 py-1.5 not-last:border-b not-last:border-line/60">
            <dt className="shrink-0 text-fg-subtle">{label}</dt>
            <dd className="tnum truncate text-fg">{value}</dd>
        </div>
    );
}
