'use client'

import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()

  return (
    <div className="max-w-4xl mx-auto px-4 py-20 space-y-8 text-center">
      <div className="space-y-4">
        <h1 className="text-4xl font-bold text-blue-700">🎯 AI IELTS Feedback</h1>
        <p className="text-xl text-gray-600">Get instant AI-powered feedback on your IELTS practice</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mt-12">
        <div 
          onClick={() => router.push('/tasks/1/writing')}
          className="p-8 bg-gradient-to-br from-blue-50 to-indigo-100 border border-blue-200 rounded-xl cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105"
        >
          <div className="text-5xl mb-4">✍️</div>
          <h2 className="text-2xl font-bold text-blue-800 mb-3">Writing Task</h2>
          <p className="text-gray-600 mb-4">Practice IELTS Writing Task 2 with AI feedback on structure, vocabulary, and arguments.</p>
          <div className="text-sm text-blue-600 font-medium">
            ⏱️ 40 minutes • 📝 250 words minimum
          </div>
        </div>

        <div 
          onClick={() => router.push('/tasks/1/speaking')}
          className="p-8 bg-gradient-to-br from-green-50 to-emerald-100 border border-green-200 rounded-xl cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105"
        >
          <div className="text-5xl mb-4">🎤</div>
          <h2 className="text-2xl font-bold text-green-800 mb-3">Speaking Task</h2>
          <p className="text-gray-600 mb-4">Record your speaking response and receive feedback on fluency, pronunciation, and content.</p>
          <div className="text-sm text-green-600 font-medium">
            ⏱️ 2 minutes • 🗣️ Voice recording
          </div>
        </div>
      </div>

      <div className="mt-12 p-6 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">✨ Features</h3>
        <div className="grid md:grid-cols-3 gap-4 text-sm text-gray-600">
          <div>🤖 AI-powered feedback</div>
          <div>📊 Detailed scoring</div>
          <div>💡 Improvement suggestions</div>
        </div>
      </div>
    </div>
  )
}
