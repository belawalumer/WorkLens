import type { Metadata } from 'next'
import './globals.css'
import Toaster from '@/components/Toaster'

export const metadata: Metadata = {
  title: 'WorkLens',
  description: 'Developer workload & resource dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-slate-50 text-slate-900 antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  )
}
