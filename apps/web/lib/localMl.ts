// apps/web/lib/localMl.ts
import { spawn } from "node:child_process";
import path from "node:path";

export type LocalScore = {
  ok: boolean;
  json?: any;
  err?: string;
};

export async function runLocalScore(opts: {
  text?: string;
  audio?: string;
  transcript?: string;
  timeoutMs?: number;
}): Promise<LocalScore> {
  const ML_CWD = process.env.ML_CWD || "";
  const PYTHON_BIN = process.env.PYTHON_BIN || "";
  if (!ML_CWD || !PYTHON_BIN) {
    return { ok: false, err: "ML_CWD or PYTHON_BIN not set" };
  }

  const scorePy = path.join(ML_CWD, "src", "score_cli.py");
  const args = [scorePy];
  if (opts.text) args.push("--text", opts.text);
  if (opts.audio) args.push("--audio", opts.audio);
  if (opts.transcript) args.push("--transcript", opts.transcript);

  return new Promise<LocalScore>((resolve) => {
    const ps = spawn(PYTHON_BIN, args, { cwd: ML_CWD });
    let out = "";
    let err = "";

    const killTimer = setTimeout(() => {
      try { ps.kill("SIGKILL"); } catch {}
      resolve({ ok: false, err: "timeout" });
    }, opts.timeoutMs ?? Number(process.env.REQUEST_TIMEOUT_MS || 30000));

    ps.stdout.on("data", (d) => (out += d.toString()));
    ps.stderr.on("data", (d) => (err += d.toString()));
    ps.on("close", () => {
      clearTimeout(killTimer);
      try {
        const json = JSON.parse(out);
        resolve({ ok: true, json });
      } catch {
        resolve({ ok: false, err: err || "invalid json from score_cli.py" });
      }
    });
  });
}
