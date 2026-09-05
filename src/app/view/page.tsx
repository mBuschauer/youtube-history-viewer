'use client';

import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import type { DatasetMetadata } from '@/lib/types';
import { redirect } from 'next/navigation';
import StatePane from '@/components/StatePane';
import { LuLoaderCircle, LuDatabase, LuTriangleAlert } from 'react-icons/lu';

const uuidv4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function Page() {
    const id = useSearchParams().get('id');

    const validId = !!id && uuidv4Regex.test(id);

    const dataset = useQuery<DatasetMetadata, string>({
        queryKey: ['dataset', id],
        queryFn: () => invoke<DatasetMetadata>('get_dataset', { id }),
        enabled: validId,
        refetchInterval: (q) => {
            const s = q.state.data?.status;
            return s === 'uploaded' || s === 'parsing' ? 500 : false;
        },
    });

    if (!id) {
        return (
            <StatePane
                icon={LuDatabase}
                title="No dataset selected"
                body="Choose a dataset from the Datasets list."
            />
        );
    }

    if (!validId) {
        return (
            <StatePane
                icon={LuTriangleAlert}
                tone="bad"
                title="Invalid dataset ID"
                body="That link does not point at a dataset this app can open."
            />
        );
    }

    if (dataset.error) {
        return (
            <StatePane
                icon={LuTriangleAlert}
                tone="bad"
                title="Could not open dataset"
                body={String(dataset.error)}
            />
        );
    }

    if (!dataset.isSuccess) {
        return <StatePane icon={LuLoaderCircle} spin title="Opening dataset" />;
    }

    const meta = dataset.data;

    if (meta.type === 'youtube_history') {
        redirect(`/view/history?id=${id}`);
    }

    return (
        <StatePane
            icon={LuTriangleAlert}
            tone="bad"
            title="Unsupported dataset type"
            body={`This app has no viewer for datasets of type "${meta.type}".`}
        />
    );
}
