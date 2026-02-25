import { promises as fs } from "node:fs";
import path from "node:path";
import type { ExamType } from "@/lib/scoring/types";
import { clamp01, toHalfBandFrom01 } from "@/lib/scoring/utils";

type CalibrationPair = { x: number; band: number };
type CalibrationModel = {
  mode: "quantile" | "identity";
  mapVersion?: string;
  pairs: CalibrationPair[];
};

const CALIB_PATH = path.join(process.cwd(), "public", "calibration", "quantile_map.json");
let cachedModel: CalibrationModel | null = null;

function parsePairs(raw: unknown): CalibrationPair[] {
  if (!raw || typeof raw !== "object") return [];
  const obj = raw as Record<string, unknown>;

  if (Array.isArray(obj.overall01) && Array.isArray(obj.band) && obj.overall01.length === obj.band.length) {
    const out: CalibrationPair[] = [];
    for (let i = 0; i < obj.overall01.length; i++) {
      const x = Number(obj.overall01[i]);
      const b = Number(obj.band[i]);
      if (Number.isFinite(x) && Number.isFinite(b)) out.push({ x: clamp01(x), band: b });
    }
    return out.sort((a, b) => a.x - b.x);
  }

  const keys = Object.keys(obj)
    .map((k) => Number(k))
    .filter((k) => Number.isFinite(k));
  if (keys.length > 0) {
    const out: CalibrationPair[] = [];
    for (const x of keys) {
      const b = Number(obj[x.toFixed(2)] ?? obj[String(x)]);
      if (Number.isFinite(b)) out.push({ x: clamp01(x), band: b });
    }
    return out.sort((a, b) => a.x - b.x);
  }

  return [];
}

async function loadCalibrationModel(): Promise<CalibrationModel> {
  if (cachedModel) return cachedModel;
  try {
    const text = await fs.readFile(CALIB_PATH, "utf8");
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const pairs = parsePairs(parsed);
    if (pairs.length > 1) {
      cachedModel = {
        mode: "quantile",
        mapVersion: String(parsed.mode ?? "quantile"),
        pairs,
      };
      return cachedModel;
    }
  } catch {
    // fallback handled below
  }
  cachedModel = { mode: "identity", pairs: [] };
  return cachedModel;
}

function interpolateBand(pairs: CalibrationPair[], x: number): number {
  if (pairs.length === 0) return toHalfBandFrom01(x);
  if (x <= pairs[0].x) return Math.round(pairs[0].band * 2) / 2;
  if (x >= pairs[pairs.length - 1].x) return Math.round(pairs[pairs.length - 1].band * 2) / 2;

  for (let i = 1; i < pairs.length; i++) {
    const left = pairs[i - 1];
    const right = pairs[i];
    if (x >= left.x && x <= right.x) {
      const ratio = right.x === left.x ? 0 : (x - left.x) / (right.x - left.x);
      const val = left.band + (right.band - left.band) * ratio;
      return Math.round(val * 2) / 2;
    }
  }
  return toHalfBandFrom01(x);
}

export async function calibrateOverall(input: {
  examType: ExamType;
  overall_01_pre: number;
}): Promise<{
  overall_01_post: number;
  band: number;
  mode: "quantile" | "identity";
  map_version?: string;
  calibration_missing_map: boolean;
}> {
  const model = await loadCalibrationModel();
  const pre = clamp01(input.overall_01_pre);
  if (model.mode === "identity" || model.pairs.length < 2) {
    return {
      overall_01_post: pre,
      band: toHalfBandFrom01(pre),
      mode: "identity",
      calibration_missing_map: true,
    };
  }

  const band = interpolateBand(model.pairs, pre);
  const post = clamp01((band - 4) / 5);
  return {
    overall_01_post: post,
    band,
    mode: "quantile",
    map_version: `${input.examType}:${model.mapVersion ?? "quantile"}`,
    calibration_missing_map: false,
  };
}
