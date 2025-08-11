'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const [email, setEmail] = useState('')
  const router = useRouter()

  const featureCards = [
    { 
      title: 'Writing Task 2', 
      icon: 'W', 
      description: 'Comprehensive essay analysis with detailed feedback on structure and coherence',
      href: '/tasks/1/writing',
      iconBg: 'from-blue-100 to-blue-200'
    },
    { 
      title: 'Speaking Part 2', 
      icon: 'S', 
      description: 'Advanced voice analysis with pronunciation and fluency assessment',
      href: '/tasks/1/speaking',
      iconBg: 'from-emerald-100 to-emerald-200'
    },
    { 
      title: 'Band Score Breakdown', 
      icon: 'B', 
      description: 'Detailed criterion-based scoring with improvement recommendations',
      href: '/tasks/1/writing',
      iconBg: 'from-purple-100 to-purple-200'
    },
    { 
      title: 'Feedback History', 
      icon: 'H', 
      description: 'Track your progress over time with comprehensive assessment records',
      href: '/tasks/1/writing',
      iconBg: 'from-orange-100 to-orange-200'
    },
    { 
      title: 'Pronunciation Heatmap', 
      icon: 'P', 
      description: 'Visual analysis of speech patterns with targeted improvement areas',
      href: '/tasks/1/speaking',
      iconBg: 'from-red-100 to-red-200'
    },
    { 
      title: 'Time-boxed Practice', 
      icon: 'T', 
      description: 'Realistic exam conditions with precise timing and structured feedback',
      href: '/tasks/1/writing',
      iconBg: 'from-amber-100 to-amber-200'
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-white">
      {/* Header */}
      <header className="border-b border-zinc-200/60 bg-white/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold text-zinc-900 tracking-tight">IELTS AI</div>
            <nav className="hidden md:flex items-center space-x-8">
              <a 
                href="#assessments" 
                className="text-zinc-700 hover:text-zinc-900 transition-colors duration-200 font-medium"
              >
                Assessments
              </a>
              <a 
                href="#pricing" 
                className="text-zinc-700 hover:text-zinc-900 transition-colors duration-200 font-medium"
              >
                Pricing
              </a>
              <a 
                href="#faq" 
                className="text-zinc-700 hover:text-zinc-900 transition-colors duration-200 font-medium"
              >
                FAQ
              </a>
            </nav>
            <button className="bg-gradient-to-r from-zinc-200 via-zinc-300 to-zinc-400 hover:from-zinc-300 hover:via-zinc-400 hover:to-zinc-500 text-zinc-900 px-6 py-2.5 rounded-xl font-semibold transition-all duration-300 shadow-sm hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/50 focus-visible:ring-offset-2">
              Sign in
            </button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="py-20 lg:py-28">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center max-w-4xl mx-auto">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-zinc-900 leading-tight mb-6 tracking-tight">
                Instant IELTS AI Assessment
              </h1>
              <p className="text-xl lg:text-2xl text-zinc-600 leading-relaxed mb-10 max-w-3xl mx-auto">
                Writing & Speaking scores with actionable feedback—ready in minutes.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button 
                  onClick={() => router.push('/tasks/1/writing')}
                  className="bg-gradient-to-r from-zinc-800 via-zinc-900 to-black hover:from-zinc-900 hover:via-black hover:to-zinc-900 text-white px-10 py-4 rounded-xl font-semibold text-lg transition-all duration-300 shadow-lg hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/50 focus-visible:ring-offset-2 hover:scale-105 transform">
                  Start Free Assessment
                </button>
                <button 
                  onClick={() => router.push('/tasks/1/speaking')}
                  className="bg-gradient-to-r from-zinc-100 via-zinc-200 to-zinc-300 hover:from-zinc-200 hover:via-zinc-300 hover:to-zinc-400 text-zinc-900 px-10 py-4 rounded-xl font-semibold text-lg border border-zinc-300 hover:border-zinc-400 transition-all duration-300 shadow-sm hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/50 focus-visible:ring-offset-2">
                  Explore Features
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Cards */}
        <section className="py-16 bg-gradient-to-b from-white to-zinc-50">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-4xl font-bold text-zinc-900 mb-4 tracking-tight">
                Assessment Features
              </h2>
              <p className="text-lg text-zinc-600 max-w-2xl mx-auto leading-relaxed">
                Choose your practice area and start improving with AI-powered feedback
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
              {featureCards.map((card, index) => (
                <button
                  key={index}
                  onClick={() => router.push(card.href)}
                  className="group bg-gradient-to-br from-zinc-100 via-zinc-200 to-zinc-300 hover:from-zinc-200 hover:via-zinc-300 hover:to-zinc-400 p-6 lg:p-8 rounded-2xl border border-zinc-300 hover:border-zinc-400 transition-all duration-300 shadow-sm hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/50 focus-visible:ring-offset-2 focus-visible:shadow-inner text-left w-full min-h-[200px] flex flex-col"
                  aria-label={`Access ${card.title}: ${card.description}`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-12 h-12 bg-gradient-to-br ${card.iconBg} rounded-xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow duration-300`}>
                      <span className="text-xl font-bold text-zinc-900">{card.icon}</span>
                    </div>
                    <div className="text-zinc-400 group-hover:text-zinc-600 transition-colors duration-300 mt-1">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col">
                    <h3 className="text-xl font-semibold text-zinc-900 mb-3 leading-tight">
                      {card.title}
                    </h3>
                    <p className="text-zinc-600 leading-relaxed text-sm lg:text-base flex-1">
                      {card.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Strip */}
        <section className="py-12 bg-gradient-to-r from-zinc-100 via-zinc-200 to-zinc-300 border-y border-zinc-300/60">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
              <div className="text-center lg:text-left">
                <h3 className="text-2xl font-bold text-zinc-900 mb-2">
                  Ready to boost your IELTS score?
                </h3>
                <p className="text-zinc-700 text-lg">
                  Join thousands of students achieving higher band scores with AI feedback.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto lg:min-w-96">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  className="flex-1 px-4 py-3 rounded-xl border border-zinc-300 bg-white/90 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-zinc-400/50 focus:border-zinc-400 transition-all duration-200 text-zinc-900 placeholder-zinc-500"
                />
                <button className="bg-gradient-to-r from-zinc-800 via-zinc-900 to-black hover:from-zinc-900 hover:via-black hover:to-zinc-900 text-white px-8 py-3 rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/50 focus-visible:ring-offset-2 whitespace-nowrap">
                  Get Started
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-8 bg-white border-t border-zinc-200/60">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-zinc-900 font-bold text-lg tracking-tight">IELTS AI</div>
            <div className="flex items-center space-x-8 text-sm text-zinc-600">
              <a 
                href="#privacy" 
                className="hover:text-zinc-900 transition-colors duration-200 font-medium"
              >
                Privacy
              </a>
              <a 
                href="#terms" 
                className="hover:text-zinc-900 transition-colors duration-200 font-medium"
              >
                Terms
              </a>
              <a 
                href="#contact" 
                className="hover:text-zinc-900 transition-colors duration-200 font-medium"
              >
                Contact
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}