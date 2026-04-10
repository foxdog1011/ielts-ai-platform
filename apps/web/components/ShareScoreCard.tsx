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

  const bandColor = type === 'writing' ? '#1CB0F6' : '#FFD900'
  const bandGradient = type === 'writing'
    ? 'linear-gradient(135deg, #1CB0F6, #CE82FF)'
    : 'linear-gradient(135deg, #FFD900, #FF4B4B)'
  const accentLight = type === 'writing' ? '#E8F7FE' : '#FFFDE7'

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
          title: `IELTS ${type === 'writing' ? '寫作' : '口說'} Band ${overall}`,
          text: `我在 IELTS ${type === 'writing' ? '寫作' : '口說'}練習拿到了 Band ${overall}！`,
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

  const scoreColors = ['#58CC02', '#1CB0F6', '#CE82FF', '#FFD900', '#FF4B4B']

  return (
    <>
      <div style={{ position: 'fixed', left: '-9999px', top: 0, zIndex: -1 }} aria-hidden>
        <div
          ref={cardRef}
          style={{
            width: 440, padding: 32, borderRadius: 32,
            background: 'linear-gradient(160deg, #58CC02 0%, #46a302 100%)',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            color: '#ffffff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 16,
              background: 'rgba(255,255,255,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, fontWeight: 800,
              boxShadow: '0 4px 0 0 rgba(0,0,0,0.15)',
            }}>
              {type === 'writing' ? '寫' : '說'}
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em' }}>
                IELTS {type === 'writing' ? '寫作' : '口說'}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>{dateStr}</div>
            </div>
          </div>

          <div style={{
            textAlign: 'center', marginBottom: 24, padding: '24px 0',
            borderRadius: 24,
            background: 'rgba(255,255,255,0.15)',
            border: '3px solid rgba(255,255,255,0.25)',
            boxShadow: '0 6px 0 0 rgba(0,0,0,0.1)',
          }}>
            <div style={{
              fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.8)',
              textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6,
            }}>
              整體分數
            </div>
            <div style={{
              fontSize: 64, fontWeight: 800, letterSpacing: '-0.04em',
              color: '#FFD900',
              lineHeight: 1,
              textShadow: '0 4px 0 rgba(0,0,0,0.15)',
            }}>
              {overall}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {scores.filter(s => s.value != null).map((s, idx) => (
              <div key={s.label} style={{
                padding: '12px 16px', borderRadius: 16,
                background: 'rgba(255,255,255,0.15)',
                border: '2px solid rgba(255,255,255,0.2)',
                boxShadow: '0 3px 0 0 rgba(0,0,0,0.08)',
              }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginBottom: 4, fontWeight: 700 }}>{s.label}</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: scoreColors[idx % scoreColors.length] }}>{s.value}</div>
              </div>
            ))}
          </div>

          <div style={{
            marginTop: 24, textAlign: 'center',
            fontSize: 11, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.05em', fontWeight: 700,
          }}>
            IELTS AI 智慧練習平台
          </div>
        </div>
      </div>

      <button
        onClick={handleShare}
        disabled={generating}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-[#CE82FF] bg-[#F5EEFF] px-4 py-2.5 text-sm font-bold text-[#7B2FBE] transition-all hover:bg-[#EDE0FF] shadow-[0_4px_0_0_#CE82FF] active:shadow-none active:translate-y-1 disabled:opacity-50"
      >
        {generating ? (
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#CE82FF] border-t-transparent" />
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
