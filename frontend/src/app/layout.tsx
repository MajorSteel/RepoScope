import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RepoScope – Repository Intelligence & Architecture Visualization System",
  description: "Analyze, index, visualize, and benchmark software codebases of any size. Identify architectural smells, calculate maintainability, scan secrets, audit CI/CD pipelines, and chat with your codebase using RAG.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#080c14] text-slate-100">
        {children}
      </body>
    </html>
  );
}
