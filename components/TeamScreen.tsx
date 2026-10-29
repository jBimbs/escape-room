"use client";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Orbitron } from "next/font/google";
import { fmtMSC, useGame } from "@/lib/useGame";
import { ESCAPE_VIDEO, INTRO_VIDEO } from "@/lib/video";
import VideoOverlay from "./VideoOverlay";

const digitFont = Orbitron({ subsets: ["latin"], weight: ["700"] });

const CODE_LENGTH = 8; // must match the length of your team codes
const NUMERIC = true; // digits only (also opens the numeric keypad on phones)
const MASK = false; // true = show • instead of the typed characters

function Lock({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="1" />
      <path d={open ? "M8 11V7a4 4 0 0 1 7.5-2" : "M8 11V7a4 4 0 0 1 8 0v4"} />
    </svg>
  );
}

// Each character gets a fixed-width cell so the clock never jitters
function BigClock({ text, done }: { text: string; done: boolean }) {
  return (
    <div
      role="timer"
      aria-label={text}
      className={`bigdigits ${digitFont.className} ${done ? "done" : ""}`}
    >
      {text.split("").map((c, i) => (
        <span key={i} aria-hidden="true" className={/\d/.test(c) ? "d" : "sep"}>{c}</span>
      ))}
    </div>
  );
}

export default function TeamScreen({ id }: { id: string }) {
  const { state, nowMs, post } = useGame(30);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [shake, setShake] = useState(false);
  const [focused, setFocused] = useState(false);
  const [video, setVideo] = useState<string | null>(null);
  const [recoveredFor, setRecoveredFor] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const startingRef = useRef(false);
  const introRef = useRef(false);

  const teamState = state?.teams.find((t) => t.id === id);
  const teamStartedAt = teamState?.startedAt;
  const finishedAt = teamState?.finishedAt ?? null;
  const done = finishedAt !== null;
  // Code was correct (timer frozen) but the team hasn't pressed SPACE to recover the files yet
  const awaitingRecover = done && recoveredFor !== finishedAt;
  const canStart =
    !!state && state.startedAt !== null && !!teamState && teamState.startedAt === null;
  const recoveredKey = `recovered:${id}`;

  const startTimer = useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    const r = await post({ action: "teamStart", teamId: id });
    setMsg(r.ok ? null : { ok: false, text: r.message });
    startingRef.current = false;
  }, [post, id]);

  const recover = useCallback(() => {
    if (finishedAt === null) return;
    try { sessionStorage.setItem(recoveredKey, String(finishedAt)); } catch {}
    setRecoveredFor(finishedAt);
    setVideo(ESCAPE_VIDEO);
  }, [finishedAt, recoveredKey]);

  // Step 2: the intro video plays when the team opens its screen (not yet started)
  useEffect(() => {
    if (introRef.current || !teamState) return;
    introRef.current = true;
    if (teamState.startedAt === null && teamState.finishedAt === null) setVideo(INTRO_VIDEO);
  }, [teamState]);

  // Remember (per tab) that this team already recovered the files, so a refresh doesn't ask again
  useEffect(() => {
    if (finishedAt === null) {
      setRecoveredFor(null);
      return;
    }
    try {
      if (sessionStorage.getItem(recoveredKey) === String(finishedAt)) setRecoveredFor(finishedAt);
    } catch {}
  }, [finishedAt, recoveredKey]);

  // SPACE: start the investigation (step 3) or recover the files (step 4)
  const action: (() => void) | null = canStart ? startTimer : awaitingRecover ? recover : null;
  useEffect(() => {
    if (!action || video) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        action();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [action, video]);

  useEffect(() => {
    if (teamStartedAt) inputRef.current?.focus();
  }, [teamStartedAt]);

  if (!state) return <main className="kiosk"><p className="note">Connecting…</p></main>;
  const team = teamState;
  if (!team) return <main className="kiosk"><p className="note bad">Unknown team.</p></main>;

  const gameOpen = state.startedAt !== null;
  const running = team.startedAt !== null;
  const locked = !gameOpen || !running || done;

  // Counts up from the team's own start; freezes the moment the right code is entered.
  const elapsed = running
    ? (done ? team.finishedAt! : Math.max(nowMs, team.startedAt!)) - team.startedAt!
    : 0;
  const shown = elapsed + (team.penaltyMs ?? 0);
  const penaltySec = Math.round((team.penaltyMs ?? 0) / 1000);

  const clean = (v: string) =>
    v.toUpperCase().replace(NUMERIC ? /\D/g : /[^A-Z0-9]/g, "").slice(0, CODE_LENGTH);

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (code.length !== CODE_LENGTH || locked) return;
    const r = await post({ action: "submit", teamId: id, code });
    setMsg({ ok: r.ok, text: r.message });
    setCode("");
    if (!r.ok) {
      setShake(true);
      setTimeout(() => setShake(false), 400);
      inputRef.current?.focus();
    }
    // On success nothing else happens here: the timer freezes and the screen asks for SPACE
  }

  const badge = awaitingRecover
    ? { label: "CODE VERIFIED", tone: "on" }
    : done
    ? { label: "RECORD RECOVERED", tone: "on" }
    : running
    ? { label: "INVESTIGATION ACTIVE", tone: "live" }
    : { label: "AWAITING INITIALIZATION", tone: "wait" };

  const footer = done
    ? awaitingRecover ? "CODE VERIFIED" : "ACCESS GRANTED"
    : msg && !msg.ok
    ? msg.text.toUpperCase()
    : !gameOpen
    ? "WAITING FOR THE HOST"
    : !running
    ? "CODE INPUT ENABLED AFTER TIMER STARTS"
    : "CODE INPUT ENABLED";
  const footerClass = done ? "ok" : msg && !msg.ok ? "bad" : "";

  const activeIndex = Math.min(code.length, CODE_LENGTH - 1);

  return (
    <main className="kiosk screen">
      <div className="term">
        <header className="term-head">
          <h1 className="term-title">INVESTIGATION CONTROL TERMINAL</h1>
          <span className="term-team">{team.name.toUpperCase()}</span>
        </header>

        <section className="clockpanel">
          <span className="corner tl" /><span className="corner tr" />
          <span className="corner bl" /><span className="corner br" />
          <span className="plus a">+</span><span className="plus b">+</span>
          <span className="plus c">+</span><span className="plus d">+</span>

          <span className={`badge ${badge.tone}`}><i />{badge.label}</span>

          <div className="clock-cap">ELAPSED INVESTIGATION TIME</div>
          <BigClock text={fmtMSC(shown)} done={done} />
          <hr className="clock-rule" />

          <div className="clock-prompt">
            {awaitingRecover ? (
              <>
                <span className="verified">CODE VERIFIED</span>
                <span>PRESS</span>
                <button type="button" className="spacekey" onClick={recover}>SPACE</button>
                <span>TO RECOVER THE FILES</span>
              </>
            ) : done ? (
              <span>ARCHIVE RECORD RECOVERED</span>
            ) : running ? (
              <span>INVESTIGATION IN PROGRESS{penaltySec > 0 ? ` · PENALTY +${penaltySec}S` : ""}</span>
            ) : gameOpen ? (
              <>
                <span>PRESS</span>
                <button type="button" className="spacekey" onClick={startTimer}>SPACE</button>
                <span>TO START INVESTIGATION</span>
              </>
            ) : (
              <span>WAITING FOR THE HOST</span>
            )}
          </div>
        </section>

        <form className={`archive ${locked ? "locked" : ""}`} onSubmit={submit}>
          <h2 className="archive-title">CLASSIFIED ARCHIVE ACCESS</h2>
          <p className="archive-sub">
            Enter the {CODE_LENGTH}-digit access code to recover the restricted record.
          </p>

          <div className="archive-row">
            <div
              className={`boxes ${shake ? "shake" : ""}`}
              style={{ gridTemplateColumns: `repeat(${CODE_LENGTH}, minmax(0, 1fr))` }}
              onClick={() => inputRef.current?.focus()}
            >
              {Array.from({ length: CODE_LENGTH }, (_, i) => {
                const ch = code[i];
                const active = focused && !locked && i === activeIndex;
                return (
                  <div
                    key={i}
                    aria-hidden="true"
                    className={`box ${ch ? "filled" : ""} ${active ? "active" : ""}`}
                  >
                    {ch ? (MASK ? "•" : ch) : "_"}
                  </div>
                );
              })}
              {/* Real input sits invisibly on top, so typing, paste and phone keyboards all work */}
              <input
                ref={inputRef}
                className="boxes-input"
                value={code}
                onChange={(e) => {
                  setCode(clean(e.target.value));
                  setMsg(null);
                }}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                disabled={locked}
                inputMode={NUMERIC ? "numeric" : "text"}
                autoCapitalize="characters"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                maxLength={CODE_LENGTH}
                aria-label={`Enter the ${CODE_LENGTH}-digit access code`}
              />
            </div>

            <button
              type="submit"
              className="enter"
              disabled={locked || code.length !== CODE_LENGTH}
            >
              ENTER
            </button>
          </div>

          <p className={`archive-foot ${footerClass}`} role="status">
            <Lock open={!locked} />
            <span>{footer}</span>
          </p>
        </form>

        {done && !awaitingRecover && (
          <button
            type="button"
            className="key"
            style={{ width: "auto", padding: "0 20px", alignSelf: "center" }}
            onClick={() => setVideo(ESCAPE_VIDEO)}
          >
            ▶ Watch again
          </button>
        )}
      </div>

      {running && !done && <video src={ESCAPE_VIDEO} preload="auto" hidden />}
      {video && (
        <VideoOverlay
          src={video}
          skippable={video === INTRO_VIDEO}
          onClose={() => setVideo(null)}
        />
      )}
    </main>
  );
}