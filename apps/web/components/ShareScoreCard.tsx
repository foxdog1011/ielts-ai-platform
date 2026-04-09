'use client'

import { useRef, useState, useCallback } from 'react'

interface ScoreItem {
  label: string
  value: number | undefined | null
}

interface ShareScoreCardProps {
  type: 'writing' | 'speaking'
  overall: number | undefined | null
  scores: ScoreItem[]
  date?: string
}

export default function ShareScoreCard({ type, overall, scores, date }: ShareScoreCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [generating, setGenerating] = useState(false)

  const dateStr = date ?? new Date().toLocaleDateString('zh-TW', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  const bandColor = type === 'writing' ? '#3b82f6' : '#f59e0b'
  const bandGradient = type === 'writing'
    ? 'linear-gradient(135deg, #3b82f6, #6366f1)'
    : 'linear-gradient(135deg, #f59e0b, #ef4444)'

  const generateImage = useCallback(async (): Promise<Blob | null> => {
    if (!cardRef.current) return null
    const html2canvas = (await import('html2canvas')).default
    const canvas = await html2canvas(cardRef.current, {
      scale: 3,
      backgroundColor: null,
      useCORS: true,
    })
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
  }, [])

  const handleShare = useCallback(async () => {
    if (overall == null) return
    setGenerating(true)
    try {
      const blob = await generateImage()
      if (!blob) return

      const file = new File([blob], 'ielts-score.png', { type: 'image/png' })

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `IELTS ${type === 'writing' ? 'Writing' : 'Speaking'} Band ${overall}`,
          text: `I scored Band ${overall} on my IELTS ${type} practice!`,
          files: [file],
        })
        return
      }

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ielts-${type}-band${overall}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } finally {
      setGenerating(false)
    }
  }, [overall, type, generateImage])

  if (overall == null) return null

  return (
    <>
      <div style={{ position: 'fixed', left: '-9999px', top: 0, zIndex: -1 }} aria-hidden>
        <div
          ref={cardRef}
          style={{
            width: 440, padding: 32, borderRadius: 24,
            background: 'linear-gradient(160deg, #0f172a 0%, #1e293b 100%)',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            color: '#f8fafc',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: bandGradient,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 800,
            }}>
              {type === 'writing' ? 'W' : 'S'}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em' }}>
                IELTS {type === 'writing' ? 'Writing' : 'Speaking'}
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>{dateStr}</div>
            </div>
          </div>

          <div style={{
            textAlign: 'center', marginBottom: 24, padding: '20px 0',
            borderRadius: 16,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}>
            <div style={{
              fontSize: 12, fontWeight: 600, color: '#94a3b8',
              textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4,
            }}>
              Overall Band
            </div>
            <div style={{
              fontSize: 56, fontWeight: 800, letterSpacing: '-0.04em',
              background: bandGradient,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              lineHeight: 1,
            }}>
              {overall}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {scores.filter(s => s.value != null).map((s) => (
              <div key={s.label} style={{
                padding: '10px 14px', borderRadius: 12,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}>
                <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>{s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: bandColor }}>{s.value}</div>
              </div>
            ))}
          </div>

          <div style={{
            marginTop: 20, textAlign: 'center',
            fontSize: 10, color: '#475569', letterSpacing: '0.05em',
          }}>
            Powered by IELTS AI Platform
          </div>
        </div>
      </div>

      <button
        onClick={handleShare}
        disabled={generating}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-pink-200 bg-gradient-to-r from-pink-50 to-purple-50 px-4 py-2.5 text-[12px] font-medium text-pink-700 transition-all hover:from-pink-100 hover:to-purple-100 hover:shadow-sm active:scale-[0.98] disabled:opacity-50 dark:border-pink-800 dark:from-pink-950/30 dark:to-purple-950/30 dark:text-pink-300"
      >
        {generating ? (
          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-pink-300 border-t-transparent" />
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
        )}
        {generating ? '產生中...' : '分享成績卡'}
      </button>
    </>
  )
}
