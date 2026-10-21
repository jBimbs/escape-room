"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicState } from "./game";

export function useGame() {
  const [state, setState] = useState<PublicState | null>(null);
  const [nowMs, setNowMs] = useState(0);
  const offset = useRef(0);

  const apply = useCallback((s: PublicState) => {
    offset.current = s.now - Date.now();
    setState(s);
  }, []);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const res = await fetch("/api/game", { cache: "no-store" });
        if (alive) apply(await res.json());
      } catch {}
    };
    poll();
    const p = setInterval(poll, 2000);
    const t = setInterval(() => setNowMs(Date.now() + offset.current), 100);
    return () => {
      alive = false;
      clearInterval(p);
      clearInterval(t);
    };
  }, [apply]);

  const post = useCallback(
    async (body: Record<string, unknown>) => {
      const res = await fetch("/api/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.state) apply(data.state);
      return data as { ok: boolean; message: string; video?: string };
    },
    [apply]
  );

  return { state, nowMs, post };
}

export function fmt(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function fmtHMS(ms: number, ceil = false) {
  const sec = (ceil ? Math.ceil : Math.floor)(Math.max(0, ms) / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}