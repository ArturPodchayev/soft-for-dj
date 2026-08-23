// Single source of truth for a venue/DJ's branding — colors, fonts, and
// user-facing copy live here, never hardcoded in a component or in
// globals.css (that's the aut-dj-party mistake this project explicitly
// avoids, see for-claude/prompt_for_claude_code.md). Re-skinning for a
// different DJ/event is meant to be "edit this one object," with zero
// changes to components/CSS.
//
// Only one active venue for now (see the project's mulitenancy decision —
// a `venues` table lands later if/when a second client shows up); this
// module still stays the single place every other file reads branding
// from, so that migration only ever has to change how VENUE is resolved,
// not every place branding is used.
export type VenueBranding = {
  slug: string;
  djName: string;
  eventName: string;
  colors: {
    /** Page background / display background (near-black or dark). */
    background: string;
    /** Primary text/foreground color on `background`. */
    foreground: string;
    /** Primary accent — buttons, active states, ambient glow, vinyl label ring. */
    accent: string;
    /** Secondary accent — labels, "Now playing" tag, equalizer bars. */
    accentSecondary: string;
    /** Warm neutral used for cards/surfaces on light UI (submit form, admin). */
    surface: string;
    /** Text color on `surface`. */
    surfaceForeground: string;
  };
  /** RGB triples (0-255) of `accent`/`background`, for the WebGL shader's
   *  uniforms and the Vibrant palette clamp — CSS custom properties aren't
   *  readable from GLSL/canvas code, so the same two colors are duplicated
   *  here in that form. Keep in sync with colors.accent/colors.background. */
  rgb: {
    accent: [number, number, number];
    background: [number, number, number];
  };
  copy: {
    submitTitle: string;
    submitSubtitle: string;
    submitSuccessTitle: string;
    submitSuccessBody: string;
    submitRejectedTitle: string;
    submitRejectedBody: string;
    displayHeading: string;
    qrCaption: string;
  };
};

export const VENUE: VenueBranding = {
  slug: "default",
  djName: "DJ Mansur",
  eventName: "DJ Party",
  colors: {
    background: "#0b0512",
    foreground: "#f4eee7",
    accent: "#ff3d6e",
    accentSecondary: "#ffb85c",
    surface: "#f4eee7",
    surfaceForeground: "#1a1420",
  },
  rgb: {
    accent: [255, 61, 110],
    background: [11, 5, 18],
  },
  copy: {
    submitTitle: "Закажи трек",
    submitSubtitle: "Заявка попадёт диджею на модерацию",
    submitSuccessTitle: "Спасибо!",
    submitSuccessBody: "Заявка отправлена на модерацию.",
    submitRejectedTitle: "Не получилось",
    submitRejectedBody: "Заявку не удалось принять.",
    displayHeading: "Заявки на треки",
    qrCaption: "Сканируй, чтобы заказать трек",
  },
};
