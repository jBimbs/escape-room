"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import { fmtHMS, useGame } from "@/lib/useGame";
import { ESCAPE_VIDEO } from "@/lib/video";
import VideoOverlay from "./VideoOverlay";

export default function TeamScreen({ id }: { id: string }) {
  const { state, nowMs, post } = useGame();
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [shake, setShake] = useState(false);
  const [video, setVideo] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const teamStartedAt = state?.teams.find((t) => t.id === id)?.startedAt;
  useEffect(() => {
    if (teamStartedAt) inputRef.current?.focus();
  }, [teamStartedAt]);

  if (!state) return <main className="kiosk"><p className="note">Connecting…</p></main>;
  const team = state.teams.find((t) => t.id === id);
  if (!team) return <main className="kiosk"><p className="note bad">Unknown team.</p></main>;

  const gameOpen = state.startedAt !== null;
  const running = team.startedAt !== null;
  const done = team.finishedAt !== null;
  const locked = !gameOpen || !running || done;

  // Timer counts up from the team's own start until it enters the right code.
  const elapsed = running
    ? (done ? team.finishedAt! : Math.max(nowMs, team.startedAt!)) - team.startedAt!
    : 0;
  const shown = elapsed + (team.penaltyMs ?? 0);

  async function startTimer() {
    const r = await post({ action: "teamStart", teamId: id });
    setMsg(r.ok ? null : { ok: false, text: r.message });
  }

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!code || locked) return;
    const r = await post({ action: "submit", teamId: id, code });
    setMsg({ ok: r.ok, text: r.message });
    setCode("");
    if (r.ok && r.video) {
      setVideo(r.video);
      return;
    }
    if (!r.ok) {
      setShake(true);
      setTimeout(() => setShake(false), 400);
    }
    inputRef.current?.focus();
  }

  const note = done
    ? "Escaped"
    : !gameOpen
    ? "Waiting for the host"
    : !running
    ? "Press Start when you're ready"
    : msg?.text ?? "";
  const noteClass = done || msg?.ok ? "ok" : msg && !msg.ok ? "bad" : "";

  return (
    <main className="kiosk">
      <section className="panel">
        <h1 className="sr-only">{team.name}</h1>
        <div className={`digits ${done ? "done" : ""}`}>{fmtHMS(shown)}</div>

        {gameOpen && !running ? (
          <button
            type="button"
            className="key"
            style={{ width: "auto", padding: "0 32px", height: 56, fontSize: 20 }}
            onClick={startTimer}
          >
            ▶ Start
          </button>
        ) : (
          <form className="row" onSubmit={submit}>
            <input
              ref={inputRef}
              type="password"
              className={shake ? "shake" : ""}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={24}
              autoComplete="off"
              spellCheck={false}
              disabled={locked}
              aria-label="Enter code"
            />
            <button type="button" className="key" aria-label="Delete" disabled={locked}
              onClick={() => setCode((c) => c.slice(0, -1))}>⌫</button>
            <button type="submit" className="key" aria-label="Submit code" disabled={locked}>↵</button>
          </form>
        )}

        <p className={`note ${noteClass}`} role="status">{note}</p>

        {done && (
          <button
            type="button"
            className="key"
            style={{ width: "auto", padding: "0 20px" }}
            onClick={() => setVideo(ESCAPE_VIDEO)}
          >
            ▶ Watch again
          </button>
        )}
      </section>

      {video && <VideoOverlay src={video} onClose={() => setVideo(null)} />}
    </main>
  );
}