'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'

export default function Home() {
  return (
    <main style={{
      minHeight: '100vh',
      background: '#030508',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Space Mono, monospace',
      padding: '2rem',
    }}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        style={{ textAlign: 'center' }}
      >
        <div style={{ fontSize: '11px', letterSpacing: '6px', color: '#00f5ff', marginBottom: '12px' }}>
          SAKURA SHIELD
        </div>
        <h1 style={{
          fontSize: 'clamp(28px, 5vw, 48px)',
          letterSpacing: '6px',
          color: '#ffffff',
          fontFamily: 'Orbitron, sans-serif',
          marginBottom: '8px',
        }}>
          ENGINEERING DASHBOARD
        </h1>
        <p style={{ fontSize: '12px', color: '#00f5ff', letterSpacing: '4px', marginBottom: '48px' }}>
          INDUSTRIAL QA & AUTOMATION SUITE
        </p>

        <Link
          href="/engineering-dashboard"
          style={{
            display: 'inline-block',
            padding: '14px 48px',
            border: '1px solid #00f5ff',
            color: '#00f5ff',
            letterSpacing: '3px',
            fontSize: '12px',
            textDecoration: 'none',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => {
            (e.target as HTMLAnchorElement).style.background = 'rgba(0,245,255,0.1)'
          }}
          onMouseLeave={e => {
            (e.target as HTMLAnchorElement).style.background = 'transparent'
          }}
        >
          ACCESS DASHBOARD →
        </Link>
      </motion.div>
    </main>
  )
}
