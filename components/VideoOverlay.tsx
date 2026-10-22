"use client";
import { useEffect, useRef, useState } from "react";

export default function VideoOverlay({ src, onClose }: { src: string; onClose: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    ref.current?.play().catch(() => setBlocked(true));
  }, [src]);

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
          Tap to play
        </p>
      )}
    </div>
  );
}