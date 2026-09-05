"use client";
import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LuX } from "react-icons/lu";

/**
 * True when the OS is not drawing a title bar for us. On Linux tiling
 * compositors the Rust side turns decorations off at startup; everywhere else
 * the native title bar stays and already carries a close control.
 */
export function useUndecorated(): boolean {
    const [undecorated, setUndecorated] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const decorated = await getCurrentWindow().isDecorated();
                if (!cancelled) setUndecorated(!decorated);
            } catch {
                // Not in a Tauri window, or the permission is unavailable:
                // assume the platform is drawing its own chrome.
            }
        })();
        return () => { cancelled = true; };
    }, []);

    return undecorated;
}

export default function CloseWindowButton() {
    return (
        <button
            type="button"
            onClick={() => getCurrentWindow().close()}
            title="Close window"
            aria-label="Close window"
            className="grid size-7 cursor-pointer place-items-center rounded-md text-fg-muted transition-colors hover:bg-bad-solid hover:text-white"
        >
            <LuX aria-hidden className="size-3.5" />
        </button>
    );
}
