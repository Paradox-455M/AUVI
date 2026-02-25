import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from './AuthContext'

export function AuthView() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await register(email, password, displayName)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const switchMode = () => {
    setMode((m) => (m === 'login' ? 'register' : 'login'))
    setError(null)
  }

  return (
    <div className="w-screen h-screen bg-[var(--color-bg-primary)] flex items-center justify-center">
      <motion.div
        className="w-full max-w-sm px-8"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      >
        <h1 className="display-cinematic text-[var(--color-text-primary)] mb-12 tracking-[0.08em]">
          Auvi
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <AnimatePresence mode="wait">
            {mode === 'register' && (
              <motion.div
                key="displayName"
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                style={{ overflow: 'hidden' }}
              >
                <input
                  type="text"
                  placeholder="Display name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required={mode === 'register'}
                  className="w-full bg-transparent border-b border-white/20 pb-2 text-[var(--color-text-primary)] body-editorial placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:border-white/50 transition-colors"
                />
              </motion.div>
            )}
          </AnimatePresence>

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full bg-transparent border-b border-white/20 pb-2 text-[var(--color-text-primary)] body-editorial placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:border-white/50 transition-colors"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full bg-transparent border-b border-white/20 pb-2 text-[var(--color-text-primary)] body-editorial placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:border-white/50 transition-colors"
          />

          {error && (
            <p className="body-small text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-4 nav-label tracking-[0.2em] text-[var(--color-text-primary)] hover:opacity-70 transition-opacity disabled:opacity-40 text-left"
          >
            {isSubmitting ? 'Please wait...' : mode === 'login' ? 'Enter' : 'Create account'}
          </button>
        </form>

        <button
          type="button"
          onClick={switchMode}
          className="mt-8 nav-label text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors tracking-[0.16em]"
        >
          {mode === 'login' ? 'Create account' : 'Sign in'}
        </button>
      </motion.div>
    </div>
  )
}
