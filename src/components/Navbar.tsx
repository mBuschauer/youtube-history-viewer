"use client";
import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LuSun, LuMoon } from "react-icons/lu";
import CloseWindowButton, { useUndecorated } from "./CloseWindowButton";

const TABS = [
    { href: "/", label: "Datasets", match: (p: string) => p === "/" || p.startsWith("/view") || p === "/upload" },
    { href: "/settings", label: "Settings", match: (p: string) => p.startsWith("/settings") },
];

export default function NavBar() {
    const pathname = usePathname() ?? "/";
    const undecorated = useUndecorated();

    return (
        <header className="chrome flex h-9 shrink-0 items-center gap-3 border-b border-line bg-canvas px-2.5">
            <span className="text-[12px] font-semibold tracking-tight text-fg-muted">
                YouTube History Viewer
            </span>

            <nav className="flex items-center gap-0.5 rounded-md bg-sunken p-0.5">
                {TABS.map((tab) => {
                    const active = tab.match(pathname);
                    return (
                        <Link
                            key={tab.href}
                            href={tab.href}
                            aria-current={active ? "page" : undefined}
                            className={
                                "rounded-sm px-2.5 py-0.75 text-[12px] font-medium transition-colors " +
                                (active
                                    ? "bg-surface text-fg ring-1 ring-line"
                                    : "text-fg-muted hover:text-fg")
                            }
                        >
                            {tab.label}
                        </Link>
                    );
                })}
            </nav>

            <div className="ml-auto flex items-center gap-1">
                <ThemeToggle />
                {undecorated && <CloseWindowButton />}
            </div>
        </header>
    );
}

function ThemeToggle() {
    // Avoid rendering a theme-dependent state during hydration.
    const isHydrated = useSyncExternalStore(
        () => () => { },
        () => true,     // client
        () => false     // server / hydration
    );
    const { resolvedTheme, setTheme } = useTheme();

    const isDark = resolvedTheme === "dark";

    const toggle = () => {
        if (!isHydrated) return;
        setTheme(isDark ? "light" : "dark");
    };

    return (
        <button
            type="button"
            onClick={toggle}
            title={isDark ? "Switch to light theme" : "Switch to dark theme"}
            aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
            className="grid size-7 cursor-pointer place-items-center rounded-md text-fg-muted transition-colors hover:bg-sunken hover:text-fg"
        >
            {/* Swapped by CSS so the first paint is correct without waiting on
                hydration, and with no crossfade that could show neither icon. */}
            <LuSun aria-hidden className="size-3.5 dark:hidden" />
            <LuMoon aria-hidden className="hidden size-3.5 dark:block" />
        </button>
    );
}
