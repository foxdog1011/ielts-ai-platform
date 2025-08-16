# tools/list_wavs.py
"""
列出 L2-ARCTIC 的 wav 檔路徑（優先讀 data/raw/l2arctic/wav_index.txt，
若不存在就現場掃描並產生）。
"""

from pathlib import Path

BASE = Path("data/raw/l2arctic")
INDEX = BASE / "wav_index.txt"

def main():
    if INDEX.exists():
        lines = INDEX.read_text(encoding="utf-8").splitlines()
    else:
        wavs = sorted(BASE.rglob("*.wav"))
        INDEX.write_text("\n".join(str(p) for p in wavs), encoding="utf-8")
        lines = [str(p) for p in wavs]
    print(f"[OK] wav 檔數量：{len(lines)}")
    for p in lines[:10]:
        print(p)

if __name__ == "__main__":
    main()
