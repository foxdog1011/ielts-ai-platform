// DEPRECATED: This route is a non-functional stub.
// The real writing submission endpoint is POST /api/writing.
// Keeping this file to avoid 404s in case any legacy clients reference it.
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Deprecated. Use POST /api/writing instead." },
    { status: 410 },
  );
}
