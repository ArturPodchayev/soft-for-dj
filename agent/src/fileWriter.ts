import { promises as fs } from "node:fs";
import path from "node:path";

// Write-then-rename: Serato's Watch Folder scan only ever sees the final
// filename appear via a single filesystem rename, an atomic operation on
// both Windows and macOS — never a `.mp3` that's still growing mid-write,
// which a poorly-timed scan could otherwise pick up and try to read
// half-written.
export async function writeToWatchFolderAtomic(
  watchFolderPath: string,
  fileName: string,
  buffer: Buffer
): Promise<string> {
  const finalPath = path.join(watchFolderPath, fileName);
  const tmpPath = `${finalPath}.tmp`;
  await fs.writeFile(tmpPath, buffer);
  await fs.rename(tmpPath, finalPath);
  return finalPath;
}
