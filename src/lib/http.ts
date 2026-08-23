// Shared fetch-with-timeout helper — used by every external HTTP call in
// this project (iTunes, DeepSeek, and Module 4's search/download sources)
// so a slow/hung upstream never blocks its caller indefinitely. Each caller
// picks its own timeout; this just owns the AbortController plumbing.
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}
