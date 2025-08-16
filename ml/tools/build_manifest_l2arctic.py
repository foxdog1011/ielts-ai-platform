# tools/build_manifest_l2arctic.py
from __future__ import annotations
from pathlib import Path
import re, sys, zipfile
import pandas as pd

BASE = Path("data/raw/l2arctic")
INDEX = BASE / "wav_index.txt"
OUT = Path("data") / "speaking_manifest.csv"

def ensure_wav_index() -> list[Path]:
    if INDEX.exists():
        lines = [ln.strip() for ln in INDEX.read_text(encoding="utf-8").splitlines() if ln.strip()]
        wavs = [Path(p) for p in lines]
        if wavs:
            return wavs
    if not BASE.exists():
        print(f"[ERROR] {BASE} 不存在。請先解壓 l2arctic_release_v5.0.zip。", file=sys.stderr); sys.exit(1)
    wavs = sorted(BASE.rglob("*.wav"))
    if not wavs:
        print(f"[ERROR] 在 {BASE} 找不到任何 .wav。請先解開各說話者 ZIP（ABA.zip 等）。", file=sys.stderr); sys.exit(1)
    INDEX.write_text("\n".join(str(p) for p in wavs), encoding="utf-8")
    print(f"[INFO] 建立索引：{INDEX}（{len(wavs)} 筆）")
    return wavs

def maybe_unzip_suitcase():
    z = BASE / "suitcase_corpus.zip"
    out = BASE / "suitcase_corpus"
    if z.exists() and not out.exists():
        print(f"[UNZIP] {z} -> {out}/")
        out.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(z) as zf:
            zf.extractall(out)

def collect_txt_dir_index() -> dict[str, str]:
    """蒐集所有 txt 目錄中的逐句檔（*.txt）：key=stem 或 spk_stem。"""
    idx: dict[str, str] = {}
    txt_dirs = [p for p in BASE.rglob("txt") if p.is_dir()]
    for td in txt_dirs:
        # 嘗試猜 speaker 代碼（txt 目錄的上一層或上上層常是 <SPK>）
        parts = td.parts
        spk = ""
        if parts:
            spk = parts[-2] if len(parts) >= 2 else parts[-1]
        for f in td.glob("*.txt"):
            try:
                text = f.read_text(encoding="utf-8", errors="ignore").strip()
            except Exception:
                text = ""
            stem = f.stem
            if text:
                idx.setdefault(stem, text)
                if spk:
                    idx.setdefault(f"{spk}_{stem}", text)
    return idx

def collect_txt_done_and_prompts() -> dict[str, str]:
    """蒐集 txt.done.data / PROMPTS / *.prompts / Kaldi-style text 檔的 (utt, text)。"""
    mapping: dict[str, str] = {}
    # 1) txt.done.data（CMU）：( utt_id "TEXT" )
    for tdd in BASE.rglob("txt.done.data"):
        # speaker 嘗試抓最近的資料夾名
        parts = tdd.parts
        spk = parts[-3] if len(parts) >= 3 else (parts[-2] if len(parts) >= 2 else "")
        pat = re.compile(r'^\(\s*(\S+)\s+"(.+)"\s*\)\s*$')
        for line in tdd.read_text(encoding="utf-8", errors="ignore").splitlines():
            m = pat.match(line.strip())
            if not m: continue
            utt, text = m.group(1), m.group(2).strip()
            if text:
                mapping.setdefault(utt, text)
                if spk:
                    mapping.setdefault(f"{spk}_{utt}", text)
    # 2) PROMPTS / *.prompts / Kaldi text：格式多為「utt<空白>TEXT」
    for prom in list(BASE.rglob("PROMPTS")) + list(BASE.rglob("*.prompts")) + list(BASE.rglob("text")):
        try:
            lines = prom.read_text(encoding="utf-8", errors="ignore").splitlines()
        except Exception:
            continue
        for s in lines:
            s = s.strip()
            if not s or s.startswith("#"):  # 跳過註解
                continue
            # 常見三種：utt "TEXT"、utt TEXT、(utt "TEXT")
            m = re.match(r'^\(\s*(\S+)\s+"(.+)"\s*\)\s*$', s) or \
                re.match(r'^(\S+)\s+"(.+)"\s*$', s) or \
                re.match(r'^(\S+)\s+(.+)$', s)
            if not m: 
                continue
            utt, text = m.group(1), m.group(2).strip().strip('"')
            if text:
                mapping.setdefault(utt, text)
    return mapping

def stem_key_for_wav(w: Path) -> tuple[str, str]:
    """回傳 (stem, spk_stem) 兩個 key，供查詢索引。"""
    stem = w.stem  # arctic_a0001
    # 嘗試 speaker 代碼：通常在 wav 路徑倒數第 3 個
    spk = w.parts[-3] if len(w.parts) >= 3 else ""
    spk_stem = f"{spk}_{stem}" if spk else stem
    return stem, spk_stem

def main():
    maybe_unzip_suitcase()
    wavs = ensure_wav_index()

    # 建立兩種來源的全域索引
    idx_txt = collect_txt_dir_index()
    idx_meta = collect_txt_done_and_prompts()

    hit_txt = hit_meta = 0
    rows = []
    for w in wavs:
        stem, spk_stem = stem_key_for_wav(w)
        text = idx_txt.get(stem) or idx_txt.get(spk_stem) or idx_meta.get(spk_stem) or idx_meta.get(stem) or ""
        if text == "":
            # 再試一次：有些資料把 speaker 放在倒數第 4 個
            spk2 = w.parts[-4] if len(w.parts) >= 4 else ""
            key2 = f"{spk2}_{stem}" if spk2 else stem
            text = idx_meta.get(key2, "")
        if text:
            if stem in idx_txt or spk_stem in idx_txt:
                hit_txt += 1
            else:
                hit_meta += 1
        rows.append({"audio_path": str(w), "transcript": text})

    df = pd.DataFrame(rows)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUT, index=False)

    total = len(df)
    filled = int((df["transcript"].astype(str).str.len() > 0).sum())
    print(f"[OK] wrote {OUT} （{total} rows）")
    print(f"[STATS] 來自 txt 目錄命中：{hit_txt}，來自 PROMPTS/txt.done.data 命中：{hit_meta}")
    print(f"[STATS] 有轉錄比例：{filled/total:.1%}")

if __name__ == "__main__":
    main()
