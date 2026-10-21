"use client";
import { useEffect, useRef } from "react";

export default function VideoOverlay({
  src,
  onClose,
}: {
  src: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    ref.current?.play().catch(() => {});
  }, [src]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#000",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <video
        ref={ref}
        src={src}
        playsInline
        onEnded={onClose}
        onClick={() => ref.current?.play().catch(() => {})}
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
    </div>
  );
}