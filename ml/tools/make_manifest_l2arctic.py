# tools/make_manifest_l2arctic.py
from __future__ import annotations
from pathlib import Path
import re
import pandas as pd

BASE = Path("data/raw/l2arctic")
INDEX = BASE / "wav_index.txt"
OUT = Path("data") / "speaking_manifest.csv"

def derive_txt(wav: Path) -> Path:
    parts = list(wav.parts)
    if "wav" in parts:
        i = len(parts) - 1 - parts[::-1].index("wav")
        parts[i] = "txt"
        return Path(*parts).with_suffix(".txt")
    return wav.with_suffix(".txt")

def read_txt_done_data_for(wav: Path) -> str | None:
    utt_id = wav.stem
    spk_root = wav.parents[1]  # .../<SPK>/<SPK>/
    etc_file = spk_root / "etc" / "txt.done.data"
    if not etc_file.exists(): return None
    pat = re.compile(r'^\(\s*(' + re.escape(utt_id) + r')\s+"(.+)"\s*\)\s*$')
    for line in etc_file.read_text(encoding="utf-8", errors="ignore").splitlines():
        m = pat.match(line.strip())
        if m: return m.group(2)
    return None

def main():
    if not INDEX.exists():
        raise SystemExit(f"{INDEX} not found. 先跑 tools/unzip_l2arctic.py 產生清單。")
    wavs = [Path(p) for p in INDEX.read_text(encoding="utf-8").splitlines()]
    rows = []
    for w in wavs:
        tpath = derive_txt(w)
        if tpath.exists():
            t = tpath.read_text(encoding="utf-8", errors="ignore").strip()
        else:
            t = read_txt_done_data_for(w) or ""
        rows.append({"audio_path": str(w), "transcript": t})
    df = pd.DataFrame(rows)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUT, index=False)
    print(f"[OK] wrote {OUT} ({len(df)} rows)")

if __name__ == "__main__":
    main()
