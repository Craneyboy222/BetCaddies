import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, X, Smartphone } from 'lucide-react'

let deferredPrompt = null

// Capture the beforeinstallprompt event globally
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e
    // Dispatch custom event so our component can react
    window.dispatchEvent(new CustomEvent('pwa-installable'))
  })
}

export default function PWAInstallPrompt() {
  const [canInstall, setCanInstall] = useState(false)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // Check if already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setIsInstalled(true)
      return
    }

    // Check if prompt was dismissed recently
    const dismissed = localStorage.getItem('bc_install_dismissed')
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10)
      // Show again after 7 days
      if (Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) return
    }

    // If deferredPrompt is already captured
    if (deferredPrompt) {
      setCanInstall(true)
      // Show after a delay
      const timer = setTimeout(() => setShowPrompt(true), 10000)
      return () => clearTimeout(timer)
    }

    // Listen for the installable event
    const handler = () => {
      setCanInstall(true)
      setTimeout(() => setShowPrompt(true), 10000)
    }
    window.addEventListener('pwa-installable', handler)

    return () => window.removeEventListener('pwa-installable', handler)
  }, [])

  // Listen for successful install
  useEffect(() => {
    const handler = () => {
      setIsInstalled(true)
      setShowPrompt(false)
    }
    window.addEventListener('appinstalled', handler)
    return () => window.removeEventListener('appinstalled', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const result = await deferredPrompt.userChoice

    if (result.outcome === 'accepted') {
      setIsInstalled(true)
    }

    deferredPrompt = null
    setCanInstall(false)
    setShowPrompt(false)
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    localStorage.setItem('bc_install_dismissed', String(Date.now()))
  }

  if (isInstalled || !canInstall) return null

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          className="fixed top-36 left-4 right-4 md:left-auto md:right-6 md:w-96 z-50"
        >
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-2xl shadow-black/50">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                <Smartphone className="w-5 h-5 text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-white mb-1">
                  Install BetCaddies
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Add BetCaddies to your device for instant access, offline support, and a native app experience.
                </p>
              </div>
              <button
                onClick={handleDismiss}
                className="p-1 text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleInstall}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-violet-500 hover:bg-violet-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                Install App
              </button>
              <button
                onClick={handleDismiss}
                className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-medium rounded-lg transition-colors"
              >
                Later
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
