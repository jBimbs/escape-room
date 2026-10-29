"use client";
import { useEffect, useRef, useState } from "react";

export default function VideoOverlay({
  src,
  onClose,
  skippable = false,
}: {
  src: string;
  onClose: () => void;
  skippable?: boolean; // Esc skips (used for the intro only)
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    ref.current?.play().catch(() => setBlocked(true));
  }, [src]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape" && skippable) {
        onClose();
        return;
      }
      // If the browser blocked autoplay, Space or Enter starts it
      if (blocked && (e.code === "Space" || e.code === "Enter")) {
        e.preventDefault();
        ref.current?.play().catch(() => {});
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [blocked, skippable, onClose]);

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "#000", zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <video
        ref={ref}
        src={src}
        playsInline
        preload="auto"
        onPlay={() => setBlocked(false)}
        onEnded={onClose}
        onClick={() => ref.current?.play().catch(() => {})}
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
      {blocked && (
        <p style={{ position: "absolute", color: "#cfe3d4", fontFamily: "monospace", fontSize: 24 }}>
          Press SPACE or tap to play
        </p>
      )}
    </div>
  );
}