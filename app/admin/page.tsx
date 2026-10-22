"use client";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { fmtHMS, useGame } from "@/lib/useGame";

type Result = {
  id: number;
  game_started_at: string;
  team_id: string;
  team_name: string;
  started_at: string;
  finished_at: string;
  elapsed_ms: number;
  penalty_ms: number;
  wrong: number;
  total_ms: number;
};

const stamp = (iso: string | number) =>
  new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "medium" });

export default function Admin() {
  const { state, nowMs, post } = useGame();
  const [pin, setPin] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [results, setResults] = useState<Result[]>([]);

  const loadResults = useCallback(async (p: string) => {
    const res = await fetch("/api/game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "results", pin: p }),
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, ok: res.ok, results: data.results as Result[] | undefined, message: data.message as string | undefined };
  }, []);

  const unlock = useCallback(
    async (p: string) => {
      const r = await loadResults(p);
      if (r.status === 401) {
        setError("Wrong PIN.");
        try { sessionStorage.removeItem("adminPin"); } catch {}
        return;
      }
      setError("");
      setUnlocked(true);
      setPin(p);
      try { sessionStorage.setItem("adminPin", p); } catch {}
      if (r.ok && r.results) setResults(r.results);
      else setMsg("Couldn't load saved results. Check the Supabase settings.");
    },
    [loadResults]
  );

  // Re-unlock after a page refresh
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("adminPin");
      if (saved) unlock(saved);
    } catch {}
  }, [unlock]);

  // Refresh saved results every 5s while unlocked
  useEffect(() => {
    if (!unlocked) return;
    const t = setInterval(async () => {
      const r = await loadResults(pin);
      if (r.ok && r.results) setResults(r.results);
    }, 5000);
    return () => clearInterval(t);
  }, [unlocked, pin, loadResults]);

  const rounds = useMemo(() => {
    const m = new Map<string, Result[]>();
    for (const r of results) {
      const list = m.get(r.game_started_at) ?? [];
      list.push(r);
      m.set(r.game_started_at, list);
    }
    return [...m.entries()];
  }, [results]);

  async function run(action: "start" | "reset") {
    const open = state?.startedAt != null;
    if (action === "reset" && !confirm("Reset the game? Live timers are cleared. Saved results stay in the history.")) return;
    if (action === "start" && open && !confirm("The game is already open. Opening it again clears all live timers. Continue?")) return;
    const r = await post({ action, pin });
    setMsg(r.ok ? (action === "start" ? "Game opened. Teams can now press Start." : "Game reset.") : r.message);
  }

  function exportCsv() {
    const header = ["round", "team", "started_at", "finished_at", "elapsed", "penalty", "wrong", "total"];
    const lines = results.map((r) =>
      [r.game_started_at, r.team_name, r.started_at, r.finished_at, fmtHMS(r.elapsed_ms), fmtHMS(r.penalty_ms), r.wrong, fmtHMS(r.total_ms)]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "escape-room-results.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (!unlocked) {
    return (
      <main className="dash">
        <form
          className="dash-login"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            unlock(pin);
          }}
        >
          <h1>Host dashboard</h1>
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Admin PIN"
            aria-label="Admin PIN"
            autoFocus
          />
          <button className="btn" type="submit">Unlock</button>
          {error && <p className="dash-err">{error}</p>}
        </form>
      </main>
    );
  }

  if (!state) return <main className="dash"><p>Connecting…</p></main>;

  const open = state.startedAt !== null;

  // Live rows: finished (ranked) → running → not started
  const rows = state.teams
    .map((t) => {
      const done = t.finishedAt !== null;
      const running = t.startedAt !== null && !done;
      const elapsed = t.startedAt
        ? (done ? t.finishedAt! : Math.max(nowMs, t.startedAt)) - t.startedAt
        : 0;
      return {
        ...t,
        done,
        running,
        status: done ? "finished" : running ? "running" : "waiting",
        total: elapsed + (t.penaltyMs ?? 0),
      };
    })
    .sort((a, b) => {
      const order = { finished: 0, running: 1, waiting: 2 } as const;
      if (a.status !== b.status) return order[a.status as keyof typeof order] - order[b.status as keyof typeof order];
      if (a.status === "waiting") return a.name.localeCompare(b.name);
      return a.status === "finished" ? a.total - b.total : b.total - a.total;
    });

  const finishedCount = rows.filter((r) => r.done).length;
  const runningCount = rows.filter((r) => r.running).length;

  return (
    <main className="dash">
      <div className="dash-inner">
        <header className="dash-bar">
          <h1>Host dashboard</h1>
          <div className="dash-actions">
            <span className={`chip ${open ? "open" : "closed"}`}>{open ? "Game open" : "Game closed"}</span>
            <button className="btn" onClick={() => run("start")}>{open ? "Restart / open again" : "Open game"}</button>
            <button className="btn secondary" onClick={() => run("reset")}>Reset</button>
          </div>
        </header>
        {msg && <p className="dash-msg" role="status">{msg}</p>}

        <section className="stats">
          <div className="stat"><b>{rows.length}</b>Teams</div>
          <div className="stat"><b>{runningCount}</b>Running</div>
          <div className="stat"><b>{finishedCount}</b>Finished</div>
          <div className="stat"><b>{rows.reduce((n, r) => n + (r.wrong ?? 0), 0)}</b>Wrong codes</div>
        </section>

        <section>
          <h2>Live</h2>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Team</th><th>Status</th><th>Time</th>
                  <th>Wrong</th><th>Penalty</th><th>Finished at</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id}>
                    <td>{r.done ? i + 1 : "–"}</td>
                    <td>{r.name}</td>
                    <td className={`st-${r.status}`}>
                      {r.status === "finished" ? "Escaped" : r.status === "running" ? "In progress" : open ? "Not started" : "Waiting"}
                    </td>
                    <td className="time">{r.status === "waiting" ? "--:--:--" : fmtHMS(r.total)}</td>
                    <td>{r.wrong}</td>
                    <td>{r.penaltyMs ? `+${Math.round(r.penaltyMs / 1000)}s` : "–"}</td>
                    <td>{r.finishedAt ? new Date(r.finishedAt).toLocaleTimeString() : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <div className="dash-bar">
            <h2>History</h2>
            <button className="btn secondary" onClick={exportCsv} disabled={results.length === 0}>Export CSV</button>
          </div>
          {rounds.length === 0 && <p className="dash-muted">No saved results yet. Each finish is saved automatically.</p>}
          {rounds.map(([round, list]) => (
            <div key={round} className="round">
              <h3>Round opened {stamp(round)}</h3>
              <div className="tablewrap">
                <table>
                  <thead>
                    <tr><th>#</th><th>Team</th><th>Total</th><th>Time</th><th>Penalty</th><th>Wrong</th><th>Finished at</th></tr>
                  </thead>
                  <tbody>
                    {list.map((r, i) => (
                      <tr key={r.id}>
                        <td>{i + 1}</td>
                        <td>{r.team_name}</td>
                        <td className="time">{fmtHMS(r.total_ms)}</td>
                        <td className="time">{fmtHMS(r.elapsed_ms)}</td>
                        <td>{r.penalty_ms ? `+${Math.round(r.penalty_ms / 1000)}s` : "–"}</td>
                        <td>{r.wrong}</td>
                        <td>{stamp(r.finished_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}