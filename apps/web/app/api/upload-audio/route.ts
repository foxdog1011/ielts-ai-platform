import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { promises as fs } from "fs";
import path from "path";

const UPDIR = "/tmp/ielts-uploads";

function guessExt(mime?: string) {
  if (!mime) return "webm";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("x-wav")) return "wav";
  if (mime.includes("mpeg")) return "mp3";
  if (mime.includes("mp3")) return "mp3";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("flac")) return "flac";
  return "webm";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const audioBase64: string | undefined = body?.audioBase64;
    const mime: string | undefined = body?.mime;

    if (!audioBase64 || typeof audioBase64 !== "string") {
      return NextResponse.json({ ok: false, error: { message: "audioBase64 is required" } }, { status: 400 });
    }

    const ext = guessExt(mime);
    const fname = `${Date.now()}-${randomBytes(4).toString("hex")}.${ext}`;
    await fs.mkdir(UPDIR, { recursive: true });
    const fpath = path.join(UPDIR, fname);

    const buf = Buffer.from(audioBase64, "base64");
    await fs.writeFile(fpath, buf);

    // 僅回傳伺服器內部可讀路徑（下一步餵給 /api/speaking）
    return NextResponse.json({ ok: true, data: { path: fpath } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: { message: e?.message || "upload failed" } }, { status: 500 });
  }
}
