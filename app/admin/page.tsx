"use client";
import { useState } from "react";
import { useGame } from "@/lib/useGame";

export default function Admin() {
  const { state, post } = useGame();
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState("");

  async function run(action: "start" | "reset") {
    if (action === "reset" && !confirm("Reset the game and clear all finish times?")) return;
    const r = await post({ action, pin });
    setMsg(r.ok ? (action === "start" ? "Game started." : "Game reset.") : r.message);
  }

  return (
    <main className="wrap admin">
      <h1>Host controls</h1>
      <label htmlFor="pin">Admin PIN</label>
      <input id="pin" type="password" value={pin} onChange={(e) => setPin(e.target.value)} />
      <div className="entry-row">
        <button onClick={() => run("start")}>Start game for all teams</button>
        <button className="secondary" onClick={() => run("reset")}>Reset</button>
      </div>
      {msg && <p className="msg">{msg}</p>}
      <p className="hint">
        Status: {!state ? "…" : state.startedAt ? "Running" : "Not started"}. Teams finished:{" "}
        {state?.teams.filter((t) => t.finishedAt).length ?? 0}/{state?.teams.length ?? 0}
      </p>
    </main>
  );
}