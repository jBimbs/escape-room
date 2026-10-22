import { ESCAPE_VIDEO } from "./video";
import { supabase } from "./supabase";

export type PublicTeam = {
  id: string;
  name: string;
  startedAt: number | null; // when the team pressed Start
  finishedAt: number | null; // when the team entered the right code
  penaltyMs: number;
  wrong: number;
};

export type PublicState = {
  now: number;
  startedAt: number | null; // game opened by the host
  teams: PublicTeam[];
};

type Reply = { ok: boolean; message: string };

const penaltyMs = () => Number(process.env.PENALTY_SECONDS ?? 3) * 1000;

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}

export const publicState = () => rpc<PublicState>("get_state");

export async function start() {
  await rpc("start_game");
}

export async function reset() {
  await rpc("reset_game");
}

export const startTeam = (teamId: string) => rpc<Reply>("team_start", { p_team: teamId });

export async function submitCode(teamId: string, code: string): Promise<Reply & { video?: string }> {
  const r = await rpc<Reply>("submit_code", {
    p_team: teamId,
    p_code: code,
    p_penalty_ms: penaltyMs(),
  });
  return r.ok ? { ...r, video: ESCAPE_VIDEO } : r;
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