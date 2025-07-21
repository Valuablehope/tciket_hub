import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase, db } from '../lib/supabase'

const AuthContext = createContext({})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sessionError, setSessionError] = useState(null)
  const initialized = useRef(false)
  const timeoutRef = useRef(null)
  const listenerRef = useRef(null)
  const initializingRef = useRef(false)

  const clearSupabaseStorage = () => {
    console.log('🧹 Clearing Supabase storage')
    try {
      // Clear specific auth-related keys
      const authKeys = [
        'supabase.auth.token',
        'sb-auth-token', 
        'sb-refresh-token'
      ];
      
      // Remove specific auth keys
      authKeys.forEach(key => {
        if (localStorage.getItem(key)) {
          localStorage.removeItem(key);
          console.log(`🗑️ Removed specific key: ${key}`);
        }
      });
      
      // Also clear any keys that start with 'sb-'
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-')) {
          localStorage.removeItem(key)
          console.log(`🗑️ Removed: ${key}`)
        }
      })
      
      // Clear session storage as well
      sessionStorage.clear()
    } catch (error) {
      console.warn('⚠️ Could not clear storage completely:', error)
    }
  }

  const loadProfile = async (sessionUser) => {
    try {
      console.log('👤 Loading profile for user:', sessionUser.id)
      
      // Add timeout to profile loading
      const profilePromise = db.getProfile(sessionUser.id)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Profile loading timeout')), 5000)
      )
      
      const profileData = await Promise.race([profilePromise, timeoutPromise])
      setProfile(profileData)
      setSessionError(null) // Clear any session errors on successful profile load
      console.log('✅ Profile loaded successfully:', profileData)
      return profileData
    } catch (err) {
      console.error('❌ Failed to load profile:', err)
      console.error('❌ Profile error details:', err.message, err.stack)
      
      // Check if it's an auth-related error
      if (err.message?.includes('JWT') || 
          err.message?.includes('auth') || 
          err.code === 'PGRST301' ||
          err.name === 'AuthSessionMissingError') {
        console.warn('🔑 Profile loading failed due to auth error - session may be expired')
        setSessionError(err)
        // Don't set profile to null immediately - let the auth state handler deal with it
      } else {
        setProfile(null)
        console.log('⚠️ Continuing without profile data')
      }
      
      return null
    }
  }

  const finishLoading = () => {
    if (!initialized.current) {
      console.log('✅ Auth initialization complete')
      setLoading(false)
      initialized.current = true
    }
  }

  const handleAuthError = async (error, context) => {
    console.error(`❌ Auth error in ${context}:`, error)
    
    // Set the session error state
    setSessionError(error)
    
    // For auth session missing errors, just clear local state without trying to sign out
    if (error.name === 'AuthSessionMissingError' || 
        error.message?.includes('Auth session missing') ||
        error.message?.includes('session missing')) {
      console.log('🔄 Session missing error - clearing local state without additional sign out')
      clearSupabaseStorage()
      setUser(null)
      setProfile(null)
      setSessionError(null) // Clear error after handling
      finishLoading()
      return
    }
    
    // For other auth errors, try to sign out
    try {
      await supabase.auth.signOut()
    } catch (signOutError) {
      console.error('❌ Error during signOut:', signOutError)
      // Even if sign out fails, continue with cleanup
    }
    
    clearSupabaseStorage()
    setUser(null)
    setProfile(null)
    finishLoading()
  }

  useEffect(() => {
    // Prevent multiple initializations
    if (initializingRef.current) {
      console.log('⚠️ Auth already initializing, skipping...')
      return
    }
    
    initializingRef.current = true
    let mounted = true
    console.log('🚀 AuthProvider initializing...')

    const initializeAuth = async () => {
      try {
        // Clear any existing timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }

        // Set up auth state listener FIRST to catch any events
        const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (!mounted) return
          
          console.log(`🔁 Auth event: ${event}`, session?.user?.id || 'no user')

          // Clear timeout when we receive any auth event
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
            timeoutRef.current = null
          }

          // Clear session error on new auth events (except for errors)
          if (event !== 'SIGNED_OUT' || session) {
            setSessionError(null)
          }

          try {
            if (event === 'SIGNED_IN' && session?.user) {
              console.log('✅ User signed in:', session.user.id)
              console.log('🕒 Token expires at:', new Date(session.expires_at * 1000).toLocaleString())
              
              // Check if session is expired
              if (session.expires_at * 1000 < Date.now()) {
                console.warn('⏰ Session expired, clearing...')
                await handleAuthError(new Error('Session expired'), 'expired session')
                return
              }
              
              setUser(session.user)
              
              // Load profile but don't block auth completion
              console.log('🔄 Loading profile in background...')
              loadProfile(session.user).finally(() => {
                console.log('📝 Profile loading completed (success or failure)')
                finishLoading()
              })
            } else if (event === 'SIGNED_OUT' || !session) {
              console.log('👋 User signed out or session cleared')
              setUser(null)
              setProfile(null)
              setSessionError(null) // Clear session errors on sign out
              
              // Clean up storage on sign out
              if (event === 'SIGNED_OUT') {
                clearSupabaseStorage()
              }
              
              finishLoading()
            } else if (event === 'TOKEN_REFRESHED' && session?.user) {
              console.log('🔄 Token refreshed for user:', session.user.id)
              setUser(session.user)
              setSessionError(null) // Clear any session errors on successful refresh
              // Profile should still be valid, no need to reload
              finishLoading()
            } else {
              // Handle any other auth events
              console.log('🔄 Other auth event, finishing loading')
              finishLoading()
            }
          } catch (error) {
            console.error('❌ Error in auth state change handler:', error)
            await handleAuthError(error, 'auth state change')
          }
        })

        listenerRef.current = listener
        console.log('👂 Auth listener set up successfully')

        // Set timeout AFTER listener is set up
        timeoutRef.current = setTimeout(async () => {
          if (!mounted) return
          console.warn('⏰ Auth init timeout - no auth events received')
          
          // Try to get session one more time before giving up
          try {
            console.log('🔍 Timeout fallback: checking session...')
            const { data: { session }, error } = await supabase.auth.getSession()
            
            if (error) {
              console.error('❌ Fallback session error:', error)
              await handleAuthError(error, 'fallback session')
              return
            }
            
            if (session?.user) {
              console.log('👤 Fallback: found valid session')
              setUser(session.user)
              
              // Load profile in background
              loadProfile(session.user).finally(() => {
                console.log('📝 Fallback profile loading completed')
                finishLoading()
              })
            } else {
              console.log('👤 Fallback: no session found')
              setUser(null)
              setProfile(null)
              finishLoading()
            }
          } catch (error) {
            console.error('❌ Fallback error:', error)
            await handleAuthError(error, 'fallback')
          }
        }, 3000) // Reduced timeout to 3 seconds

        // Also try to get initial session (but don't wait for it)
        console.log('🔍 Getting initial session...')
        supabase.auth.getSession().then(({ data: { session }, error }) => {
          if (!mounted) return
          
          if (error) {
            console.error('❌ Initial session error:', error)
            return // Don't handle as error since listener will handle it
          }
          
          if (session?.user) {
            console.log('👤 Initial session found (async):', session.user.id)
            // Don't set state here - let the auth listener handle it
          } else {
            console.log('👤 No initial session found (async)')
          }
        }).catch(error => {
          console.error('❌ Initial session check failed:', error)
          // Don't handle as error since listener will handle it
        })

      } catch (error) {
        console.error('❌ Auth initialization error:', error)
        await handleAuthError(error, 'initialization')
      }
    }

    initializeAuth()

    // Manual clear shortcut: Ctrl + X
    const clearOnShortcut = async (e) => {
      if (e.ctrlKey && e.key === 'x') {
        console.log('🧹 Manual session clear triggered')
        await supabase.auth.signOut()
        clearSupabaseStorage()
        location.reload()
      }
    }

    window.addEventListener('keydown', clearOnShortcut)

    return () => {
      mounted = false
      initializingRef.current = false
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      
      window.removeEventListener('keydown', clearOnShortcut)
      
      if (listenerRef.current?.subscription?.unsubscribe) {
        listenerRef.current.subscription.unsubscribe()
      }
    }
  }, []) // Empty dependency array to run only once

  const signUp = async (email, password, fullName, base) => {
    try {
      console.log('📝 Signing up user:', email, { fullName, base })
      setSessionError(null) // Clear any existing session errors
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { 
          data: { 
            fullName: fullName,    // Changed from full_name to fullName (camelCase)
            bases: [base]          // Changed from base to bases (array)
          } 
        }
      })
      
      if (error) {
        console.error('❌ Detailed signup error:', {
          message: error.message,
          status: error.status,
          details: error.details
        })
        throw error
      }
      
      console.log('✅ User signed up successfully', data)
      return data
    } catch (error) {
      console.error('❌ Sign up error:', error)
      setSessionError(error)
      throw error
    }
  }

  const signIn = async (email, password) => {
    try {
      console.log('🔐 Signing in user:', email)
      setSessionError(null) // Clear any existing session errors
      
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      console.log('✅ User signed in successfully')
      return data
    } catch (error) {
      console.error('❌ Sign in error:', error)
      setSessionError(error)
      throw error
    }
  }

  const signOut = async () => {
    try {
      console.log('👋 Signing out user')
      setSessionError(null) // Clear any existing session errors
      
      // First check if we have a session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        console.warn('⚠️ Error getting session during sign out:', sessionError)
        // If we can't get the session, it might already be expired
        clearSupabaseStorage()
        setUser(null)
        setProfile(null)
        console.log('✅ Local state cleared due to session error')
        return
      }

      if (!session) {
        console.log('ℹ️ No active session found during sign out, clearing local data')
        clearSupabaseStorage()
        setUser(null)
        setProfile(null)
        console.log('✅ Local state cleared (no session)')
        return
      }

      // Attempt normal sign out
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        console.error('❌ Sign out error:', error)
        
        // Handle specific auth session errors gracefully
        if (error.name === 'AuthSessionMissingError' || 
            error.message?.includes('Auth session missing') ||
            error.message?.includes('session missing')) {
          console.log('🔄 Session already expired during sign out, clearing local data')
          clearSupabaseStorage()
          setUser(null)
          setProfile(null)
          console.log('✅ User signed out successfully (session was expired)')
          return // Don't throw error for expired sessions
        }
        
        // For other errors, still clear local data but throw the error
        clearSupabaseStorage()
        setUser(null)
        setProfile(null)
        console.log('⚠️ Sign out completed with error, local data cleared')
        throw error
      }
      
      clearSupabaseStorage()
      console.log('✅ User signed out successfully')
    } catch (error) {
      console.error('❌ Unexpected sign out error:', error)
      
      // Always clear local state even if sign out fails
      clearSupabaseStorage()
      setUser(null)
      setProfile(null)
      
      // Don't throw auth session missing errors
      if (error.name === 'AuthSessionMissingError' || 
          error.message?.includes('Auth session missing')) {
        console.log('✅ Sign out completed (session was already expired)')
        return
      }
      
      throw error
    }
  }

  const updateProfile = async (updates) => {
    if (!user) throw new Error('No user logged in')
    try {
      console.log('📝 Updating profile for user:', user.id)
      setSessionError(null) // Clear any existing session errors
      
      const updated = await db.updateProfile(user.id, updates)
      setProfile(updated)
      console.log('✅ Profile updated successfully')
      return updated
    } catch (error) {
      console.error('❌ Profile update error:', error)
      
      // Check if it's an auth error
      if (error.message?.includes('JWT') || 
          error.message?.includes('auth') || 
          error.code === 'PGRST301') {
        setSessionError(error)
      }
      
      throw error
    }
  }

  const resetPassword = async (email) => {
    try {
      console.log('🔑 Resetting password for:', email)
      setSessionError(null) // Clear any existing session errors
      
      const { error } = await supabase.auth.resetPasswordForEmail(email)
      if (error) throw error
      console.log('✅ Password reset email sent')
    } catch (error) {
      console.error('❌ Password reset error:', error)
      setSessionError(error)
      throw error
    }
  }

  // Helper to refresh profile when needed
  const refreshProfile = async () => {
    if (!user) return null
    return await loadProfile(user)
  }

  const hasRole = (role) => profile?.role === role
  const hasAnyRole = (roles) => roles.includes(profile?.role)
  const canAccessBase = (base) => profile?.role === 'Admin' || profile?.base === base
  const canManageTickets = () => hasAnyRole(['Admin', 'HIS'])
  const canViewAllTickets = () => hasRole('Admin')

  const value = {
    user,
    profile,
    loading,
    sessionError,
    signUp,
    signIn,
    signOut,
    updateProfile,
    resetPassword,
    refreshProfile,
    hasRole,
    hasAnyRole,
    canAccessBase,
    canManageTickets,
    canViewAllTickets,
    // Helper flags
    isAuthenticated: !!user,
    isAdmin: hasRole('Admin'),
    isHIS: hasRole('HIS'),
    isUser: hasRole('User'),
    isViewer: hasRole('Viewer'),
  }

  return (
    <AuthContext.Provider value={value}>
      {loading ? (
        <div className="flex h-screen items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="animate-spin h-10 w-10 rounded-full border-t-4 border-blue-500 border-solid mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
            {sessionError && (
              <p className="text-xs text-red-500 mt-2">
                Session issue detected - {sessionError.message}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-2">Check console for detailed logs</p>
          </div>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  )
}