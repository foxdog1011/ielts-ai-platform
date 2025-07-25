import React from "react";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      {/* 你可以加上 sidebar/header 等共用內容 */}
      {children}
    </div>
  );
}
