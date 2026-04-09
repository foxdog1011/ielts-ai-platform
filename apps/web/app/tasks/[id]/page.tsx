'use client'

import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()

  return (
    <div className="max-w-2xl mx-auto mt-20 space-y-6 text-center">
      <h1 className="text-3xl font-bold">Welcome to IELTS AI Platform</h1>
      <p className="text-gray-600">Choose a task to begin:</p>
      <div className="flex justify-center gap-6 mt-6">
        <button
          onClick={() => router.push('/tasks/1/writing')}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Writing Task
        </button>
        <button
          onClick={() => router.push('/tasks/1/speaking')}
          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
        >
          Speaking Task
        </button>
      </div>
    </div>
  )
}
