import type { Metadata, Viewport } from 'next'
import { Orbitron, Space_Mono } from 'next/font/google'
import './globals.css'

const orbitron = Orbitron({
  subsets:  ['latin'],
  variable: '--font-orbitron',
  display:  'swap',
})

const spaceMono = Space_Mono({
  subsets:  ['latin'],
  weight:   ['400', '700'],
  variable: '--font-space-mono',
  display:  'swap',
})

export const viewport: Viewport = {
  themeColor:  '#070b14',
  colorScheme: 'dark',
  width:       'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  title: {
    default:  'Sakura Shield — QA & Automation Suite',
    template: '%s | Sakura Shield',
  },
  description:
    'Industrial QA & Automation Suite for the Sakura ecosystem. Playwright E2E, Percy visual regression, k6 load testing, OWASP ZAP security.',
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${orbitron.variable} ${spaceMono.variable}`}>
      <body className="antialiased" style={{ background: '#030508' }}>
        {children}
      </body>
    </html>
  )
}
