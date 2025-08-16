# tools/score_l2arctic.py
from __future__ import annotations
import argparse
import subprocess
import sys
from pathlib import Path
import re

BASE = Path("data/raw/l2arctic")
INDEX = BASE / "wav_index.txt"
PROJECT_ROOT = Path(__file__).resolve().parents[1]  # -> ml/
SCORE_CLI = PROJECT_ROOT / "src" / "score_cli.py"

def pick_default_wav() -> Path:
    if INDEX.exists():
        first = INDEX.read_text(encoding="utf-8").splitlines()[0]
        return Path(first)
    for p in BASE.rglob("*.wav"):
        return p
    raise SystemExit(f"[ERROR] 沒找到任何 wav。請先解壓 l2arctic speaker zip 到 {BASE}/")

def derive_txt_from_wav(wav_path: Path) -> Path:
    # .../<SPK>/<SPK>/wav/xxx.wav -> .../<SPK>/<SPK>/txt/xxx.txt
    parts = list(wav_path.parts)
    if "wav" in parts:
        i = len(parts) - 1 - parts[::-1].index("wav")
        parts[i] = "txt"
        return Path(*parts).with_suffix(".txt")
    return wav_path.with_suffix(".txt")

def read_txt_done_data_for(wav_path: Path) -> str | None:
    """
    解析 .../<SPK>/<SPK>/etc/txt.done.data 這種 (utt_id "TRANSCRIPT.") 格式
    """
    utt_id = wav_path.stem  # e.g., arctic_a0001
    # 推上兩層拿到 .../<SPK>/<SPK>/etc/txt.done.data
    p = wav_path
    # 找到第二個說話者資料夾名稱（像 ABA/ABA）
    try:
        spk_root = wav_path.parents[1]  # .../<SPK>/<SPK>/
    except Exception:
        return None
    etc_file = spk_root / "etc" / "txt.done.data"
    if not etc_file.exists():
        return None

    pat = re.compile(r'^\(\s*(' + re.escape(utt_id) + r')\s+"(.+)"\s*\)\s*$')
    for line in etc_file.read_text(encoding="utf-8", errors="ignore").splitlines():
        m = pat.match(line.strip())
        if m:
            return m.group(2)
    return None

def run_score_cli(wav: Path, transcript_text: str, with_content: bool, out_path: Path | None):
    if not SCORE_CLI.exists():
        raise SystemExit(f"[ERROR] {SCORE_CLI} 不存在。請確認你的專案結構。")

    args = [sys.executable, str(SCORE_CLI), "--audio", str(wav), "--transcript", transcript_text]
    if with_content:
        args += ["--text", transcript_text]
    if out_path is not None:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        args += ["--out", str(out_path)]

    proc = subprocess.run(args, capture_output=True, text=True, cwd=str(PROJECT_ROOT))
    if proc.returncode != 0:
        raise SystemExit(f"[ERROR] score_cli 失敗：\nSTDOUT:\n{proc.stdout}\nSTDERR:\n{proc.stderr}")
    print(proc.stdout)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--wav", type=str, default="", help="L2-ARCTIC 的 .wav 路徑。不指定時用索引第一條。")
    ap.add_argument("--with-content", action="store_true", help="同時用 transcript 當 content 打分。")
    ap.add_argument("--out", type=str, default="", help="選填：輸出 JSON 路徑")
    args = ap.parse_args()

    wav = Path(args.wav) if args.wav else pick_default_wav()
    if not wav.exists():
        raise SystemExit(f"[ERROR] wav 不存在：{wav}")

    # 先試 <SPK>/<SPK>/txt/xxx.txt
    txt_path = derive_txt_from_wav(wav)
    transcript_text = ""
    if txt_path.exists():
        transcript_text = txt_path.read_text(encoding="utf-8", errors="ignore").strip()
    else:
        # 再試 etc/txt.done.data
        t = read_txt_done_data_for(wav)
        if t:
            transcript_text = t
        else:
            transcript_text = "This is a short test sentence for evaluating fluency and pronunciation."
            print(f"[WARN] 找不到 transcript：{txt_path} 與 etc/txt.done.data，改用預設句子。")

    out_path = Path(args.out) if args.out else None
    run_score_cli(wav, transcript_text, args.with_content, out_path)

if __name__ == "__main__":
    main()
