import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { id, essay } = await req.json()


  const resultId = id


  return NextResponse.json({ resultId })
}
