export type SubmitSongInput = {
  requesterName: string;
  songTitle: string;
  artistName: string;
  phone: string;
};

// Country code is fixed to +998 (Uzbekistan) in the UI — the client always
// composes and sends the canonical "+998" + 9 digits form. Validated again
// here since client-side validation is UX only, never the real guard.
const PHONE_RE = /^\+998\d{9}$/;

// Real Uzbek mobile operator prefixes (the 2 digits right after +998) —
// ported from this project's brief (for-claude/prompt_for_claude_code.md).
// aut-dj-party never actually checked this (it only ran the degenerate-
// pattern heuristics below on the subscriber number); enforcing it here is
// a deliberate strengthening, not a straight port, since a made-up prefix
// like "12" is an objective, tell-the-user-and-let-them-retry format error
// — unlike the degenerate-pattern checks below, knowing "that's not a real
// operator code" doesn't help someone craft a better fake number.
const VALID_OPERATOR_PREFIXES = new Set([
  "90", "91", "93", "94", "95", "97", "98", "99", "33", "55", "77", "88",
]);

// Catches numbers typed just to get past the form, not to give a real
// contact — there's no SMS verification, so this is a cheap heuristic, not
// a guarantee.
//
// All checks run against the 7-digit SUBSCRIBER number only, not the full
// 9-digit "operator code + subscriber number" string — the 2-digit operator
// code is real and diverse by construction (see VALID_OPERATOR_PREFIXES), so
// mixing it into pattern checks would let a degenerate subscriber number
// hide behind it: e.g. "91" + "2222222" has 3 distinct digits and no
// whole-string periodic/sequential match, so a whole-string check would
// miss it even though the subscriber part is entirely "2"s.
export function isObviouslyFakePhone(nineDigits: string): boolean {
  const subscriberNumber = nineDigits.slice(2);
  const digits = subscriberNumber.split("").map(Number);

  // 2 or fewer distinct digits used across the subscriber number, e.g.
  // "1111111" or "5151515" — real numbers are almost never this repetitive.
  if (new Set(digits).size <= 2) return true;

  // A short pattern (1-3 digits) repeated to fill the subscriber number,
  // e.g. "9090909" (period 2) or "1231231" (period 3).
  for (const period of [1, 2, 3]) {
    const pattern = subscriberNumber.slice(0, period);
    const expected = pattern
      .repeat(Math.ceil(subscriberNumber.length / period))
      .slice(0, subscriberNumber.length);
    if (expected === subscriberNumber) return true;
  }

  // Looser version of the periodic check: once repeating the first 1-3
  // digits would reconstruct 80%+ of the subscriber number's positions,
  // treat it as suspicious even without an exact period match — catches
  // things like "2233223" that drift off-period but are still clearly
  // built from a tiny repeating unit.
  for (const period of [1, 2, 3]) {
    const pattern = subscriberNumber.slice(0, period);
    let matches = 0;
    for (let i = 0; i < subscriberNumber.length; i++) {
      if (subscriberNumber[i] === pattern[i % period]) matches++;
    }
    if (matches / subscriberNumber.length >= 0.8) return true;
  }

  // An exact palindrome, e.g. "1234321".
  if (subscriberNumber === [...subscriberNumber].reverse().join("")) return true;

  // Strictly sequential ascending or descending, e.g. "1234567" / "7654321".
  const ascending = digits.every((d, i) => i === 0 || d === digits[i - 1] + 1);
  const descending = digits.every((d, i) => i === 0 || d === digits[i - 1] - 1);
  if (ascending || descending) return true;

  return false;
}

export function validateSubmitSong(
  input: Partial<SubmitSongInput>
):
  | { ok: true; data: SubmitSongInput; suspiciousPhone: boolean }
  | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  const requesterName = input.requesterName?.trim() ?? "";
  const songTitle = input.songTitle?.trim() ?? "";
  const artistName = input.artistName?.trim() ?? "";
  const phone = input.phone?.trim() ?? "";

  if (requesterName.length < 2) errors.requesterName = "Введите имя";
  if (songTitle.length < 1) errors.songTitle = "Введите название трека";
  if (artistName.length < 1) errors.artistName = "Введите имя исполнителя";

  if (!PHONE_RE.test(phone)) {
    errors.phone = "Введите корректный номер телефона";
  } else if (!VALID_OPERATOR_PREFIXES.has(phone.slice(4, 6))) {
    errors.phone = "Такого оператора не существует, проверьте номер";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  // Only the format/operator-code checks above are fixable, tell-the-user
  // errors. Whether the number *looks* fake is never surfaced as a field
  // error — see the /api/requests route: it silently stores the row as
  // 'rejected' instead, so the requester never learns their phone
  // specifically was the problem and can't just try a different fake-
  // looking one.
  const suspiciousPhone = isObviouslyFakePhone(phone.slice(4));

  return { ok: true, data: { requesterName, songTitle, artistName, phone }, suspiciousPhone };
}
