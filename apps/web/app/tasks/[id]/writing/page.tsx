'use client'

import React, { useMemo, useState } from 'react'
import BackLink from '@/components/ui/BackLink'
import { Card, CardHeader, CardSection } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import WordCounter from '@/components/WordCounter'

const TARGET = 250

export default function WritingTaskPage() {
  const [essay, setEssay] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [result, setResult] = useState<any>(null)

  const words = useMemo(() => (essay.trim() ? essay.trim().split(/\s+/).length : 0), [essay])
  const canSubmit = words >= Math.floor(TARGET * 0.7) && essay.trim().length > 0 && !isLoading

  async function handleSubmit() {
    if (!canSubmit) {
      setErrorMsg('Please write at least ~70% of the target word count before submitting.')
      return
    }
    setErrorMsg(null)
    setIsLoading(true)
    setResult(null)

    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: 'task-2', prompt: 'Some IELTS prompt...', essay, targetWords: TARGET })
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json?.error?.message || 'Unknown error')
      setResult(json.data)
    } catch (e: any) {
      setErrorMsg(e.message || 'Request failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <BackLink />
      </div>

      <Card>
        <CardHeader title="IELTS Writing Task 2" subtitle="Write an essay of at least 250 words." tone="brand" />
        <CardSection>
          <div className="rounded-xl bg-brand-50 p-3 text-sm text-gray-800">
            <p className="font-medium text-brand">Prompt</p>
            <p className="mt-1">Some IELTS prompt goes here. Provide a clear position and support it with examples.</p>
          </div>

          <div className="space-y-3">
            <textarea
              className="min-h-[220px] w-full resize-y rounded-2xl border border-gray-200 bg-white p-4 outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
              placeholder={`Suggested structure:\n\n1) Introduction: paraphrase the question and state your thesis.\n2) Body 1: main point + example.\n3) Body 2: counterpoint or second point + example.\n4) Conclusion: restate your position.`}
              value={essay}
              onChange={(e) => setEssay(e.target.value)}
            />
            <WordCounter text={essay} target={TARGET} />

            <div className="flex items-center gap-3">
              <Button onClick={handleSubmit} isLoading={isLoading} disabled={!canSubmit} variant="brand">
                Get AI Feedback
              </Button>
              {!canSubmit && <Badge tone="warn">Write ~70% of target before submitting</Badge>}
            </div>

            {errorMsg && <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errorMsg}</div>}
          </div>
        </CardSection>
      </Card>

      {result && (
        <Card>
          <CardHeader title="Feedback" tone="brand" />
          <CardSection>
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge tone="info">Overall: {result.band?.overall ?? '-'}</Badge>
              <Badge tone="info">TR: {result.band?.taskResponse ?? '-'}</Badge>
              <Badge tone="info">CC: {result.band?.coherence ?? '-'}</Badge>
              <Badge tone="info">LR: {result.band?.lexical ?? '-'}</Badge>
              <Badge tone="info">GRA: {result.band?.grammar ?? '-'}</Badge>
            </div>

            {Array.isArray(result.paragraphFeedback) && result.paragraphFeedback.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Paragraph Feedback</p>
                <ul className="list-disc pl-5 text-sm text-gray-700">
                  {result.paragraphFeedback.map((f: any, i: number) => (
                    <li key={i}>Para {f.index + 1}: {f.comment}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.rewritten && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Improved Version</p>
                <div className="whitespace-pre-wrap rounded-xl bg-gray-50 p-3 text-sm text-gray-800">{result.rewritten}</div>
              </div>
            )}
          </CardSection>
        </Card>
      )}
    </div>
  )
}