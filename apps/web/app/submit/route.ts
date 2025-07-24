// apps/web/app/api/submit/route.ts
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { id, essay } = await req.json()

  // 簡單模擬處理後回傳 resultId（這邊直接回傳 id 當作 resultId）
  const resultId = id

  // 理想情況是這裡會寫入 DB，我們這裡簡化為暫存處理
  return NextResponse.json({ resultId })
}
