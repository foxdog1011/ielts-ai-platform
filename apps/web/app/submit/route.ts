// apps/web/app/api/submit/route.ts
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { id, essay } = await req.json()

  if (!essay || essay.trim().length === 0) {
    return NextResponse.json({ error: "Essay content is required" }, { status: 400 })
  }

  // Simple simulation of processing and returning resultId
  const resultId = id || Date.now().toString()
  
  // TODO: In a real app, this would save to database
  console.log(`Processing essay submission - ID: ${resultId}, Length: ${essay.length}`)

  return NextResponse.json({ resultId, message: "Essay submitted successfully" })
}
