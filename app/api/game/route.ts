import { NextRequest, NextResponse } from "next/server";
import { publicState, reset, start, startTeam, submitCode } from "@/lib/game";

export async function GET() {
  return NextResponse.json(publicState(), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  if (body.action === "teamStart") {
    const result = startTeam(String(body.teamId ?? ""));
    return NextResponse.json({ ...result, state: publicState() }, { status: result.ok ? 200 : 400 });
  }

  if (body.action === "submit") {
    const result = submitCode(String(body.teamId ?? ""), String(body.code ?? ""));
    return NextResponse.json({ ...result, state: publicState() }, { status: result.ok ? 200 : 400 });
  }

  if (body.action === "start" || body.action === "reset") {
    const pin = process.env.ADMIN_PIN ?? "1234";
    if (String(body.pin ?? "") !== pin) {
      return NextResponse.json({ ok: false, message: "Wrong admin PIN." }, { status: 401 });
    }
    if (body.action === "start") start();
    else reset();
    return NextResponse.json({ ok: true, state: publicState() });
  }

  return NextResponse.json({ ok: false, message: "Unknown action." }, { status: 400 });
}