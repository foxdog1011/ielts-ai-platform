'use client'

import { useParams } from 'next/navigation'
import { useState } from 'react'
import { Button, Textarea } from '@ielts/ui'

type LoadingState = 'idle' | 'submitting' | 'success' | 'error'

export default function TaskPage() {
  const { type } = useParams() as { type: string }
  const [essay, setEssay] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [loadingState, setLoadingState] = useState<LoadingState>('idle')
  const [error, setError] = useState<string | null>(null)

  const wordCount = essay.trim().split(/\s+/).filter(word => word.length > 0).length
  const charCount = essay.length

  async function handleSubmit() {
    if (!essay.trim()) {
      setError('Please write your essay before submitting.')
      return
    }

    if (wordCount < 50) {
      setError('Your essay should be at least 50 words long.')
      return
    }

    setLoadingState('submitting')
    setError(null)
    setFeedback(null)

    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ essay, type }),
      })

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`)
      }

      const data = await res.json()
      
      if (data.error) {
        throw new Error(data.error)
      }

      setFeedback(data.feedback)
      setLoadingState('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get feedback. Please try again.')
      setLoadingState('error')
    }
  }

  if (type === 'speaking') {
    const [isRecording, setIsRecording] = useState(false)
    const [recordingTime, setRecordingTime] = useState(0)
    const [hasRecorded, setHasRecorded] = useState(false)

    const startRecording = () => {
      setIsRecording(true)
      setRecordingTime(0)
      const timer = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 120) { // 2 minutes max
            setIsRecording(false)
            setHasRecorded(true)
            clearInterval(timer)
            return 120
          }
          return prev + 1
        })
      }, 1000)
    }

    const stopRecording = () => {
      setIsRecording(false)
      setHasRecorded(true)
    }

    const formatTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60)
      const secs = seconds % 60
      return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    return (
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-blue-700">IELTS Speaking Task</h1>
          <p className="text-gray-600">You have 2 minutes to speak on this topic. Prepare for 1 minute first.</p>
        </div>

        <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg">
          <h2 className="font-semibold text-lg mb-3">📝 Speaking Prompt:</h2>
          <p className="text-gray-700 leading-relaxed">
            "Some people think that social media has a positive impact on society, while others believe it has negative effects. 
            Discuss both views and give your own opinion. Use specific examples to support your answer."
          </p>
        </div>

        <div className="text-center space-y-4">
          {!isRecording && !hasRecorded && (
            <Button 
              onClick={startRecording}
              variant="danger"
              size="lg"
              className="px-8"
            >
              🎤 Start Recording
            </Button>
          )}

          {isRecording && (
            <div className="space-y-4">
              <div className="text-2xl font-mono text-red-600">
                🔴 Recording: {formatTime(recordingTime)}
              </div>
              <Button 
                onClick={stopRecording}
                variant="secondary"
                size="md"
              >
                ⏹️ Stop Recording
              </Button>
            </div>
          )}

          {hasRecorded && (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-700"> Recording completed! Duration: {formatTime(recordingTime)}</p>
              </div>
              <div className="flex gap-3 justify-center">
                <Button 
                  onClick={() => {
                    setHasRecorded(false)
                    setRecordingTime(0)
                  }}
                  variant="primary"
                  size="md"
                >
                  🔄 Record Again
                </Button>
                <Button 
                  onClick={() => alert('Submit functionality coming soon!')}
                  variant="success"
                  size="md"
                >
                  📤 Submit for Feedback
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">💡 Speaking Tips:</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Use the preparation time to organize your thoughts</li>
            <li>• Present both viewpoints clearly with examples</li>
            <li>• State your own opinion and justify it</li>
            <li>• Speak clearly and at a natural pace</li>
            <li>• Aim to use varied vocabulary and sentence structures</li>
          </ul>
        </div>
      </div>
    )
  }

  if (type === 'writing') {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-blue-700">IELTS Writing Task 2</h1>
          <p className="text-gray-600">Write at least 250 words discussing both views and giving your opinion.</p>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm text-gray-500">
            <span>Word count: {wordCount} / 250</span>
            <span>Characters: {charCount}</span>
          </div>
          <Textarea
            rows={12}
            placeholder="Write your Task 2 essay here. Remember to:&#10;• Introduce the topic and state your opinion&#10;• Discuss both viewpoints with examples&#10;• Conclude by restating your position&#10;• Use formal language and clear structure"
            value={essay}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEssay(e.target.value)}
            error={!!error}
          />
          {wordCount > 0 && wordCount < 50 && (
            <p className="text-amber-600 text-sm"> Your essay is quite short. Aim for at least 250 words.</p>
          )}
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-700 text-sm"> {error}</p>
          </div>
        )}

        <Button 
          onClick={handleSubmit}
          disabled={loadingState === 'submitting'}
          size="lg"
          className="w-full"
        >
          {loadingState === 'submitting' ? '✨ Getting AI Feedback...' : 'Submit for Feedback'}
        </Button>

        {loadingState === 'success' && feedback && (
          <div className="mt-6 p-6 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg">
            <h2 className="font-semibold text-lg mb-3 text-green-800">🎯 AI Feedback:</h2>
            <div className="prose prose-sm max-w-none">
              <pre className="whitespace-pre-wrap text-gray-700 font-sans leading-relaxed">{feedback}</pre>
            </div>
          </div>
        )}
      </div>
    )
  }

  return <div className="p-4">Invalid task type: {type}</div>
}
