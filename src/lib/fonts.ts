import { Unbounded, Inter } from "next/font/google";

// Both self-hosted via next/font/google — no external CDN dependency, and
// no licensing question to revisit later (unlike aut-dj-party's MADE
// Mirage, which was purchased under that project specifically; see
// for-claude/prompt_for_claude_code.md). Unbounded is a bold geometric
// display face for headings/track titles; Inter carries body text.
export const headingFont = Unbounded({
  variable: "--font-heading",
  subsets: ["latin", "cyrillic"],
  weight: ["500", "700", "900"],
});

export const sansFont = Inter({
  variable: "--font-sans",
  subsets: ["latin", "cyrillic"],
});
