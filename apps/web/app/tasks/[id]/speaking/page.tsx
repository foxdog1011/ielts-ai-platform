'use client'

import React, { useEffect, useRef, useState } from 'react'
import BackLink from '@/components/ui/BackLink'
import { Card, CardHeader, CardSection } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'

const LIMIT_SEC = 120

export default function SpeakingTaskPage() {
  const [status, setStatus] = useState<'idle' | 'recording' | 'finished'>('idle')
  const [seconds, setSeconds] = useState(LIMIT_SEC)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  useEffect(() => {
    if (status !== 'recording') return
    const t = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000)
    return () => clearInterval(t)
  }, [status])

  useEffect(() => {
    if (status === 'recording' && seconds === 0) handleStop()
  }, [status, seconds])

  function format(sec: number) {
    const m = Math.floor(sec / 60).toString().padStart(2, '0')
    const s = (sec % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  async function handleStart() {
    setSeconds(LIMIT_SEC)
    chunksRef.current = []
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mr = new MediaRecorder(stream)
    mediaRecorderRef.current = mr
    mr.ondataavailable = (e) => chunksRef.current.push(e.data)
    mr.onstop = () => setStatus('finished')
    mr.start()
    setStatus('recording')
  }

  function handleStop() {
    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current = null
  }

  function handleRecordAgain() {
    setStatus('idle')
    setSeconds(LIMIT_SEC)
    chunksRef.current = []
  }

  const tone: 'info' | 'warn' | 'success' = status === 'recording' ? 'warn' : status === 'finished' ? 'success' : 'info'

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <BackLink />
      </div>

      <Card>
        <CardHeader title="IELTS Speaking (Part 2)" subtitle="Speak for up to 2 minutes." tone="speak" />
        <CardSection>
          {/* 固定骨架，僅更新文字，避免初始結構差異 */}
          <div className="flex items-center justify-between">
            <Badge tone={tone}>{status.toUpperCase()}</Badge>
            <div className="tabular-nums text-2xl font-semibold">{format(seconds)}</div>
          </div>

          <div className="rounded-xl bg-speak-50 p-3 text-sm text-gray-800">
            <p className="font-medium text-speak">Prompt</p>
            <p className="mt-1">Describe a time when you helped someone.</p>
          </div>

          <div className="flex gap-3">
            {status !== 'recording' ? (
              <Button onClick={handleStart} variant="speak">Start Recording</Button>
            ) : (
              <Button variant="secondary" onClick={handleStop}>Stop</Button>
            )}
            <Button variant="ghost" onClick={handleRecordAgain} disabled={status !== 'finished'}>
              Record Again
            </Button>
          </div>
        </CardSection>
      </Card>

      <Card>
        <CardHeader title="Next Step" subtitle="Audio playback & AI feedback coming next." tone="speak" />
        <CardSection>
          <div className="text-sm text-gray-700">
            {status === 'finished'
              ? 'Recording finished. Playback & feedback coming next.'
              : 'We’ll add audio playback and AI feedback in the next phase.'}
          </div>
        </CardSection>
      </Card>
    </div>
  )
}
