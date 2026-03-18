#!/usr/bin/env python3
"""
IELTS Writing MAE Evaluation
Runs gold-labeled essays through /api/writing and computes:
  - MAE, RMSE
  - ±0.5 accuracy (within half a band)
  - ±1.0 accuracy
  - Latency stats (p50, p95)
  - LLM-only vs fused comparison (from scoreTrace)
"""
from __future__ import annotations

import json
import statistics
import sys
import time
from pathlib import Path

try:
    import requests
except ImportError:
    print("[ERROR] 請先安裝 requests: pip install requests", file=sys.stderr)
    sys.exit(1)

API_URL = "http://localhost:3010/api/writing"
GOLD_FILE = Path(__file__).parent / "eval_gold.json"
RESULTS_FILE = Path(__file__).parent / "eval_results.json"

def call_api(essay_id: str, prompt: str, essay: str) -> dict:
    payload = {
        "taskId": essay_id,
        "prompt": prompt,
        "essay": essay,
        "seconds": 2400,
    }
    t0 = time.perf_counter()
    resp = requests.post(API_URL, json=payload, timeout=60)
    elapsed_ms = (time.perf_counter() - t0) * 1000
    resp.raise_for_status()
    data = resp.json()
    return {"response": data, "elapsed_ms": elapsed_ms}

def extract_scores(response: dict) -> dict:
    """Extract predicted band and LLM-only band from API response."""
    data = response.get("data", {})
    band_obj = data.get("band", {})
    predicted = band_obj.get("overall")

    # Try to get LLM-only score from scoreTrace
    trace = data.get("scoreTrace", {})
    llm_subs = trace.get("llm_subscores", {})
    llm_pre_cal = trace.get("final_overall_pre_calibration")
    # Approximate LLM-only band: map llm pre-cal back through the fused band
    # We use the fused band as the best estimate; LLM-only is reported if available
    return {
        "predicted_band": predicted,
        "llm_pre_calibration": llm_pre_cal,
        "score_trace_available": bool(trace),
        "study_plan_reason": data.get("studyPlan", {}).get("reason"),
    }

def main():
    gold_data = json.loads(GOLD_FILE.read_text(encoding="utf-8"))
    print(f"[INFO] Loaded {len(gold_data)} gold essays")
    print(f"[INFO] API: {API_URL}\n")
    print(f"{'ID':<6} {'Gold':>5} {'Pred':>5} {'Error':>7}  Status")
    print("-" * 45)

    results = []
    errors = []

    for item in gold_data:
        eid   = item["id"]
        gold  = float(item["gold_band"])
        prompt = item["prompt"]
        essay  = item["essay"]

        try:
            raw = call_api(eid, prompt, essay)
            scores = extract_scores(raw["response"])
            pred = scores["predicted_band"]

            if pred is None:
                print(f"{eid:<6} {gold:>5.1f}  {'N/A':>5}  {'N/A':>7}  [NO SCORE]")
                errors.append({"id": eid, "error": "no predicted band"})
                continue

            pred = float(pred)
            err  = abs(pred - gold)
            sign = "+" if pred > gold else ("-" if pred < gold else " ")
            print(f"{eid:<6} {gold:>5.1f} {pred:>5.1f} {sign}{err:>6.2f}  [{raw['elapsed_ms']:>5.0f}ms]")

            results.append({
                "id": eid,
                "gold": gold,
                "predicted": pred,
                "abs_error": round(err, 3),
                "signed_error": round(pred - gold, 3),
                "elapsed_ms": round(raw["elapsed_ms"], 1),
                **scores,
            })

        except Exception as e:
            print(f"{eid:<6} {gold:>5.1f}   ERR        [ERROR: {e}]")
            errors.append({"id": eid, "error": str(e)})

        time.sleep(0.5)  # rate-limit courtesy

    if not results:
        print("\n[ERROR] No successful results.")
        sys.exit(1)

    # ── Metrics ──────────────────────────────────────────────────────────────
    n = len(results)
    abs_errors = [r["abs_error"] for r in results]
    signed_errors = [r["signed_error"] for r in results]
    latencies = [r["elapsed_ms"] for r in results]

    mae  = statistics.mean(abs_errors)
    rmse = (statistics.mean(e**2 for e in abs_errors)) ** 0.5
    bias = statistics.mean(signed_errors)
    within_05 = sum(1 for e in abs_errors if e <= 0.5) / n * 100
    within_10 = sum(1 for e in abs_errors if e <= 1.0) / n * 100

    lat_sorted = sorted(latencies)
    p50 = lat_sorted[int(n * 0.5)]
    p95 = lat_sorted[min(int(n * 0.95), n - 1)]

    print("\n" + "=" * 45)
    print(f"  N essays evaluated : {n}  ({len(errors)} errors)")
    print(f"  MAE                : {mae:.3f} bands")
    print(f"  RMSE               : {rmse:.3f} bands")
    print(f"  Bias               : {bias:+.3f} bands")
    print(f"  Within ±0.5 band   : {within_05:.1f}%")
    print(f"  Within ±1.0 band   : {within_10:.1f}%")
    print(f"  Latency p50        : {p50:.0f} ms")
    print(f"  Latency p95        : {p95:.0f} ms")
    print("=" * 45)

    # ── Save results ─────────────────────────────────────────────────────────
    out = {
        "summary": {
            "n": n,
            "errors": len(errors),
            "mae": round(mae, 4),
            "rmse": round(rmse, 4),
            "bias": round(bias, 4),
            "within_0_5_pct": round(within_05, 1),
            "within_1_0_pct": round(within_10, 1),
            "latency_p50_ms": round(p50, 1),
            "latency_p95_ms": round(p95, 1),
        },
        "per_essay": results,
        "failed": errors,
    }
    RESULTS_FILE.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\n[OK] Full results saved → {RESULTS_FILE}")

if __name__ == "__main__":
    main()
