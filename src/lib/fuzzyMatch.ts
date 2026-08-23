// Sanity-checks a search result (iTunes, and later the Stage 2 autosearch
// sources) against what the guest/moderator actually typed — catches a
// normalization step confidently hallucinating an unrelated track (e.g.
// DeepSeek turning a garbled title into a query that matches an entirely
// unrelated song that happens to share one common word).
//
// Requires a majority of the *smaller* side's words to overlap — much
// harder to fool by one shared common word than a plain "share at least one
// word" check, while still tolerating real differences (remasters,
// reordering, "feat." credits).
const MIN_WORD_LENGTH = 3;
const MIN_OVERLAP_RATIO = 0.5;

function wordsOf(input: string): Set<string> {
  return new Set(
    input
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "") // strip accents (café -> cafe)
      .replace(/[^a-z0-9Ѐ-ӿ]+/g, " ") // keep latin, digits, cyrillic
      .split(" ")
      .filter((w) => w.length >= MIN_WORD_LENGTH)
  );
}

export function looksLikeMatch(original: string, candidate: string): boolean {
  const originalWords = wordsOf(original);
  const candidateWords = wordsOf(candidate);

  // Nothing meaningful to compare on one side — don't block on a check we
  // can't actually perform.
  if (originalWords.size === 0 || candidateWords.size === 0) return true;

  let overlap = 0;
  for (const word of originalWords) {
    if (candidateWords.has(word)) overlap++;
  }

  const smallerSize = Math.min(originalWords.size, candidateWords.size);
  return overlap / smallerSize >= MIN_OVERLAP_RATIO;
}
