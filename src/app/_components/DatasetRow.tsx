"use client";
import { useRouter } from "next/navigation";
import type { DatasetMetadata } from "@/lib/types";
import { LuTrash2 } from "react-icons/lu";
import StatusPill from "@/components/StatusPill";

interface DatasetRowProps {
  dataset: DatasetMetadata;
  onDelete: (dataset: DatasetMetadata) => void;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return isNaN(date.getTime()) ? "Unknown date" : date.toLocaleString();
}

function formatType(value: string): string {
  return value === "youtube_history" ? "YouTube history" : value;
}

function Sep() {
  return <span className="text-fg-subtle/60">/</span>;
}

export default function DatasetRow({ dataset, onDelete }: DatasetRowProps) {
  const router = useRouter();
  const href = `/view?id=${dataset.id}`;

  return (
    <div
      onClick={() => router.push(href)}
      className="group relative flex cursor-pointer items-center gap-3 border-b border-line px-3 py-2.5 transition-colors hover:bg-sunken focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
    >

      <div className="pointer-events-none min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="min-w-0 truncate text-[13px] font-medium text-fg">{dataset.name}</h3>
          <StatusPill status={dataset.status} />
        </div>
        <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-fg-muted">
          <span>{formatType(dataset.type)}</span>
          <Sep />
          <span className="tnum">{formatDate(dataset.created_at)}</span>
          <Sep />
          <span>{dataset.raw_type}</span>
        </p>
      </div>

      <button type="button" onClick={() => onDelete(dataset)} title="Delete dataset"
        className="relative grid size-7 shrink-0 cursor-pointer place-items-center rounded-sm text-fg-subtle opacity-0 transition-[opacity,color,background-color] duration-150 group-hover:opacity-100 hover:bg-bad-soft hover:text-bad focus-visible:opacity-100"
      >
        <LuTrash2 className="size-3.5" />
      </button>
    </div>
  );
}
