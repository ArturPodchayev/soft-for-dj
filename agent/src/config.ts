import fs, { existsSync, promises as fsp } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";

export type AgentConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  // The one Supabase Auth user created by hand for this agent (see
  // README.md's setup section) — signing in as it is what puts this
  // client's session under the `authenticated` Postgres role the RLS
  // policies in 0003_local_agent_rls.sql grant to, instead of the public,
  // widely-embedded anon key's own (much more limited) row access.
  agentEmail: string;
  agentPassword: string;
  watchFolderPath: string;
};

// A raw, possibly-incomplete config.json on disk — every field optional
// until validated. A fresh install ships this file with the credential
// fields blank (see README.md: they're filled in once, by hand, when the
// laptop is set up) — only watchFolderPath is meant to be filled in via the
// interactive prompt below, since that's the one value that's genuinely
// laptop-specific.
type RawConfig = Partial<AgentConfig>;

const CREDENTIAL_FIELDS = ["supabaseUrl", "supabaseAnonKey", "agentEmail", "agentPassword"] as const;

function getBaseDir(): string {
  // Packaged by pkg, process.execPath is the real .exe/binary on disk (pkg
  // sets a `pkg` property on `process` to signal this) — config.json next
  // to THAT is a real file the DJ can find in Explorer/Finder, right next
  // to the double-clicked icon. Un-packaged (plain `node dist/bundle.cjs`
  // during development), execPath is just the node binary itself —
  // argv[1] (the script being run) is the right anchor there instead.
  const isPkg = Boolean((process as unknown as { pkg?: unknown }).pkg);
  const anchor = isPkg ? process.execPath : (process.argv[1] ?? process.cwd());
  return path.dirname(anchor);
}

function configFilePath(): string {
  return path.join(getBaseDir(), "config.json");
}

async function readConfig(): Promise<RawConfig> {
  const filePath = configFilePath();
  if (!existsSync(filePath)) return {};
  try {
    const raw = await fsp.readFile(filePath, "utf8");
    return JSON.parse(raw) as RawConfig;
  } catch (err) {
    throw new Error(
      `config.json (${filePath}) повреждён или не читается (${err instanceof Error ? err.message : String(err)}). Исправь его вручную или удали, чтобы начать заново.`
    );
  }
}

async function writeConfig(config: RawConfig): Promise<void> {
  await fsp.writeFile(configFilePath(), `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

function isValidDirectory(candidate: string | undefined): candidate is string {
  return Boolean(candidate) && existsSync(candidate!) && fs.statSync(candidate!).isDirectory();
}

async function promptWatchFolder(): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    // Loops until a real, existing directory is given — a typo here would
    // otherwise only surface much later, as a far more confusing "file
    // write failed" error deep inside the very first real download.
    for (;;) {
      const answer = (await rl.question("Укажи путь к папке Serato Watch Folder: ")).trim();
      if (isValidDirectory(answer)) return answer;
      console.log(`Путь "${answer}" не найден или это не папка — попробуй ещё раз.`);
    }
  } finally {
    rl.close();
  }
}

// Implements the brief's "config.json рядом с исполняемым файлом" +
// "если отсутствует или watchFolderPath не существует — покажи
// промпт" — but ONLY for watchFolderPath. The four credential fields are
// deliberately never prompted for interactively (see README.md): they're
// meant to be provisioned once, by whoever sets up the DJ's laptop, by
// hand-editing this same file — a raw terminal prompt is the wrong place to
// type a Supabase URL or a password character-by-character.
export async function loadOrPromptConfig(): Promise<AgentConfig> {
  const raw = await readConfig();

  let watchFolderPath = raw.watchFolderPath;
  if (!isValidDirectory(watchFolderPath)) {
    watchFolderPath = await promptWatchFolder();
    await writeConfig({ ...raw, watchFolderPath });
  }

  const missing = CREDENTIAL_FIELDS.filter((key) => !raw[key]);
  if (missing.length > 0) {
    throw new Error(
      `config.json (${configFilePath()}) не заполнен: отсутствуют поля ${missing.join(", ")}. ` +
        "Эти значения выдаются один раз при настройке ноута (см. README.md, раздел \"Настройка\") — впиши их в config.json вручную и запусти агент снова."
    );
  }

  return {
    supabaseUrl: raw.supabaseUrl!,
    supabaseAnonKey: raw.supabaseAnonKey!,
    agentEmail: raw.agentEmail!,
    agentPassword: raw.agentPassword!,
    watchFolderPath,
  };
}
