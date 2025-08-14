'use client';
import { createContext, useContext, useState, useCallback } from 'react';

type Toast = { id: string; text: string };
const Ctx = createContext<{ push: (t: string) => void }>({ push: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const push = useCallback((text: string) => {
    const id = Math.random().toString(36).slice(2);
    setList((xs) => [...xs, { id, text }]);
    setTimeout(() => setList((xs) => xs.filter((x) => x.id !== id)), 1800);
  }, []);
  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 space-y-2">
        {list.map((t) => (
          <div key={t.id} className="rounded-lg border border-zinc-200 bg-white/90 px-3 py-1.5 text-[12px] shadow">
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
export function useToast() { return useContext(Ctx); }
