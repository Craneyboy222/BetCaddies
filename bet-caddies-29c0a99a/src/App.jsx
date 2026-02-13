import './App.css'
import Pages from "@/pages/index.jsx"
import { Toaster } from "@/components/ui/toaster"
import ErrorBoundary from "@/components/ErrorBoundary"
import NotificationPrompt from "@/components/NotificationPrompt"
import PWAInstallPrompt from "@/components/PWAInstallPrompt"

function App() {
  return (
    <ErrorBoundary>
      <Pages />
      <Toaster />
      <NotificationPrompt />
      <PWAInstallPrompt />
    </ErrorBoundary>
  )
}

export default App