'use client'

import { useState } from 'react'
import { Button, Textarea } from '@ielts/ui'

export default function Home() {
  const [essay, setEssay] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)

  async function handleSubmit() {
    const res = await fetch('/submit', {
      method: 'POST',
      body: JSON.stringify({ essay }),
    })
    const data = await res.json()
    setFeedback(data.feedback)
  }

  return (
    <div className="max-w-3xl mx-auto mt-10 space-y-4">
      <h1 className="text-2xl font-bold">IELTS Writing Task 2</h1>
      <Textarea
        rows={12}
        placeholder="Paste or write your Task 2 essay here..."
        value={essay}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEssay(e.target.value)}
      />
      <Button onClick={handleSubmit}>Submit for Feedback</Button>
      {feedback && (
        <div className="mt-6 p-4 bg-gray-100 rounded">
          <h2 className="font-semibold text-lg mb-2">AI Feedback:</h2>
          <pre className="whitespace-pre-wrap">{feedback}</pre>
        </div>
      )}
    </div>
  )
}
