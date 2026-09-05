'use client';

import React, { useEffect, useState } from 'react';
import { useSettings } from "@/contexts/SettingsContext";
import { invoke } from '@tauri-apps/api/core';
import StatePane from '@/components/StatePane';
import { LuLoaderCircle, LuEye, LuEyeOff, LuFolderOpen, LuGithub, LuTriangleAlert, LuCircleCheck } from 'react-icons/lu';

type Message = { tone: 'ok' | 'bad'; text: string };

export default function SettingsPage() {
    const { settings, loading, updateSettings } = useSettings();
    const [draft, setDraft] = useState<string>("");
    const [showKey, setShowKey] = useState<boolean>(false);
    const [message, setMessage] = useState<Message | null>(null);

    useEffect(() => {
        setDraft(settings.YouTubeApiKey ?? "");
    }, [settings.YouTubeApiKey]);

    const hasStoredKey = settings.YouTubeApiKey !== null;

    const handleSave = async (e: React.SubmitEvent<HTMLFormElement>) => {
        e.preventDefault();
        const trimmed = draft.trim();
        if (!trimmed) {
            setMessage({ tone: 'bad', text: "API key cannot be empty." });
            return;
        }

        try {
            await updateSettings({ YouTubeApiKey: trimmed });
            setMessage({ tone: 'ok', text: "API key saved." });
        } catch {
            setMessage({ tone: 'bad', text: "Failed to save the API key." });
        }
    };

    const handleRemove = async () => {
        try {
            await updateSettings({ YouTubeApiKey: null });
            setDraft("");
            setMessage({ tone: 'ok', text: "API key removed." });
        } catch {
            setMessage({ tone: 'bad', text: "Failed to remove the API key." });
        }
    };

    if (loading) {
        return (
            <div className="flex h-full flex-col">
                <SettingsHeader />
                <StatePane icon={LuLoaderCircle} spin title="Loading settings" />
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col">
            <SettingsHeader />

            <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="mx-auto max-w-lg px-4 py-6">
                    <form onSubmit={handleSave}>
                        <Section
                            title="YouTube Data API key"
                            description="Used to fetch video metadata: duration, view counts, publish dates, descriptions and tags. A key is free and takes about two minutes to create in the Google Cloud console."
                        >
                            <div className="flex gap-2">
                                <input
                                    id="api-key"
                                    type={showKey ? "text" : "password"}
                                    value={draft}
                                    onChange={(e) => setDraft(e.target.value)}
                                    placeholder="AIza..."
                                    spellCheck={false}
                                    autoComplete="off"
                                    className="h-7 w-full rounded-sm border border-line-strong bg-surface px-2 font-mono text-[11px] text-fg placeholder:text-fg-subtle focus:border-focus focus:outline-none"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowKey((v) => !v)}
                                    title={showKey ? "Hide key" : "Show key"}
                                    className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-sm border border-line-strong bg-surface text-fg-muted transition-colors hover:bg-sunken hover:text-fg"
                                >
                                    {showKey ? <LuEyeOff className="size-3.5" /> : <LuEye className="size-3.5" />}
                                </button>
                            </div>

                            <p className="mt-2 flex items-start gap-1.5 text-[11px] text-fg-subtle">
                                <LuTriangleAlert className="mt-px size-3 shrink-0 text-warn" />
                                <span>
                                    Stored in plaintext on this machine.
                                    {hasStoredKey && " A key is currently saved."}
                                </span>
                            </p>

                            {message && (
                                <div
                                    className={
                                        "mt-3 flex items-start gap-1.5 rounded-sm border px-2.5 py-2 text-[12px] " +
                                        (message.tone === 'ok'
                                            ? "border-ok-line bg-ok-soft text-ok"
                                            : "border-bad-line bg-bad-soft text-bad")
                                    }
                                >
                                    {message.tone === 'ok'
                                        ? <LuCircleCheck className="mt-px size-3.5 shrink-0" />
                                        : <LuTriangleAlert className="mt-px size-3.5 shrink-0" />}
                                    <span>{message.text}</span>
                                </div>
                            )}

                            <div className="mt-4 flex gap-2">
                                <button
                                    type="submit"
                                    className="h-7 cursor-pointer rounded-md bg-accent px-3 text-[12px] font-medium text-on-accent transition-colors hover:bg-accent-hover"
                                >
                                    Save
                                </button>
                                <button
                                    type="button"
                                    onClick={handleRemove}
                                    disabled={!hasStoredKey}
                                    className="h-7 cursor-pointer rounded-md border border-line bg-surface px-3 text-[12px] font-medium text-fg transition-colors hover:bg-sunken disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Remove
                                </button>
                            </div>
                        </Section>
                    </form>

                    <Section
                        title="Storage"
                        description="Datasets, the shared video metadata cache, and this settings file all live in one folder on this machine. Nothing is uploaded anywhere."
                    >
                        <button
                            type="button"
                            onClick={async () => { await invoke('open_location'); }}
                            className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-line bg-surface px-3 text-[12px] font-medium text-fg transition-colors hover:bg-sunken"
                        >
                            <LuFolderOpen className="size-3.5" />
                            Open app folder
                        </button>
                    </Section>

                    <Section title="About">
                        <a
                            href="https://github.com/mBuschauer/youtube-history-viewer"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-line bg-surface px-3 text-[12px] font-medium text-fg transition-colors hover:bg-sunken"
                        >
                            <LuGithub className="size-3.5" />
                            Source on GitHub
                        </a>
                    </Section>
                </div>
            </div>
        </div>
    );
}

function SettingsHeader() {
    return (
        <div className="chrome flex h-9 shrink-0 items-center border-b border-line bg-canvas px-2.5">
            <span className="text-[12px] font-medium text-fg">Settings</span>
        </div>
    );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode; }) {
    return (
        <section className="border-b border-line py-5 first:pt-0 last:border-b-0">
            <h2 className="text-[12px] font-semibold text-fg">{title}</h2>
            {description && (
                <p className="mt-1 text-[12px] leading-relaxed text-fg-muted">{description}</p>
            )}
            <div className="mt-3">{children}</div>
        </section>
    );
}
