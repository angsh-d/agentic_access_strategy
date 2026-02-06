import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useIsRestoring } from '@tanstack/react-query'
import { MainLayout } from './components/layout/MainLayout'
import { ErrorBoundary } from './components/ErrorBoundary'
import Dashboard from './pages/Dashboard'
import CaseDetail from './pages/CaseDetail'
import NewCase from './pages/NewCase'
import Settings from './pages/Settings'
import Policies from './pages/Policies'
import { pageTransition } from './lib/animations'

/**
 * Animated Routes wrapper for page transitions
 */
function AnimatedRoutes() {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route element={<MainLayout />}>
          {/* Dashboard / Home */}
          <Route
            path="/"
            element={
              <PageWrapper>
                <Dashboard />
              </PageWrapper>
            }
          />

          {/* Cases */}
          <Route
            path="/cases"
            element={
              <PageWrapper>
                <Dashboard />
              </PageWrapper>
            }
          />
          <Route
            path="/cases/new"
            element={
              <PageWrapper>
                <NewCase />
              </PageWrapper>
            }
          />
          <Route
            path="/cases/:caseId"
            element={
              <PageWrapper>
                <CaseDetail />
              </PageWrapper>
            }
          />

          {/* Policies - Full policy library */}
          <Route
            path="/policies"
            element={
              <PageWrapper>
                <Policies />
              </PageWrapper>
            }
          />

          {/* Settings */}
          <Route
            path="/settings"
            element={
              <PageWrapper>
                <Settings />
              </PageWrapper>
            }
          />

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </AnimatePresence>
  )
}

/**
 * Page wrapper for animation transitions
 */
function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      variants={pageTransition}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {children}
    </motion.div>
  )
}

/**
 * Loading state shown while cache is being restored from IndexedDB
 */
function CacheRestoringFallback() {
  return (
    <div className="min-h-screen bg-grey-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-grey-300 border-t-grey-900 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-grey-500">Loading...</p>
      </div>
    </div>
  )
}

/**
 * App content wrapper that waits for cache restoration
 */
function AppContent() {
  const isRestoring = useIsRestoring()

  // Show loading state while cache is being restored from IndexedDB
  if (isRestoring) {
    return <CacheRestoringFallback />
  }

  return (
    <BrowserRouter>
      <AnimatedRoutes />
    </BrowserRouter>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  )
}

export default App
