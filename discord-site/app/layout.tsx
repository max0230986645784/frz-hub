import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
export const metadata: Metadata = {
  title: "Mr. Robot — Le bot Discord streaming",
  description: "Le bot Discord français complet pour votre communauté de streaming.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <header className="border-b border-white/10">
          <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
            <Link href="/" className="text-xl font-black tracking-tight">
              <span className="text-violet-400">MR.</span> ROBOT
            </Link>
            <div className="flex gap-5 text-sm text-slate-300">
              <Link href="/commandes">Commandes</Link>
              <Link href="/dashboard">Dashboard</Link>
            </div>
          </nav>
        </header>
        {children}
        <footer className="mx-auto mt-24 max-w-6xl border-t border-white/10 px-6 py-8 text-sm text-slate-500">
          Mr. Robot · Fait pour les communautés francophones
        </footer>
      </body>
    </html>
  );
}
