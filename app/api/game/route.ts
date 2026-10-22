import { NextRequest, NextResponse } from "next/server";
import { getResults, publicState, reset, start, startTeam, submitCode } from "@/lib/game";

const pinOk = (pin: unknown) => String(pin ?? "") === (process.env.ADMIN_PIN ?? "1234");

export async function GET() {
  return NextResponse.json(publicState(), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  try {
    // A team presses Start on its own screen
    if (body.action === "teamStart") {
      const result = startTeam(String(body.teamId ?? ""));
      return NextResponse.json(
        { ...result, state: publicState() },
        { status: result.ok ? 200 : 400 }
      );
    }

    // A team enters its code
    if (body.action === "submit") {
      const result = await submitCode(String(body.teamId ?? ""), String(body.code ?? ""));
      return NextResponse.json(
        { ...result, state: publicState() },
        { status: result.ok ? 200 : 400 }
      );
    }

    // Everything below is host-only (PIN protected)
    if (body.action === "start" || body.action === "reset" || body.action === "results") {
      if (!pinOk(body.pin)) {
        return NextResponse.json({ ok: false, message: "Wrong admin PIN." }, { status: 401 });
      }

      if (body.action === "results") {
        return NextResponse.json({ ok: true, results: await getResults() });
      }

      if (body.action === "start") start();
      else reset();
      return NextResponse.json({ ok: true, state: publicState() });
    }

    return NextResponse.json({ ok: false, message: "Unknown action." }, { status: 400 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, message: "Server error." }, { status: 500 });
  }
}