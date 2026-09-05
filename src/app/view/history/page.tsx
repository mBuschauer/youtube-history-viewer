"use client";
import React, { useState, useCallback } from "react";
import VideoGrid from "./_components/VideoGrid";
import VideoPanel from "./_components/VideoPanel";

import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import type { DatasetMetadata, DatasetStatus } from "@/lib/types";
import { useSettings } from "@/contexts/SettingsContext";
import { HydrationStage, type Selection } from "./_components/types";
import Link from "next/link";
import StatusPill from "@/components/StatusPill";
import StatePane, { paneActionClass } from "@/components/StatePane";

import { LuLoaderCircle, LuDatabase, LuCloudDownload, LuFolderOpen, LuSearch, LuX, LuKeyRound, LuTriangleAlert, LuClock, LuChevronLeft } from "react-icons/lu";

const backToDatasets = (
    <Link href="/" className={paneActionClass}>
        <LuChevronLeft aria-hidden className="size-3.5" />
        All datasets
    </Link>
);

const uuidv4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function Page() {
    const id = useSearchParams().get("id");

    const { settings, loading } = useSettings();

    const [stage, setStage] = useState<HydrationStage>(HydrationStage.None);
    const [doneStage, setDoneStage] = useState<HydrationStage>(HydrationStage.None);
    const [isHydrating, setIsHydrating] = useState(false);
    const [hydratingStatusText, setHydratingStatusText] = useState("Starting...");

    const [selected, setSelected] = useState<Selection | null>(null);

    const [progressTotal, setProgressTotal] = useState(0);
    const [progressCurrent, setProgressCurrent] = useState(0);
    const [quickFilter, setQuickFilter] = useState("");

    const [shownRows, setShownRows] = useState(0);
    const [totalRows, setTotalRows] = useState(0);

    const validId = !!id && uuidv4Regex.test(id);

    const localRunning = isHydrating && doneStage < HydrationStage.Local;
    const remoteRunning = isHydrating && doneStage >= HydrationStage.Local && stage >= HydrationStage.Remote;

    const statusQuery = useQuery<DatasetStatus>({
        queryKey: ["status", id],
        queryFn: () => invoke<DatasetStatus>("get_dataset_status", { id }),
        // Poll only while the dataset is still being processed
        refetchInterval: (query) => {
            const status = query.state.data;
            return status === "parsed" || status === "complete" ? false : 3000;
        },
    });

    const datasetQuery = useQuery<DatasetMetadata>({
        queryKey: ["dataset", id],
        queryFn: () => invoke<DatasetMetadata>("get_dataset", { id }),
        enabled: false,
    });

    const closePanel = useCallback(() => setSelected(null), []);
    const onCounts = useCallback((shown: number, total: number) => {
        setShownRows(shown);
        setTotalRows(total);
    }, []);

    if (!id) return <StatePane icon={LuDatabase} title="No dataset selected" body="Choose a dataset from the Datasets list." action={backToDatasets} />;
    if (!validId) return <StatePane icon={LuTriangleAlert} tone="bad" title="Invalid dataset ID" body="That link does not point at a dataset this app can open." action={backToDatasets} />;
    if (loading) return <StatePane icon={LuLoaderCircle} spin title="Checking for API key" />;

    if (!settings.YouTubeApiKey) {
        return (
            <StatePane
                icon={LuKeyRound}
                title="API key required"
                body="Video metadata comes from the YouTube Data API. A key is free and takes about two minutes to create."
                action={
                    <Link
                        href="/settings"
                        className="inline-flex h-7 items-center rounded-md bg-accent px-3 text-[12px] font-medium text-on-accent transition-colors hover:bg-accent-hover"
                    >
                        Open Settings
                    </Link>
                }
            />
        );
    }

    const status = statusQuery.data;
    const datasetName = datasetQuery.data?.name;
    const parsing = status === "parsing";
    const queued = status === "uploaded";
    const failed = status === "failed";
    const ready = status === "parsed" || status === "complete";

    const openFolder = async () => { await invoke("open_location", { id }); };

    return (
        <div className="flex h-full flex-col">
            <div className="chrome flex h-9 shrink-0 items-center gap-2 border-b border-line bg-canvas px-2.5">
                <div className="flex min-w-0 items-center gap-1">
                    <Link
                        href="/"
                        title="Back to all datasets"
                        className="inline-flex h-6 shrink-0 items-center gap-0.5 rounded-sm pr-1.5 pl-1 text-[12px] text-fg-muted transition-colors hover:bg-sunken hover:text-fg"
                    >
                        <LuChevronLeft aria-hidden className="size-3.5" />
                        Datasets
                    </Link>
                    <span className="shrink-0 text-fg-subtle" aria-hidden>/</span>
                    <span className="max-w-56 truncate text-[12px] font-medium text-fg">
                        {datasetName ?? "Watch history"}
                    </span>
                </div>
                {status && <StatusPill status={status} />}

                <span className="mx-1 h-4 w-px bg-line" aria-hidden />

                <ToolbarButton
                    icon={localRunning ? LuLoaderCircle : LuDatabase}
                    spin={localRunning}
                    label="Local"
                    title="Load video metadata already cached on this machine"
                    disabled={!ready || stage >= HydrationStage.Local}
                    onClick={() => setStage(HydrationStage.Local)}
                />
                <ToolbarButton
                    icon={remoteRunning ? LuLoaderCircle : LuCloudDownload}
                    spin={remoteRunning}
                    label="YouTube"
                    title="Fetch whatever the local cache is missing from the YouTube API"
                    disabled={!ready || stage >= HydrationStage.Remote}
                    onClick={() => setStage(HydrationStage.Remote)}
                />

                <span className="mx-1 h-4 w-px bg-line" aria-hidden />

                <ToolbarButton
                    icon={LuFolderOpen}
                    label="Folder"
                    title="Open this dataset's folder on disk"
                    onClick={openFolder}
                />

                <div className="relative ml-auto">
                    <LuSearch
                        aria-hidden
                        className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-fg-subtle"
                    />
                    <input
                        type="text"
                        placeholder="Search titles and channels"
                        aria-label="Search history"
                        value={quickFilter}
                        disabled={!ready}
                        onChange={(e) => setQuickFilter(e.target.value)}
                        className="h-6 w-64 rounded-sm border border-line-strong bg-surface pr-6 pl-7 select-text text-[12px] text-fg placeholder:text-fg-subtle focus:border-focus focus:outline-none disabled:opacity-50"
                    />
                    {quickFilter && (
                        <button
                            type="button"
                            onClick={() => setQuickFilter("")}
                            aria-label="Clear search"
                            className="absolute top-1/2 right-1 grid size-4 -translate-y-1/2 cursor-pointer place-items-center rounded-xs text-fg-subtle transition-colors hover:bg-sunken hover:text-fg"
                        >
                            <LuX className="size-3" />
                        </button>
                    )}
                </div>
            </div>

            {/* Body */}
            <div className="flex min-h-0 flex-1">
                {queued && (
                    <StatePane
                        icon={LuClock}
                        title="Queued for parsing"
                        body="This dataset has been imported and is waiting to be read into the local database."
                    />
                )}

                {parsing && (
                    <StatePane
                        icon={LuLoaderCircle}
                        spin
                        title="Parsing watch history"
                        body="Reading the export into the local database. This runs once per import, and a large history can take a few minutes."
                    />
                )}

                {failed && (
                    <StatePane
                        icon={LuTriangleAlert}
                        tone="bad"
                        title="Parsing failed"
                        body="This export could not be read into the local database. The raw file is still on disk, unchanged."
                        action={
                            <button
                                type="button"
                                onClick={openFolder}
                                className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-line bg-surface px-3 text-[12px] font-medium text-fg transition-colors hover:bg-sunken"
                            >
                                <LuFolderOpen className="size-3.5" />
                                Open dataset folder
                            </button>
                        }
                    />
                )}

                {ready && (
                    <>
                        <div className="min-w-0 flex-1">
                            <VideoGrid
                                id={id}
                                apiKey={settings.YouTubeApiKey}
                                quickFilter={quickFilter}
                                hydrationStage={stage}
                                onStageDone={setDoneStage}
                                setSelected={setSelected}
                                setIsHydrating={setIsHydrating}
                                setHydratingStatusText={setHydratingStatusText}
                                setProgressTotal={setProgressTotal}
                                setProgressCurrent={setProgressCurrent}
                                onCounts={onCounts}
                            />
                        </div>

                        {selected && (
                            <VideoPanel
                                row={selected.row}
                                video={selected.video}
                                loading={selected.loading}
                                onClose={closePanel}
                            />
                        )}
                    </>
                )}

                {!status && (
                    <StatePane icon={LuLoaderCircle} spin title="Opening dataset" />
                )}
            </div>

            {/* Status bar */}
            <div className="chrome flex h-6 shrink-0 items-center gap-3 border-t border-line bg-canvas px-2.5 text-[11px] text-fg-muted">
                <span className="tnum">
                    {ready
                        ? shownRows === totalRows
                            ? `${totalRows.toLocaleString()} rows`
                            : `${shownRows.toLocaleString()} of ${totalRows.toLocaleString()} rows`
                        : "No rows loaded"}
                </span>

                {isHydrating && (
                    <div className="ml-auto flex items-center gap-2">
                        <span className="truncate">{hydratingStatusText}</span>
                        <div
                            className="h-1 w-28 overflow-hidden rounded-full bg-sunken"
                            role="progressbar"
                            aria-valuenow={progressCurrent}
                            aria-valuemin={0}
                            aria-valuemax={progressTotal}
                        >
                            <div
                                className="h-full bg-accent transition-[width] duration-300 ease-out"
                                style={{
                                    width: progressTotal > 0
                                        ? `${Math.min(100, (progressCurrent / progressTotal) * 100)}%`
                                        : "0%",
                                }}
                            />
                        </div>
                        <span className="tnum">
                            {progressCurrent.toLocaleString()} / {progressTotal.toLocaleString()}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}

function ToolbarButton({
    icon: Icon,
    label,
    title,
    onClick,
    disabled,
    spin,
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    title: string;
    onClick: () => void;
    disabled?: boolean;
    spin?: boolean;
}) {
    return (
        <button
            type="button"
            title={title}
            onClick={onClick}
            disabled={disabled}
            className="inline-flex h-6 cursor-pointer items-center gap-1.5 rounded-sm px-2 text-[12px] text-fg-muted transition-colors hover:bg-sunken hover:text-fg disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-fg-muted"
        >
            <Icon className={"size-3.5" + (spin ? " animate-spin" : "")} />
            {label}
        </button>
    );
}
