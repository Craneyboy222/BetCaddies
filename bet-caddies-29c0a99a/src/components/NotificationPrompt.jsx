import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, BellOff, X } from 'lucide-react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? (
  import.meta.env.DEV ? 'http://localhost:3000' : ''
)

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i)
  }
  return output
}

async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return null
  }

  const registration = await navigator.serviceWorker.ready

  // Get VAPID public key from server
  const res = await fetch(`${API_BASE_URL}/api/push/vapid-public-key`)
  if (!res.ok) return null
  const { publicKey } = await res.json()
  if (!publicKey) return null

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  })

  // Send subscription to server
  const token = window.localStorage?.getItem('betcaddies_token') || null
  await fetch(`${API_BASE_URL}/api/push/subscribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ subscription }),
  })

  return subscription
}

async function unsubscribeFromPush() {
  if (!('serviceWorker' in navigator)) return

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()

  if (subscription) {
    const endpoint = subscription.endpoint
    await subscription.unsubscribe()

    await fetch(`${API_BASE_URL}/api/push/unsubscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint }),
    }).catch(() => {})
  }
}

export default function NotificationPrompt() {
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  )
  const [showPrompt, setShowPrompt] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)

  useEffect(() => {
    // Check if push is supported
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

    // Check current subscription status
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        setIsSubscribed(!!sub)
      })
    })

    // Show prompt if not yet decided (after a delay)
    if (Notification.permission === 'default') {
      const dismissed = sessionStorage.getItem('bc_push_dismissed')
      if (!dismissed) {
        const timer = setTimeout(() => setShowPrompt(true), 5000)
        return () => clearTimeout(timer)
      }
    }
  }, [])

  const handleEnable = async () => {
    const result = await Notification.requestPermission()
    setPermission(result)

    if (result === 'granted') {
      const sub = await subscribeToPush()
      setIsSubscribed(!!sub)
    }

    setShowPrompt(false)
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    sessionStorage.setItem('bc_push_dismissed', '1')
  }

  const handleDisable = async () => {
    await unsubscribeFromPush()
    setIsSubscribed(false)
  }

  // Don't render anything on unsupported browsers
  if (typeof Notification === 'undefined' || !('serviceWorker' in navigator)) {
    return null
  }

  return (
    <AnimatePresence>
      {showPrompt && permission === 'default' && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-24 left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:w-96 z-50"
        >
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-2xl shadow-black/50">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <Bell className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-white mb-1">
                  Never Miss a Pick
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Get instant alerts when new picks go live, results are settled, and winners land.
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
                onClick={handleEnable}
                className="flex-1 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Enable Notifications
              </button>
              <button
                onClick={handleDismiss}
                className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-medium rounded-lg transition-colors"
              >
                Not Now
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Export helpers for use in settings pages
export { subscribeToPush, unsubscribeFromPush }
