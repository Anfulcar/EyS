"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function RefreshButton({ label }: { label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button type="button" className="btn-secondary btn-sm" disabled={pending} onClick={() => start(() => router.refresh())}>
      <span className={pending ? "animate-spin" : ""}>↻</span> {label}
    </button>
  );
}
