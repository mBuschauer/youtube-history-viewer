import React from "react";

/** Shared styling for a pane's recovery action, so dead ends look alike. */
export const paneActionClass =
    "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-line bg-surface px-3 text-[12px] font-medium text-fg transition-colors hover:bg-sunken";

/**
 * The empty, waiting and failed faces of a pane. Every one of these states is
 * a normal condition of a historical archive, so they read as information
 * rather than as breakage; only `tone="bad"` claims the danger role.
 */
export default function StatePane({
    icon: Icon,
    title,
    body,
    action,
    tone = "neutral",
    spin = false,
}: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    body?: string;
    action?: React.ReactNode;
    tone?: "neutral" | "bad";
    spin?: boolean;
}) {
    return (
        <div className="flex h-full w-full items-center justify-center p-8">
            <div className="flex max-w-sm flex-col items-center text-center">
                <Icon
                    aria-hidden
                    className={
                        "size-6 " +
                        (tone === "bad" ? "text-bad" : "text-fg-subtle") +
                        (spin ? " animate-spin" : "")
                    }
                />
                <h2 className="mt-3 text-[13px] font-semibold text-fg">{title}</h2>
                {body && (
                    <p className="mt-1.5 text-[12px] leading-relaxed text-fg-muted">{body}</p>
                )}
                {action && <div className="mt-4">{action}</div>}
            </div>
        </div>
    );
}
