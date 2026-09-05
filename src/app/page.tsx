"use client";
import React, { useState } from "react";
import Link from "next/link";
import DeleteDatasetDialog from "./_components/DeleteDatasetDialog";
import DatasetRow from "./_components/DatasetRow";
import type { DatasetMetadata } from "../lib/types";
import { invoke } from "@tauri-apps/api/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import StatePane from "@/components/StatePane";
import { LuPlus, LuDatabase, LuLoaderCircle, LuTriangleAlert } from "react-icons/lu";

function Shell({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <div className="flex h-full flex-col">
      <div className="chrome flex h-9 shrink-0 items-center gap-2 border-b border-line bg-canvas px-2.5">
        <span className="text-[12px] font-medium text-fg">Datasets</span>
        {count != null && (
          <span className="tnum text-[11px] text-fg-subtle">{count.toLocaleString()}</span>
        )}
        <Link
          href="/upload"
          className="ml-auto inline-flex h-6 items-center gap-1.5 rounded-sm bg-accent px-2.5 text-[12px] font-medium text-on-accent transition-colors hover:bg-accent-hover"
        >
          <LuPlus className="size-3.5" aria-hidden />
          Import
        </Link>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto bg-surface">{children}</div>
    </div>
  );
}

export default function Page() {
  const queryClient = useQueryClient();
  const [pendingDelete, setPendingDelete] = useState<DatasetMetadata | null>(null);

  const datasets = useQuery<DatasetMetadata[]>({
    queryKey: ["datasets"],
    queryFn: () => invoke<DatasetMetadata[]>("get_datasets"),
  });

  const deleteDataset = useMutation({
    mutationFn: async (id: string) => {
      try {
        return await invoke('delete_dataset', { id });
      } catch (e) {
        throw e instanceof Error ? e : new Error(String(e));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["datasets"] });
      setPendingDelete(null);
    },
  });

  const closeDeleteDialog = () => {
    setPendingDelete(null);
    deleteDataset.reset();
  };

  if (datasets.isPending) {
    return (
      <Shell>
        <StatePane icon={LuLoaderCircle} spin title="Loading datasets" />
      </Shell>
    );
  }

  if (datasets.isError) {
    return (
      <Shell>
        <StatePane
          icon={LuTriangleAlert}
          tone="bad"
          title="Could not read your datasets"
          body={datasets.error.message}
        />
      </Shell>
    );
  }

  if (datasets.data.length === 0) {
    return (
      <Shell count={0}>
        <StatePane
          icon={LuDatabase}
          title="No datasets yet"
          body="Import the watch-history.html or watch-history.json file from a Google Takeout export to get started."
          action={
            <Link
              href="/upload"
              className="inline-flex h-7 items-center gap-1.5 rounded-md bg-accent px-3 text-[12px] font-medium text-on-accent transition-colors hover:bg-accent-hover"
            >
              <LuPlus className="size-3.5" aria-hidden />
              Import watch history
            </Link>
          }
        />
      </Shell>
    );
  }

  return (
    <Shell count={datasets.data.length}>
      {datasets.data.map((dataset) => (
        <DatasetRow
          key={dataset.id}
          dataset={dataset}
          onDelete={(d) => {
            deleteDataset.reset();
            setPendingDelete(d);
          }}
        />
      ))}

      {pendingDelete && (
        <DeleteDatasetDialog
          dataset={pendingDelete}
          deleting={deleteDataset.isPending}
          error={deleteDataset.error?.message ?? null}
          onConfirm={(typedId) => deleteDataset.mutate(typedId)}
          onClose={closeDeleteDialog}
        />
      )}
    </Shell>
  );
}
