"use client";
import { useEffect, useState } from "react";
import { LuTriangleAlert } from "react-icons/lu";

interface DeleteDatasetDialogProps {
  dataset: { id: string; name: string };
  deleting: boolean;
  error: string | null;
  onConfirm: (typedId: string) => void;
  onClose: () => void;
}

export default function DeleteDatasetDialog({ dataset, deleting, error, onConfirm, onClose }: DeleteDatasetDialogProps) {
  const [typedId, setTypedId] = useState("");
  const confirmed = typedId.trim() === dataset.id;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
    >
      <div className="w-full max-w-md rounded-md border border-line bg-raised shadow-pane" >
        <div className="flex items-start gap-2.5 p-4">
          <LuTriangleAlert className="mt-px size-4 shrink-0 text-bad" />
          <div className="min-w-0">
            <h2 id="delete-dataset-heading" className="text-[13px] font-semibold text-fg">
              Delete this dataset?
            </h2>
            <p className="mt-1.5 text-[12px] leading-relaxed text-fg-muted">
              This permanently deletes{" "}
              <span className="font-medium text-fg">{dataset.name}</span>, its copied
              export file, and its parsed history. This cannot be undone.
            </p>
          </div>
        </div>

        <div className="border-t border-line px-4 py-3">
          <label htmlFor="delete-confirm-id" className="block text-[12px] text-fg-muted">
            Type the dataset ID to confirm
          </label>
          <p className="selectable mt-1.5 rounded-sm border border-line bg-sunken px-2 py-1.5 font-mono text-[11px] break-all text-fg-muted select-all">
            {dataset.id}
          </p>
          <input
            id="delete-confirm-id"
            type="text"
            autoFocus
            value={typedId}
            onChange={(e) => setTypedId(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            className="mt-1.5 h-7 w-full rounded-sm border border-line-strong bg-surface px-2 font-mono text-[11px] text-fg focus:border-bad-solid focus:outline-none"
          />
        </div>

        {error && (
          <div className="mx-4 mb-3 rounded-sm border border-bad-line bg-bad-soft px-2.5 py-2 text-[12px] text-bad">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="h-7 cursor-pointer rounded-md border border-line bg-surface px-3 text-[12px] font-medium text-fg transition-colors hover:bg-sunken disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(typedId.trim())}
            disabled={!confirmed || deleting}
            className="h-7 cursor-pointer rounded-md bg-bad-solid px-3 text-[12px] font-medium text-white transition-colors hover:bg-bad-solid-hover disabled:cursor-not-allowed disabled:bg-sunken disabled:text-fg-subtle"
          >
            {deleting ? "Deleting..." : "Delete dataset"}
          </button>
        </div>
      </div>
    </div>
  );
}
