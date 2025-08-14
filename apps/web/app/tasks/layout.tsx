// apps/web/app/tasks/layout.tsx
// 注意：不要在這裡渲染 <html> 或 <body>！

export const metadata = {
  title: "Tasks - IELTS AI",
};

export default function TasksLayout({ children }: { children: React.ReactNode }) {
  // 這裡放區域性的容器/樣式（可選）
  return (
    <div className="min-h-dvh">
      {children}
    </div>
  );
}
