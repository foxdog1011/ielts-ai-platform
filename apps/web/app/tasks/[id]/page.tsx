'use client'

import { Button } from '@ielts/ui'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()

  return (
    <div className="max-w-2xl mx-auto mt-20 space-y-6 text-center">
      <h1 className="text-3xl font-bold">Welcome to IELTS AI Platform</h1>
      <p className="text-gray-600">Choose a task to begin:</p>
      <div className="flex justify-center gap-6 mt-6">
        <Button onClick={() => router.push('/tasks/1/writing')}>Writing Task</Button>
        <Button onClick={() => router.push('/tasks/1/speaking')}>Speaking Task</Button>
      </div>
    </div>
  )
}
