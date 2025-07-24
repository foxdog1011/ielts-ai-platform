'use client'

import { useState } from 'react'

export default function IELTSPage() {
  const [taskType, setTaskType] = useState<'task1' | 'task2'>('task2')
  const [essay, setEssay] = useState('')
  const [result, setResult] = useState<string | null>(null)

  const handleSubmit = async () => {
    const res = await fetch('/api/ielts', {
      method: 'POST',
      body: JSON.stringify({ taskType, essay }),
      headers: { 'Content-Type': 'application/json' }
    })
    const data = await res.json()
    setResult(data.feedback)
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">IELTS Writing Correction</h1>

      <div>
        <label className="mr-4">Choose Task:</label>
        <select value={taskType} onChange={(e) => setTaskType(e.target.value as any)}>
          <option value="task1">Task 1</option>
          <option value="task2">Task 2</option>
        </select>
      </div>

      <textarea
        value={essay}
        onChange={(e) => setEssay(e.target.value)}
        rows={10}
        className="w-full p-2 border rounded"
        placeholder="Write your IELTS essay here..."
      />

      <button onClick={handleSubmit} className="px-4 py-2 bg-blue-500 text-white rounded">
        Submit
      </button>

      {result && (
        <div className="mt-4 p-4 border bg-gray-100 rounded">
          <h2 className="font-semibold">Correction Result:</h2>
          <pre className="whitespace-pre-wrap">{result}</pre>
        </div>
      )}
    </div>
  )
}
