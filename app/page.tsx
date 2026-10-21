"use client";
import Link from "next/link";
import { useGame } from "@/lib/useGame";

export default function PickTeam() {
  const { state } = useGame();

  if (!state) return <main className="kiosk"><p className="note">Connecting…</p></main>;

  return (
    <main className="kiosk">
      <section className="panel picker">
        <h1 className="picker-title">Select your team</h1>
        <ul className="teamlist">
          {state.teams.map((t) => (
            <li key={t.id}>
              <Link href={`/team/${t.id}`} className="teambtn">
                <span>{t.name}</span>
                {t.finishedAt && <small>Escaped</small>}
              </Link>
            </li>
          ))}
        </ul>
        {!state.startedAt && <p className="note">Waiting for the host</p>}
      </section>
    </main>
  );
}