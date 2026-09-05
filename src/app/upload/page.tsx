'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import type { DatasetMetadata } from '@/lib/types';
import Link from 'next/link';
import { LuFileInput, LuTriangleAlert, LuLoaderCircle } from 'react-icons/lu';

type ImportVars = { path: string; name: string | null };

export default function UploadWatchHistory() {
    const router = useRouter();
    const qc = useQueryClient();

    const [path, setPath] = useState<string | null>(null);
    const [datasetName, setDatasetName] = useState('');

    const importFile = useMutation<DatasetMetadata, string, ImportVars>({
        mutationFn: (vars) => invoke<DatasetMetadata>('import_watch_history', vars),
        onSuccess: (meta) => {
            qc.setQueryData(['dataset', meta.id], meta);
            router.push(`/view?id=${meta.id}`);
        },
    });

    const pickFile = async () => {
        const selected = await open({
            multiple: false,
            filters: [{ name: 'Watch history', extensions: ['html', 'json'] }],
        });
        if (typeof selected !== 'string') return;

        setPath(selected);
        if (!datasetName) {
            const base = selected.split(/[\\/]/).pop() ?? '';
            setDatasetName(base.replace(/\.[^/.]+$/, ''));
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!path) return;
        importFile.mutate({ path, name: datasetName.trim() || null });
    };

    return (
        <div className="flex h-full flex-col">
            <div className="chrome flex h-9 shrink-0 items-center gap-2 border-b border-line bg-canvas px-2.5">
                <span className="text-[12px] font-medium text-fg">Import watch history</span>
                <Link
                    href="/"
                    className="ml-auto inline-flex h-6 items-center rounded-sm px-2 text-[12px] text-fg-muted transition-colors hover:bg-sunken hover:text-fg"
                >
                    Cancel
                </Link>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
                <form onSubmit={handleSubmit} className="mx-auto max-w-lg px-4 py-6">
                    <p className="text-[12px] leading-relaxed text-fg-muted">
                        Select the <code className="rounded-xs bg-sunken px-1 py-px font-mono text-[11px] text-fg">watch-history.html</code>{' '}
                        or <code className="rounded-xs bg-sunken px-1 py-px font-mono text-[11px] text-fg">watch-history.json</code>{' '}
                        file from your Google Takeout export. The file is copied into this
                        app's own storage; the original is left where it is.
                    </p>

                    {importFile.error && (
                        <div className="mt-4 flex items-start gap-2 rounded-sm border border-bad-line bg-bad-soft px-2.5 py-2 text-[12px] text-bad">
                            <LuTriangleAlert className="mt-px size-3.5 shrink-0" />
                            <span>{importFile.error}</span>
                        </div>
                    )}

                    <div className="mt-5 space-y-4">
                        <div>
                            <span className="block text-[12px] font-medium text-fg">Export file</span>
                            <div className="mt-1.5 flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={pickFile}
                                    className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-line bg-surface px-3 text-[12px] font-medium text-fg transition-colors hover:bg-sunken"
                                >
                                    <LuFileInput className="size-3.5" />
                                    Choose file
                                </button>
                                {!path && (
                                    <span className="text-[12px] text-fg-subtle">No file selected</span>
                                )}
                            </div>
                            {path && (
                                <p className="selectable mt-1.5 rounded-sm border border-line bg-sunken px-2 py-1.5 font-mono text-[11px] break-all text-fg-muted">
                                    {path}
                                </p>
                            )}
                        </div>

                        <div>
                            <label htmlFor="dataset-name" className="block text-[12px] font-medium text-fg">
                                Dataset name
                            </label>
                            <input
                                id="dataset-name"
                                type="text"
                                value={datasetName}
                                onChange={(e) => setDatasetName(e.target.value)}
                                placeholder="My watch history"
                                className="mt-1.5 h-7 w-full rounded-sm border border-line-strong bg-surface px-2 text-[12px] text-fg placeholder:text-fg-subtle focus:border-focus focus:outline-none"
                            />
                        </div>
                    </div>

                    <div className="mt-6 flex items-center gap-2 border-t border-line pt-4">
                        <button
                            type="submit"
                            disabled={!path || importFile.isPending}
                            className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md bg-accent px-3 text-[12px] font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-sunken disabled:text-fg-subtle"
                        >
                            {importFile.isPending && (
                                <LuLoaderCircle className="size-3.5 animate-spin" />
                            )}
                            {importFile.isPending ? 'Importing...' : 'Import'}
                        </button>
                        <span className="text-[11px] text-fg-subtle">
                            Parsing runs in the background once the import finishes.
                        </span>
                    </div>
                </form>
            </div>
        </div>
    );
}
