import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import LoadingSpinner from './LoadingSpinner'

/**
 * AuthGuard wraps routes or components that require authentication and optional role checks.
 * - Shows a loading spinner while auth state is initializing.
 * - Redirects to login if no user is signed in.
 * - Displays an access-denied message if the user's role is not authorized.
 *
 * Props:
 * - children: React nodes to render when access is granted.
 * - requiredRoles (array): List of roles allowed to access; null means any authenticated user.
 * - fallback (string): Path to redirect to if not authenticated (default: '/login').
 */
const AuthGuard = ({ children, requiredRoles = null, fallback = '/login' }) => {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  // Show spinner while auth state is being determined
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <LoadingSpinner />
      </div>
    )
  }

  // If not signed in, redirect to login
  if (!user) {
    return <Navigate to={fallback} state={{ from: location }} replace />
  }

  // If role check is provided but user lacks required role, show Access Denied
  if (
    requiredRoles &&
    profile &&
    !requiredRoles.includes(profile.role)
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-6 text-center">
          <h2 className="text-3xl font-extrabold text-gray-900">
            Access Denied
          </h2>
          <p className="text-sm text-gray-600">
            You do not have permission to view this page.
          </p>
          <button
            onClick={() => location.state?.from ? window.history.back() : null}
            className="btn-secondary"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  // Access granted
  return <>{children}</>
}

export default AuthGuard
