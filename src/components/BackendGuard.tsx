"use client";
import React, { useState, useEffect } from "react";
import { invoke } from '@tauri-apps/api/core';
import { LuLoaderCircle, LuServerCrash } from "react-icons/lu";

interface HealthState {
  isPending: boolean;
  isUp: boolean;
}

export default function HealthGuard({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<HealthState>({ isPending: true, isUp: false });

  useEffect(() => {
    async function checkBackendHealth() {
      try {
        const response = await invoke<string>('backend_health_check');
        if (response === 'ok') {
          setStatus({ isPending: false, isUp: true });
        } else {
          setStatus({ isPending: false, isUp: false });
        }
      } catch (error) {
        console.error('Backend is unreachable:', error);
        setStatus({ isPending: false, isUp: false });
      }
    }

    checkBackendHealth();
  }, []);

  if (status.isPending) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-canvas">
        <LuLoaderCircle aria-hidden className="size-5 animate-spin text-fg-subtle" />
        <span className="sr-only">Starting</span>
      </div>
    );
  }

  if (status.isUp) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-canvas p-8">
      <div className="flex max-w-sm flex-col items-center text-center">
        <LuServerCrash aria-hidden className="size-6 text-bad" />
        <h1 className="mt-3 text-[13px] font-semibold text-fg">Backend not responding</h1>
        <p className="mt-1.5 text-[12px] leading-relaxed text-fg-muted">
          The application core did not start. Restarting the app usually clears this.
        </p>
      </div>
    </div>
  );
}
