import React from "react";

export const paneActionClass =
    "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-line bg-surface px-3 text-[12px] font-medium text-fg transition-colors hover:bg-sunken";

interface props {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    body?: string;
    action?: React.ReactNode;
    tone?: "neutral" | "bad";
    spin?: boolean;
}

export default function StatePane({ icon: Icon, title, body, action, tone = "neutral", spin = false }: props) {
    return (
        <div className="flex h-full w-full items-center justify-center p-8">
            <div className="flex max-w-sm flex-col items-center text-center">
                <Icon className={"size-6 " + (tone === "bad" ? "text-bad" : "text-fg-subtle") + (spin ? " animate-spin" : "")}/>
                <h2 className="mt-3 text-[13px] font-semibold text-fg">{title}</h2>
                {body && (
                    <p className="mt-1.5 text-[12px] leading-relaxed text-fg-muted">{body}</p>
                )}
                {action && <div className="mt-4">{action}</div>}
            </div>
        </div>
    );
}
