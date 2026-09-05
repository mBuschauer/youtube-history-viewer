import { useState, useEffect, useRef, useMemo, useCallback, type Dispatch, type SetStateAction } from "react";
import { useQuery } from "@tanstack/react-query";
import { AgGridReact, CustomCellRendererProps } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, themeQuartz, ColDef, GridReadyEvent, RowClickedEvent, ModelUpdatedEvent } from "ag-grid-community";
import { invoke } from "@tauri-apps/api/core";
import { HistoryRow, LocalVideosResponse, VideoEntry, formatDuration, nextStage, type Selection, HydrationStage } from "./types";


ModuleRegistry.registerModules([AllCommunityModule]);

const consoleGridTheme = themeQuartz.withParams({
    browserColorScheme: "inherit",
    backgroundColor: "var(--app-surface)",
    foregroundColor: "var(--app-fg)",
    borderColor: "var(--app-line)",
    chromeBackgroundColor: "var(--app-canvas)",
    headerBackgroundColor: "var(--app-canvas)",
    headerTextColor: "var(--app-fg-muted)",
    headerFontSize: 11,
    headerFontWeight: 600,
    accentColor: "var(--app-accent)",
    rowHoverColor: "var(--app-sunken)",
    selectedRowBackgroundColor: "var(--app-accent-soft)",
    fontFamily: "var(--font-sans)",
    fontSize: 13,
    cellHorizontalPadding: 12,
    wrapperBorder: false,
    wrapperBorderRadius: 0,
    inputBackgroundColor: "var(--app-surface)",
    inputBorder: { color: "var(--app-line)" },
    inputFocusBorder: { color: "var(--app-focus)" },
});

interface HistoryProps {
    id: string;
    apiKey: string;
    quickFilter: string;
    hydrationStage: HydrationStage;
    onStageDone?: (stage: HydrationStage) => void;
    setSelected: Dispatch<SetStateAction<Selection | null>>;
    setIsHydrating: Dispatch<SetStateAction<boolean>>;
    setHydratingStatusText: Dispatch<SetStateAction<string>>;
    setProgressTotal: Dispatch<SetStateAction<number>>;
    setProgressCurrent: Dispatch<SetStateAction<number>>;
    onCounts?: (shown: number, total: number) => void;
}

function ThumbnailRenderer(props: CustomCellRendererProps<HistoryRow>) {
    const videoId = props.data?.video_id;
    if (!videoId) {
        return (
            <div className="h-15 w-26.75 rounded-xs bg-sunken ring-1 ring-line ring-inset" />
        );
    }
    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={`https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`}
            alt=""
            loading="lazy"
            className="h-15 w-26.75 rounded-xs bg-sunken object-cover ring-1 ring-line ring-inset"
        />
    );
}

export default function VideoGrid({ id, apiKey, quickFilter, hydrationStage, onStageDone, setSelected, setIsHydrating, setHydratingStatusText, setProgressTotal, setProgressCurrent, onCounts }: HistoryProps) {
    const gridRef = useRef<AgGridReact<HistoryRow>>(null);

    const [gridReady, setGridReady] = useState(false);
    const [rowsLoaded, setRowsLoaded] = useState(false);
    const rowsLoadedRef = useRef(false);

    const videoMapRef = useRef<Map<string, VideoEntry>>(new Map());
    const unavailableRef = useRef<Set<string>>(new Set());
    const rowsByVideoIdRef = useRef<Map<string, HistoryRow[]>>(new Map());
    const pendingRef = useRef<Set<string>>(new Set());

    const [rowData, setRowData] = useState<HistoryRow[] | null>(null);
    const totalRowsRef = useRef(0);

    const apiKeyRef = useRef(apiKey);
    useEffect(() => { apiKeyRef.current = apiKey; }, [apiKey]);

    const onStageDoneRef = useRef(onStageDone);
    useEffect(() => { onStageDoneRef.current = onStageDone; }, [onStageDone]);

    const historyQuery = useQuery<HistoryRow[]>({
        queryKey: ["history", id],
        queryFn: () => invoke<HistoryRow[]>("get_dataset_history", { id }),
    });

    const getRowId = useCallback(
        (params: { data: HistoryRow }) => String(params.data.id),
        []
    );


    const columnDefs = useMemo<ColDef<HistoryRow>[]>(() => [
        {
            colId: "thumbnail",
            headerName: "",
            width: 125,
            sortable: false,
            filter: false,
            resizable: false,
            cellRenderer: ThumbnailRenderer,
        },
        {
            field: "video_title",
            headerName: "Title",
            flex: 2,
            minWidth: 200,
            filter: "agTextColumnFilter",
        },
        {
            field: "channel_name",
            headerName: "Channel",
            flex: 1,
            minWidth: 140,
            filter: "agTextColumnFilter",
        },
        {
            field: "timestamp",
            headerName: "Watched",
            width: 190,
            sort: "desc",
            filter: "agDateColumnFilter",
            cellClass: "tnum",
            filterParams: {
                comparator: (filterDate: Date, cellValue: number | null) => {
                    if (cellValue == null) return -1;
                    const cellDate = new Date(cellValue * 1000);
                    cellDate.setHours(0, 0, 0, 0);
                    const diff = cellDate.getTime() - filterDate.getTime();
                    return diff === 0 ? 0 : diff > 0 ? 1 : -1;
                },
            },
            valueFormatter: (params) =>
                params.value != null
                    ? new Date(params.value * 1000).toLocaleString()
                    : "-",
        },
        {
            // Pending and unavailable are different facts and must not look alike:
            // "..." means not fetched yet, "-" means the API has no value for it.
            field: "duration",
            headerName: "Duration",
            width: 120,
            filter: "agNumberColumnFilter",
            type: "rightAligned",
            cellClass: "tnum",
            // Inline, not a utility class: AG Grid injects its own stylesheet at
            // runtime, so a Tailwind color class on `.ag-cell` is a specificity
            // coin-flip. cellStyle always wins.
            cellStyle: (params) =>
                params.data?.enriched ? null : { color: "var(--app-fg-subtle)" },
            valueFormatter: (params) =>
                params.data?.enriched
                    ? (params.value != null ? formatDuration(params.value) : "-")
                    : "...",
        },
        {
            field: "views",
            headerName: "Views",
            width: 130,
            filter: "agNumberColumnFilter",
            type: "rightAligned",
            cellClass: "tnum",
            // Inline, not a utility class: AG Grid injects its own stylesheet at
            // runtime, so a Tailwind color class on `.ag-cell` is a specificity
            // coin-flip. cellStyle always wins.
            cellStyle: (params) =>
                params.data?.enriched ? null : { color: "var(--app-fg-subtle)" },
            valueFormatter: (params) => {
                if (!params.data?.enriched) return "...";
                return params.value != null ? Number(params.value).toLocaleString() : "-";
            },
        },
    ], []);

    const defaultColDef = useMemo<ColDef<HistoryRow>>(() => ({
        sortable: true,
        resizable: true,
        floatingFilter: true,
        unSortIcon: true,
    }), []);

    const applyVideos = useCallback((videos: VideoEntry[]) => {
        const updates: HistoryRow[] = [];
        for (const video of videos) {
            videoMapRef.current.set(video.id, video);
            pendingRef.current.delete(video.id);
            const rows = rowsByVideoIdRef.current.get(video.id) ?? [];
            for (const row of rows) {
                updates.push({
                    ...row,
                    duration: video.contentDetails?.duration,
                    views: video.statistics?.viewCount != null
                        ? Number(video.statistics.viewCount)
                        : undefined,
                    enriched: true,
                });
            }
        }
        if (gridRef.current?.api && updates.length > 0) {
            gridRef.current.api.applyTransactionAsync({ update: updates });
        }
    }, []);

    const markUnavailable = useCallback((videoIds: string[]) => {
        const updates: HistoryRow[] = [];
        for (const vid of videoIds) {
            unavailableRef.current.add(vid);
            pendingRef.current.delete(vid);
            for (const row of rowsByVideoIdRef.current.get(vid) ?? []) {
                updates.push({ ...row, enriched: true });
            }
        }
        if (gridRef.current?.api && updates.length > 0) {
            gridRef.current.api.applyTransactionAsync({ update: updates });
        }
    }, []);

    const hydrateLocal = useCallback(async () => {
        const ids = Array.from(pendingRef.current);
        if (ids.length === 0) return;

        setIsHydrating(true);
        setHydratingStatusText("Checking local database...");
        setProgressTotal(ids.length);
        setProgressCurrent(0);

        for (let i = 0; i < ids.length; i += 500) {
            const chunk = ids.slice(i, i + 500);
            const before = pendingRef.current.size;
            try {
                const { videos, missing } = await invoke<LocalVideosResponse>(
                    "get_local_videos",
                    { ids: chunk }
                );
                applyVideos(videos);
                markUnavailable(missing ?? []);
                setProgressCurrent((p) => p + (before - pendingRef.current.size));
            } catch (err) {
                // chunk stays pending, so the remote stage will pick it up
                console.error("Local video lookup failed:", err);
            }
        }

        const remaining = pendingRef.current.size;
        setHydratingStatusText(
            remaining > 0
                ? `${remaining} videos not found locally`
                : "Complete!"
        );
        setIsHydrating(false);
    }, [applyVideos, markUnavailable, setIsHydrating, setHydratingStatusText, setProgressTotal, setProgressCurrent]);

    const hydrateRemote = useCallback(async () => {
        const key = apiKeyRef.current;
        const ids = Array.from(pendingRef.current);
        if (ids.length === 0) return;
        if (!key) {
            setHydratingStatusText("No API key configured.");
            return;
        }

        setIsHydrating(true);
        setHydratingStatusText("Fetching missing data from YouTube API...");
        setProgressTotal(ids.length);
        setProgressCurrent(0);

        for (let i = 0; i < ids.length; i += 50) {
            const chunk = ids.slice(i, i + 50);
            try {
                const videos = await invoke<VideoEntry[]>("get_videos", {
                    ids: chunk,
                    apiKey: key,
                });
                applyVideos(videos);
                const returned = new Set(videos.map((v) => v.id));
                markUnavailable(chunk.filter((vid) => !returned.has(vid)));
            } catch (err) {
                console.error("External API fetch failed:", err);
            }
            setProgressCurrent((p) => Math.min(p + chunk.length, ids.length));
        }

        setHydratingStatusText("Complete!");
        setTimeout(() => setIsHydrating(false), 2500);
    }, [applyVideos, markUnavailable, setIsHydrating, setHydratingStatusText, setProgressTotal, setProgressCurrent]);

    // Load rows and seed the pending set. Runs regardless of hydrationStage.
    useEffect(() => {
        if (!historyQuery.data || !gridReady || rowsLoadedRef.current) return;
        rowsLoadedRef.current = true;

        const initialData: HistoryRow[] = historyQuery.data.map((item) => ({
            ...item,
            enriched: false,
        }));

        const byVideoId = new Map<string, HistoryRow[]>();
        for (const row of initialData) {
            if (!row.video_id) continue;
            const list = byVideoId.get(row.video_id);
            if (list) list.push(row);
            else byVideoId.set(row.video_id, [row]);
        }
        rowsByVideoIdRef.current = byVideoId;
        pendingRef.current = new Set(byVideoId.keys());

        totalRowsRef.current = initialData.length;
        setRowData(initialData);
        setRowsLoaded(true);
    }, [historyQuery.data, gridReady]);

    // Stage runner: walks doneStage up to whatever the parent asked for.
    const targetRef = useRef<HydrationStage>(HydrationStage.None);
    const doneStageRef = useRef<HydrationStage>(HydrationStage.None);
    const runningRef = useRef(false);

    useEffect(() => {
        targetRef.current = hydrationStage;
        if (!rowsLoaded || runningRef.current) return;
        if (hydrationStage <= doneStageRef.current) return;

        runningRef.current = true;
        (async () => {
            try {
                for (
                    let next = nextStage(doneStageRef.current);
                    next !== null && next <= targetRef.current;
                    next = nextStage(doneStageRef.current)
                ) {
                    switch (next) {
                        case HydrationStage.Local:
                            await hydrateLocal();
                            break;
                        case HydrationStage.Remote:
                            await hydrateRemote();
                            break;
                    }
                    doneStageRef.current = next;
                    onStageDoneRef.current?.(next);
                }
            } finally {
                runningRef.current = false;
            }
        })();
    }, [hydrationStage, rowsLoaded, hydrateLocal, hydrateRemote]);

    const onGridReady = useCallback((_event: GridReadyEvent) => {
        setGridReady(true);
    }, []);

    // Display-only: the status bar reports what the filters kept out of the whole.
    const onCountsRef = useRef(onCounts);
    useEffect(() => { onCountsRef.current = onCounts; }, [onCounts]);

    const onModelUpdated = useCallback((event: ModelUpdatedEvent<HistoryRow>) => {
        onCountsRef.current?.(event.api.getDisplayedRowCount(), totalRowsRef.current);
    }, []);

    const onRowClicked = useCallback(async (event: RowClickedEvent<HistoryRow>) => {
        const row = event.data;
        if (!row) return;

        const cached = row.video_id ? videoMapRef.current.get(row.video_id) : null;
        const knownUnavailable =
            !!row.video_id && unavailableRef.current.has(row.video_id);
        const needsFetch = !!row.video_id && !cached && !knownUnavailable && !!apiKey;
        setSelected({ row, video: cached ?? null, loading: needsFetch });

        if (needsFetch && row.video_id) {
            try {
                const videos = await invoke<VideoEntry[]>("get_videos", {
                    ids: [row.video_id],
                    apiKey: apiKey,
                });
                if (videos.length > 0) applyVideos(videos);
                else markUnavailable([row.video_id]);
                setSelected((prev) =>
                    prev && prev.row.id === row.id
                        ? { row: prev.row, video: videos[0] ?? null, loading: false }
                        : prev
                );
            } catch (err) {
                console.error("Video detail fetch failed:", err);
                setSelected((prev) =>
                    prev && prev.row.id === row.id ? { ...prev, loading: false } : prev
                );
            }
        }
    }, [apiKey, applyVideos, markUnavailable, setSelected]);

    return (
        <AgGridReact<HistoryRow>
            ref={gridRef}
            theme={consoleGridTheme}
            rowData={rowData}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            getRowId={getRowId}
            rowHeight={70}
            quickFilterText={quickFilter}
            onGridReady={onGridReady}
            onRowClicked={onRowClicked}
            onModelUpdated={onModelUpdated}
            asyncTransactionWaitMillis={250}
            overlayLoadingTemplate={
                '<span style="color: var(--app-fg-muted); font-size: 12px;">Reading history from the local database...</span>'
            }
            overlayNoRowsTemplate={
                '<span style="color: var(--app-fg-subtle); font-size: 12px;">No rows match the current filters</span>'
            }
        />
    );

}