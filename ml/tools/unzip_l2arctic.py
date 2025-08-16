# tools/unzip_l2arctic.py
"""
將 data/raw/l2arctic/ 下每位說話者的 ZIP（ABA.zip、BWC.zip...）全部解壓，
並遞迴尋找 .wav 檔，輸出清單到 data/raw/l2arctic/wav_index.txt
"""

from pathlib import Path
import zipfile

BASE = Path("data/raw/l2arctic")
INDEX = BASE / "wav_index.txt"

def unzip_all_speaker_zips(base: Path) -> None:
    if not base.exists():
        raise SystemExit(f"[ERROR] {base} 不存在。請先把 l2arctic_release_v5.0.zip 解壓到 {base}/")
    zips = sorted([p for p in base.glob("*.zip") if p.name.lower().endswith(".zip")])
    if not zips:
        print(f"[INFO] {base} 底下沒有找到任何 ZIP（可能已經解壓過）。")
        return

    for z in zips:
        outdir = base / z.stem
        outdir.mkdir(parents=True, exist_ok=True)
        # 若目標夾已經有 wav，跳過可加速
        if any(outdir.rglob("*.wav")):
            print(f"[SKIP] {z.name}（看起來已經解壓）")
            continue
        print(f"[UNZIP] {z.name} -> {outdir}/")
        with zipfile.ZipFile(z) as zf:
            zf.extractall(outdir)

def build_wav_index(base: Path, index_path: Path, preview: int = 5) -> None:
    wavs = sorted(base.rglob("*.wav"))
    index_path.write_text("\n".join(str(p) for p in wavs), encoding="utf-8")
    print(f"[OK] 共找到 {len(wavs)} 個 wav 檔。")
    print(f"[OK] 已寫入索引：{index_path}")
    if wavs[:preview]:
        print("[PREVIEW]")
        for p in wavs[:preview]:
            print("  ", p)

def main():
    unzip_all_speaker_zips(BASE)
    build_wav_index(BASE, INDEX)

if __name__ == "__main__":
    main()
