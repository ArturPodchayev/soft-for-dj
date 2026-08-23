"use client";

import { useEffect, useState } from "react";
import { VENUE } from "@/config/venue";
import type { Rgb } from "@/lib/ambientPalette";

function rgba([r, g, b]: Rgb, alpha: number): string {
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Only reached when AmbientBackgroundGL couldn't get a WebGL context at all
// — this is the CSS blob version of the same idea. Colors are strictly the
// venue's fixed accent/background pair (config/venue.ts), matching
// lib/webgl/ambientShaders.ts's uniforms — deliberately NOT tinted from the
// track's album art, same policy as the WebGL path. `palette` is still
// accepted so AmbientBackgroundGL (which always forwards whatever
// useAlbumPalette extracted, regardless of which path ends up rendering)
// doesn't need a special case for this component, but it's intentionally
// unused below — a brand audit in aut-dj-party flagged album-art tinting as
// the one place this background could drift off-brand.
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept in the signature only for caller compatibility, see above
export default function AmbientBackground({ palette: _palette = [] }: { palette?: Rgb[] }) {
  const accent = VENUE.rgb.accent;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden" style={{ background: VENUE.colors.background }}>
      <div
        className="absolute inset-0 transition-opacity duration-[1500ms] ease-in-out"
        style={{ opacity: visible ? 1 : 0 }}
      >
        <div
          className="ambient-glow-secondary absolute"
          style={{
            left: "-30vw",
            top: "-35vw",
            width: "100vw",
            height: "100vw",
            borderRadius: "55% 45% 40% 60% / 50% 60% 40% 50%",
            background: `radial-gradient(circle at 45% 40%, ${rgba(accent, 0.6)} 0%, ${rgba(accent, 0)} 60%)`,
            filter: "blur(150px)",
            willChange: "transform, opacity",
          }}
        />
        <div
          className="ambient-glow-primary absolute"
          style={{
            right: "-20vw",
            bottom: "-25vw",
            width: "85vw",
            height: "85vw",
            borderRadius: "42% 58% 63% 37% / 47% 41% 59% 53%",
            background: [
              `radial-gradient(circle at 35% 35%, ${rgba(accent, 0.9)} 0%, ${rgba(accent, 0)} 60%)`,
              `radial-gradient(circle at 65% 60%, ${rgba(accent, 0.7)} 0%, ${rgba(accent, 0)} 65%)`,
            ].join(", "),
            filter: "blur(130px)",
            willChange: "transform, opacity",
          }}
        />
      </div>
    </div>
  );
}
