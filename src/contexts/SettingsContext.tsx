"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { load, type Store } from "@tauri-apps/plugin-store";
import { invoke } from '@tauri-apps/api/core';

export type UserSettings = {
    YouTubeApiKey: string | null;
};

const DEFAULT_SETTINGS: UserSettings = {
    YouTubeApiKey: null
};

type SettingsContextType = {
    settings: UserSettings;
    loading: boolean;
    updateSettings: (patch: Partial<UserSettings>) => Promise<void>;
};

const SettingsContext = createContext<SettingsContextType | null>(null);

let storePromise: Promise<Store> | null = null;
function getStore(): Promise<Store> {
    if (!storePromise) {
        storePromise = (async () => {
            const loc: string = await invoke("settings_location");
            return load(loc, { autoSave: true });
        })();
    }
    return storePromise;
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
    const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
    const [loading, setLoading] = useState(true);

    const settingsRef = useRef(settings);
    settingsRef.current = settings;

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const store = await getStore();
                const entries = await store.entries();

                const loaded: Partial<UserSettings> = {};
                for (const [key, value] of entries) {
                    if (key in DEFAULT_SETTINGS) {
                        (loaded as Record<string, unknown>)[key] = value;
                    }
                }

                if (!cancelled) setSettings({ ...DEFAULT_SETTINGS, ...loaded });
            } catch (err) {
                console.error("Failed to load settings:", err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    async function updateSettings(patch: Partial<UserSettings>) {
        const prev = settingsRef.current;
        const next = { ...prev, ...patch };
        setSettings(next);
        settingsRef.current = next;

        try {
            const store = await getStore();
            for (const [key, value] of Object.entries(patch)) {
                if (value === null || value === undefined) {
                    await store.delete(key);
                } else {
                    await store.set(key, value);
                }
            }
            await store.save();
        } catch (err) {
            console.error("Failed to save settings:", err);
            setSettings(prev);
            settingsRef.current = prev;
        }
    }

    return (
        <SettingsContext.Provider value={{ settings, loading, updateSettings }}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error("useSettings must be used inside a SettingsProvider");
    }
    return context;
}