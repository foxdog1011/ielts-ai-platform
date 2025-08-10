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
    const [preparationTime, setPreparationTime] = useState(60) // 1 minute prep
    const [isPreparationPhase, setIsPreparationPhase] = useState(false)

    const startPreparation = () => {
      setIsPreparationPhase(true)
      setPreparationTime(60)
      const timer = setInterval(() => {
        setPreparationTime(prev => {
          if (prev <= 1) {
            clearInterval(timer)
            setIsPreparationPhase(false)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }

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
      <div className="min-h-screen speaking-gradient">
        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Header Section */}
          <div className="text-center mb-8 slide-in">
            <div className="inline-block p-1 rounded-full bg-white/20 backdrop-blur-sm mb-4">
              <div className="bg-white/80 rounded-full px-6 py-2">
                <span className="text-2xl">🎤</span>
              </div>
            </div>
            <h1 className="text-4xl font-bold text-gray-800 mb-2">IELTS Speaking Task</h1>
            <p className="text-gray-700 text-lg">Express your ideas with confidence and fluency</p>
          </div>

          {/* Main Content Card */}
          <div className="glass-card rounded-3xl p-8 mb-6 slide-in">
            {/* Speaking Prompt */}
            <div className="bg-orange-50 border-l-4 border-orange-400 p-6 rounded-r-2xl mb-8">
              <h2 className="font-semibold text-orange-900 mb-3 flex items-center">
                <span className="text-2xl mr-2">🗣️</span>
                Speaking Topic
              </h2>
              <p className="text-orange-800 leading-relaxed mb-4">
                "Technology has changed the way people communicate with each other. Some argue that it has made communication more efficient and accessible, 
                while others believe it has reduced the quality of human interactions. Discuss both perspectives and share your own view with examples."
              </p>
              <div className="bg-orange-100 rounded-xl p-4 mt-4">
                <p className="text-orange-700 text-sm">
                  <strong>Instructions:</strong> You have 1 minute to prepare, then 2 minutes to speak. 
                  Structure your response clearly and use specific examples.
                </p>
              </div>
            </div>

            {/* Preparation Phase */}
            {isPreparationPhase && (
              <div className="text-center mb-8 fade-in-scale">
                <div className="bg-blue-100 border border-blue-300 rounded-2xl p-8">
                  <div className="text-6xl mb-4">🕐</div>
                  <h3 className="text-2xl font-bold text-blue-800 mb-2">Preparation Time</h3>
                  <div className="text-4xl font-mono text-blue-600 mb-4">
                    {formatTime(preparationTime)}
                  </div>
                  <p className="text-blue-700">Use this time to organize your thoughts and plan your response</p>
                  
                  {/* Preparation tips */}
                  <div className="mt-6 bg-white/70 rounded-xl p-4">
                    <h4 className="font-semibold text-blue-800 mb-2">Quick Planning Tips:</h4>
                    <div className="text-sm text-blue-700 grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div>• Note key points for both sides</div>
                      <div>• Think of specific examples</div>
                      <div>• Plan your conclusion</div>
                      <div>• Structure: Intro → Side A → Side B → Opinion</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Recording Interface */}
            <div className="text-center space-y-6">
              {!isPreparationPhase && !isRecording && !hasRecorded && (
                <div className="space-y-6">
                  <div className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-2xl p-8">
                    <h3 className="text-2xl font-bold text-gray-800 mb-4">Ready to speak?</h3>
                    <p className="text-gray-700 mb-6">Start with 1 minute preparation, then record your 2-minute response</p>
                    <Button 
                      onClick={startPreparation}
                      variant="primary"
                      size="lg"
                      className="px-12 py-4 text-lg font-semibold rounded-2xl transform transition-all duration-300 hover:scale-105 hover:shadow-lg"
                    >
                      <span className="flex items-center">
                        <span className="mr-2">⏰</span>
                        Start Preparation (1 min)
                      </span>
                    </Button>
                  </div>
                </div>
              )}

              {!isPreparationPhase && !isRecording && !hasRecorded && preparationTime === 0 && (
                <div className="space-y-6 fade-in-scale">
                  <div className="bg-red-50 border border-red-200 rounded-2xl p-8">
                    <div className="text-4xl mb-4">🎤</div>
                    <h3 className="text-2xl font-bold text-red-800 mb-2">Time to Record!</h3>
                    <p className="text-red-700 mb-6">You have 2 minutes to present your response</p>
                    <Button 
                      onClick={startRecording}
                      variant="danger"
                      size="lg"
                      className="px-12 py-4 text-lg font-semibold rounded-2xl transform transition-all duration-300 hover:scale-105"
                    >
                      <span className="flex items-center">
                        <span className="mr-2">🔴</span>
                        Start Recording
                      </span>
                    </Button>
                  </div>
                </div>
              )}

              {isRecording && (
                <div className="space-y-6 fade-in-scale">
                  <div className="bg-red-100 border-2 border-red-300 rounded-2xl p-8 pulse-animation">
                    <div className="text-6xl mb-4 animate-pulse">🔴</div>
                    <h3 className="text-2xl font-bold text-red-800 mb-2">Recording in Progress</h3>
                    <div className="text-5xl font-mono text-red-600 mb-4">
                      {formatTime(recordingTime)}
                    </div>
                    <div className="text-red-700 mb-6">
                      Speak clearly and naturally. You have {formatTime(120 - recordingTime)} remaining.
                    </div>
                    
                    {/* Progress bar for recording */}
                    <div className="w-full bg-red-200 rounded-full h-4 mb-6">
                      <div 
                        className="h-full bg-red-500 rounded-full transition-all duration-1000"
                        style={{ width: `${(recordingTime / 120) * 100}%` }}
                      ></div>
                    </div>
                    
                    <Button 
                      onClick={stopRecording}
                      variant="secondary"
                      size="lg"
                      className="px-8 py-3 rounded-2xl"
                    >
                      <span className="flex items-center">
                        <span className="mr-2">⏹️</span>
                        Stop Recording
                      </span>
                    </Button>
                  </div>
                </div>
              )}

              {hasRecorded && (
                <div className="space-y-6 fade-in-scale">
                  <div className="bg-green-100 border border-green-300 rounded-2xl p-8">
                    <div className="text-5xl mb-4">🎉</div>
                    <h3 className="text-2xl font-bold text-green-800 mb-2">Recording Complete!</h3>
                    <div className="bg-white/70 rounded-xl p-4 mb-6">
                      <p className="text-green-700 text-lg">
                        <strong>Duration:</strong> {formatTime(recordingTime)}
                      </p>
                      <p className="text-green-600 text-sm mt-2">
                        Great job! Your response has been captured successfully.
                      </p>
                    </div>
                    
                    <div className="flex gap-4 justify-center flex-wrap">
                      <Button 
                        onClick={() => {
                          setHasRecorded(false)
                          setRecordingTime(0)
                          setPreparationTime(60)
                        }}
                        variant="primary"
                        size="md"
                        className="flex items-center rounded-2xl px-6 py-3"
                      >
                        <span className="mr-2">🔄</span>
                        Try Again
                      </Button>
                      <Button 
                        onClick={() => {
                          // Simulate feedback generation
                          alert('🎯 AI Analysis:\n\n✅ Clear pronunciation\n✅ Good structure\n✅ Relevant examples\n\n💡 Consider using more varied vocabulary and smoother transitions between ideas.')
                        }}
                        variant="success"
                        size="md"
                        className="flex items-center rounded-2xl px-6 py-3"
                      >
                        <span className="mr-2">📊</span>
                        Get AI Feedback
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Speaking Tips Card */}
          <div className="glass-card rounded-3xl p-8 slide-in">
            <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
              <span className="text-3xl mr-3">💡</span>
              Speaking Excellence Tips
            </h3>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-blue-50 rounded-2xl p-6">
                <h4 className="font-semibold text-blue-800 mb-3 flex items-center">
                  <span className="mr-2">🎯</span>
                  Structure & Content
                </h4>
                <ul className="text-blue-700 space-y-2 text-sm">
                  <li>• Clear introduction with topic acknowledgment</li>
                  <li>• Present both viewpoints with examples</li>
                  <li>• State your opinion with solid reasoning</li>
                  <li>• Conclude by summarizing your stance</li>
                </ul>
              </div>
              
              <div className="bg-green-50 rounded-2xl p-6">
                <h4 className="font-semibold text-green-800 mb-3 flex items-center">
                  <span className="mr-2">🗣️</span>
                  Delivery & Language
                </h4>
                <ul className="text-green-700 space-y-2 text-sm">
                  <li>• Speak at a natural, measured pace</li>
                  <li>• Use varied vocabulary and expressions</li>
                  <li>• Connect ideas with linking words</li>
                  <li>• Maintain confidence throughout</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (type === 'writing') {
    const progressPercentage = Math.min((wordCount / 250) * 100, 100)
    
    return (
      <div className="min-h-screen writing-gradient">
        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Header Section */}
          <div className="text-center mb-8 slide-in">
            <div className="inline-block p-1 rounded-full bg-white/20 backdrop-blur-sm mb-4">
              <div className="bg-white/80 rounded-full px-6 py-2">
                <span className="text-2xl">✍️</span>
              </div>
            </div>
            <h1 className="text-4xl font-bold text-gray-800 mb-2">IELTS Writing Task 2</h1>
            <p className="text-gray-700 text-lg">Express your thoughts clearly and persuasively</p>
          </div>

          {/* Main Content Card */}
          <div className="glass-card rounded-3xl p-8 mb-6 slide-in">
            {/* Essay Prompt */}
            <div className="bg-blue-50 border-l-4 border-blue-400 p-6 rounded-r-2xl mb-8">
              <h2 className="font-semibold text-blue-900 mb-3 flex items-center">
                <span className="text-2xl mr-2">💭</span>
                Essay Topic
              </h2>
              <p className="text-blue-800 leading-relaxed">
                "Some people believe that social media has revolutionized communication and brought people closer together, 
                while others argue that it has created more isolation and superficial relationships. 
                Discuss both views and give your own opinion."
              </p>
            </div>

            {/* Progress and Stats */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-gray-700 flex items-center">
                  <span className="text-xl mr-2">📊</span>
                  Progress
                </h3>
                <div className="text-sm text-gray-600 flex gap-6">
                  <span className={`font-medium ${wordCount >= 250 ? 'text-green-600' : wordCount >= 200 ? 'text-amber-600' : 'text-gray-600'}`}>
                    {wordCount} / 250 words
                  </span>
                  <span className="text-gray-500">{charCount} characters</span>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="w-full bg-white/60 rounded-full h-3 overflow-hidden">
                <div 
                  className={`h-full transition-all duration-700 ease-out ${
                    progressPercentage >= 100 ? 'progress-bar' : 'bg-gradient-to-r from-blue-400 to-purple-500'
                  }`}
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
              
              {wordCount > 0 && wordCount < 200 && (
                <p className="text-amber-600 text-sm mt-2 flex items-center fade-in-scale">
                  <span className="mr-1">⚡</span>
                  Keep writing! Aim for at least 250 words for a complete response.
                </p>
              )}
              
              {wordCount >= 250 && (
                <p className="text-green-600 text-sm mt-2 flex items-center fade-in-scale">
                  <span className="mr-1">🎉</span>
                  Excellent! You've reached the target word count.
                </p>
              )}
            </div>

            {/* Writing Area */}
            <div className="space-y-4">
              <label className="block font-semibold text-gray-700 flex items-center">
                <span className="text-xl mr-2">✏️</span>
                Your Essay
              </label>
              
              <div className="relative">
                <Textarea
                  rows={16}
                  placeholder="Start writing your essay here...

Remember to:
• Introduce the topic and clearly state your position
• Present both viewpoints with specific examples
• Use linking words to connect your ideas
• Conclude by restating your opinion
• Aim for 250+ words with formal language"
                  value={essay}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEssay(e.target.value)}
                  error={!!error}
                  className="resize-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-all duration-300"
                />
                
                {/* Floating writing tips */}
                {essay.length === 0 && (
                  <div className="absolute top-4 right-4 float-animation">
                    <div className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-medium">
                      Start with your introduction! 💪
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-2xl fade-in-scale">
                <p className="text-red-700 flex items-center">
                  <span className="text-xl mr-2">⚠️</span>
                  {error}
                </p>
              </div>
            )}

            {/* Submit Button */}
            <div className="mt-8 text-center">
              <Button 
                onClick={handleSubmit}
                disabled={loadingState === 'submitting'}
                size="lg"
                className={`px-12 py-4 text-lg font-semibold rounded-2xl transform transition-all duration-300 hover:scale-105 ${
                  loadingState === 'submitting' 
                    ? 'pulse-animation' 
                    : 'hover:shadow-lg active:scale-95'
                }`}
              >
                {loadingState === 'submitting' ? (
                  <span className="flex items-center">
                    <span className="animate-spin mr-2">⚡</span>
                    Getting AI Feedback...
                  </span>
                ) : (
                  <span className="flex items-center">
                    <span className="mr-2">🚀</span>
                    Submit for Feedback
                  </span>
                )}
              </Button>
            </div>
          </div>

          {/* Feedback Section */}
          {loadingState === 'success' && feedback && (
            <div className="glass-card rounded-3xl p-8 slide-in">
              <div className="text-center mb-6">
                <div className="inline-block p-3 bg-green-100 rounded-full mb-4">
                  <span className="text-3xl">🎯</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-800">AI Feedback & Analysis</h2>
                <p className="text-gray-600 mt-2">Here's your personalized writing assessment</p>
              </div>
              
              <div className="bg-gradient-to-br from-green-50 to-blue-50 border border-green-200/50 rounded-2xl p-6">
                <div className="prose prose-lg max-w-none">
                  <pre className="whitespace-pre-wrap text-gray-800 font-sans leading-relaxed bg-transparent border-0 p-0">{feedback}</pre>
                </div>
              </div>
              
              {/* Action buttons */}
              <div className="flex gap-4 mt-6 justify-center">
                <Button
                  onClick={() => {
                    setFeedback(null)
                    setLoadingState('idle')
                    setEssay('')
                  }}
                  variant="secondary"
                  className="flex items-center"
                >
                  <span className="mr-2">🔄</span>
                  Write Another Essay
                </Button>
                <Button
                  onClick={() => window.print()}
                  variant="primary"
                  className="flex items-center"
                >
                  <span className="mr-2">📄</span>
                  Save Feedback
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return <div className="p-4">Invalid task type: {type}</div>
}
