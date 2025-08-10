'use client'

import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50">
      <div className="max-w-7xl mx-auto px-6 py-16">
        {/* Hero Section */}
        <div className="text-center mb-20 slide-in">
          <div className="inline-block mb-8 float-animation">
            <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-3xl flex items-center justify-center shadow-lg">
              <span className="text-3xl">🎯</span>
            </div>
          </div>
          <h1 className="text-7xl font-extrabold mb-6">
            <span className="bg-gradient-to-r from-gray-900 via-blue-600 to-purple-600 bg-clip-text text-transparent">
              IELTS AI
            </span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-12">
            Instant AI feedback for Writing and Speaking tasks
          </p>
        </div>

        {/* Task Cards */}
        <div className="grid lg:grid-cols-2 gap-8 mb-20">
          <div 
            onClick={() => router.push('/tasks/1/writing')}
            className="group cursor-pointer slide-in"
          >
            <div className="glass-card rounded-3xl p-8 transform transition-all duration-500 hover:scale-105 hover:shadow-2xl writing-gradient relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-6">
                  <div className="text-6xl group-hover:animate-bounce">✍️</div>
                  <div className="text-right">
                    <div className="text-sm text-gray-600">40 min</div>
                    <div className="text-sm text-gray-600">250+ words</div>
                  </div>
                </div>
                <h2 className="text-3xl font-bold text-gray-800 mb-4">Writing</h2>
                <p className="text-gray-700 mb-6">
                  Essay structure, vocabulary, grammar analysis
                </p>
                <div className="flex flex-wrap gap-2 mb-6">
                  <span className="px-3 py-1 bg-white/40 rounded-full text-xs font-medium text-gray-700">Structure</span>
                  <span className="px-3 py-1 bg-white/40 rounded-full text-xs font-medium text-gray-700">Vocabulary</span>
                  <span className="px-3 py-1 bg-white/40 rounded-full text-xs font-medium text-gray-700">Grammar</span>
                  <span className="px-3 py-1 bg-white/40 rounded-full text-xs font-medium text-gray-700">Coherence</span>
                </div>
                <div className="flex items-center text-blue-600 font-medium group-hover:translate-x-2 transition-transform duration-300">
                  Start Writing
                  <span className="ml-2">→</span>
                </div>
              </div>
            </div>
          </div>

          <div 
            onClick={() => router.push('/tasks/1/speaking')}
            className="group cursor-pointer slide-in"
          >
            <div className="glass-card rounded-3xl p-8 transform transition-all duration-500 hover:scale-105 hover:shadow-2xl speaking-gradient relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-6">
                  <div className="text-6xl group-hover:animate-pulse">🎤</div>
                  <div className="text-right">
                    <div className="text-sm text-gray-600">2 min</div>
                    <div className="text-sm text-gray-600">Voice record</div>
                  </div>
                </div>
                <h2 className="text-3xl font-bold text-gray-800 mb-4">Speaking</h2>
                <p className="text-gray-700 mb-6">
                  Fluency, pronunciation, coherence analysis
                </p>
                <div className="flex flex-wrap gap-2 mb-6">
                  <span className="px-3 py-1 bg-white/40 rounded-full text-xs font-medium text-gray-700">Fluency</span>
                  <span className="px-3 py-1 bg-white/40 rounded-full text-xs font-medium text-gray-700">Pronunciation</span>
                  <span className="px-3 py-1 bg-white/40 rounded-full text-xs font-medium text-gray-700">Coherence</span>
                  <span className="px-3 py-1 bg-white/40 rounded-full text-xs font-medium text-gray-700">Response</span>
                </div>
                <div className="flex items-center text-orange-600 font-medium group-hover:translate-x-2 transition-transform duration-300">
                  Start Speaking
                  <span className="ml-2">→</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 slide-in">
          <div className="text-center p-6 bg-white/60 rounded-2xl backdrop-blur-sm border border-white/20">
            <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">⚡</span>
            </div>
            <h3 className="font-bold text-gray-800 mb-2">Instant</h3>
            <p className="text-gray-600 text-sm">Real-time AI analysis</p>
          </div>
          
          <div className="text-center p-6 bg-white/60 rounded-2xl backdrop-blur-sm border border-white/20">
            <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">📊</span>
            </div>
            <h3 className="font-bold text-gray-800 mb-2">Detailed</h3>
            <p className="text-gray-600 text-sm">Band scores & feedback</p>
          </div>
          
          <div className="text-center p-6 bg-white/60 rounded-2xl backdrop-blur-sm border border-white/20">
            <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🎯</span>
            </div>
            <h3 className="font-bold text-gray-800 mb-2">Targeted</h3>
            <p className="text-gray-600 text-sm">Specific improvements</p>
          </div>
        </div>
      </div>
    </div>
  )
}
