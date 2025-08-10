// apps/web/app/tasks/layout.tsx
export default function TasksLayout({ children }: { children: React.ReactNode }) {
  return <div className="w-full mx-auto max-w-5xl px-4 py-10">{children}</div>;
}
