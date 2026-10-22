import { ESCAPE_VIDEO } from "./video";
import { supabase } from "./supabase";

export type Team = {
  id: string;
  name: string;
  code: string;
  startedAt: number | null; // when the team pressed Start on its own screen
  finishedAt: number | null; // when the team entered the right code
  penaltyMs: number;
  wrong: number;
};

type Game = {
  startedAt: number | null; // game opened by the host
  penaltyMs: number;
  teams: Team[];
};

// Keep state across hot reloads in dev
const g = globalThis as unknown as { __escapeGameV4?: Game };

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function load(): Game {
  const raw = process.env.TEAMS ?? "Team A:ALPHA-1,Team B:BRAVO-2,Team C:CHARLIE-3";

  const teams: Team[] = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry, i) => {
      const [name, ...rest] = entry.split(":");
      return {
        id: slug(name.trim()) || `t${i}`,
        name: name.trim(),
        code: rest.join(":").trim().toUpperCase(),
        startedAt: null,
        finishedAt: null,
        penaltyMs: 0,
        wrong: 0,
      };
    });

  const penaltySec = Number(process.env.PENALTY_SECONDS ?? 3);
  return { startedAt: null, penaltyMs: penaltySec * 1000, teams };
}

export const game: Game = (g.__escapeGameV4 ??= load());

// What the browser is allowed to see (never includes codes)
export const publicState = () => ({
  now: Date.now(),
  startedAt: game.startedAt,
  penaltyMs: game.penaltyMs,
  teams: game.teams.map(({ id, name, startedAt, finishedAt, penaltyMs, wrong }) => ({
    id,
    name,
    startedAt,
    finishedAt,
    penaltyMs,
    wrong,
  })),
});

export type PublicState = ReturnType<typeof publicState>;

function clearTeams() {
  game.teams.forEach((t) => {
    t.startedAt = null;
    t.finishedAt = null;
    t.penaltyMs = 0;
    t.wrong = 0;
  });
}

// Host opens the game. Team timers do NOT start yet.
export function start() {
  clearTeams();
  game.startedAt = Date.now();
}

export function reset() {
  clearTeams();
  game.startedAt = null;
}

// A team presses Start on its own screen.
export function startTeam(teamId: string): { ok: boolean; message: string } {
  if (!game.startedAt) return { ok: false, message: "The game hasn't started yet." };

  const team = game.teams.find((t) => t.id === teamId);
  if (!team) return { ok: false, message: "Unknown team." };
  if (team.startedAt) return { ok: false, message: "Already started." };

  team.startedAt = Date.now();
  return { ok: true, message: "Good luck!" };
}

// Saves the finish to Supabase. A failure is logged but never blocks the team.
async function recordResult(team: Team, finishedAt: number) {
  const elapsed = finishedAt - team.startedAt!;
  try {
    const { error } = await supabase.from("results").insert({
      game_started_at: new Date(game.startedAt!).toISOString(),
      team_id: team.id,
      team_name: team.name,
      started_at: new Date(team.startedAt!).toISOString(),
      finished_at: new Date(finishedAt).toISOString(),
      elapsed_ms: elapsed,
      penalty_ms: team.penaltyMs,
      wrong: team.wrong,
      total_ms: elapsed + team.penaltyMs,
    });
    if (error) console.error("Failed to record result:", error.message);
  } catch (e) {
    console.error("Failed to record result:", e);
  }
}

export async function submitCode(
  teamId: string,
  input: string
): Promise<{ ok: boolean; message: string; video?: string }> {
  if (!game.startedAt) return { ok: false, message: "The game hasn't started yet." };

  const team = game.teams.find((t) => t.id === teamId);
  if (!team) return { ok: false, message: "Unknown team." };
  if (!team.startedAt) return { ok: false, message: "Press Start first." };
  if (team.finishedAt) return { ok: false, message: `${team.name} already escaped.` };

  if (input.trim().toUpperCase() !== team.code) {
    team.penaltyMs += game.penaltyMs;
    team.wrong += 1;
    return { ok: false, message: `Wrong code. +${game.penaltyMs / 1000} seconds.` };
  }

  const finishedAt = Date.now();
  team.finishedAt = finishedAt;
  await recordResult(team, finishedAt);

  return {
    ok: true,
    message: `${team.name} escaped!`,
    video: ESCAPE_VIDEO,
  };
  console.log("[submit]", teamId, JSON.stringify(input), JSON.stringify(team.code));
}
export async function getResults() {
  const { data, error } = await supabase
    .from("results")
    .select("*")
    .order("game_started_at", { ascending: false })
    .order("total_ms", { ascending: true })
    .limit(500);
  if (error) throw error;
  return data;
}