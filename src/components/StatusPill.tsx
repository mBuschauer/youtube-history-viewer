import type { DatasetStatus } from "@/lib/types";

/**
 * A dataset's lifecycle state. `failed` must never read as a neutral idle
 * state, so it takes the danger role rather than sharing the gray one.
 */
const STATUS_ROLE: Record<DatasetStatus, string> = {
    complete: "bg-ok-soft text-ok ring-ok-line",
    parsed: "bg-ok-soft text-ok ring-ok-line",
    parsing: "bg-accent-soft text-accent-text ring-accent-line",
    uploaded: "bg-sunken text-fg-muted ring-line",
    failed: "bg-bad-soft text-bad ring-bad-line",
};

const STATUS_LABEL: Record<DatasetStatus, string> = {
    complete: "Complete",
    parsed: "Parsed",
    parsing: "Parsing",
    uploaded: "Queued",
    failed: "Failed",
};

export default function StatusPill({ status }: { status: DatasetStatus }) {
    return (
        <span
            className={
                "inline-flex shrink-0 items-center rounded-xs px-1.5 py-px text-[11px] font-medium ring-1 ring-inset " +
                (STATUS_ROLE[status] ?? STATUS_ROLE.uploaded)
            }
        >
            {STATUS_LABEL[status] ?? status}
        </span>
    );
}
