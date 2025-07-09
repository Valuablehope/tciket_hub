import React, { createContext, useContext, useEffect, useState } from 'react'
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

  useEffect(() => {
  const getSession = async () => {
    console.log('⏳ [AuthContext] getSession start')
    try {
      const res = await supabase.auth.getSession()
      console.log('✅ [AuthContext] getSession response:', res)
      const session = res.data.session
      if (session?.user) {
        console.log('👤 [AuthContext] session.user:', session.user)
        setUser(session.user)
        const profileData = await db.getProfile(session.user.id)
        console.log('👤 [AuthContext] profileData:', profileData)
        setProfile(profileData)
      }
    } catch (err) {
      console.error('❌ [AuthContext] getSession error:', err)
    } finally {
      console.log('⏹ [AuthContext] setLoading(false)')
      setLoading(false)
    }
  }

  getSession()

  console.log('🔔 [AuthContext] subscribing to auth changes')
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      console.log('↺ [AuthContext] auth state changed:', event, session)
      // ... your existing handler ...
    }
  )

  return () => subscription.unsubscribe()
}, [])



  const signUp = async (email, password, fullName, base) => {
    console.log('🔧 signing up with', { email, fullName, base })
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          base       // ← send the base you collected
        }
      }
    })
    console.log('🔧 signUp response', { data, error })

    if (error) throw error
    return data
  }

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) throw error
    return data
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  const updateProfile = async (updates) => {
    if (!user) throw new Error('No user logged in')
    
    const updatedProfile = await db.updateProfile(user.id, updates)
    setProfile(updatedProfile)
    return updatedProfile
  }

  const resetPassword = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    if (error) throw error
  }

  const hasRole = (role) => {
    return profile?.role === role
  }

  const hasAnyRole = (roles) => {
    return roles.includes(profile?.role)
  }

  const canAccessBase = (base) => {
    if (!profile) return false
    
    // Admin can access all bases
    if (profile.role === 'Admin') return true
    
    // Others can only access their own base
    return profile.base === base
  }

  const canManageTickets = () => {
    return hasAnyRole(['Admin', 'HIS'])
  }

  const canViewAllTickets = () => {
    return hasRole('Admin')
  }

  const value = {
    user,
    profile,
    loading,
    signUp,
    signIn,
    signOut,
    updateProfile,
    resetPassword,
    hasRole,
    hasAnyRole,
    canAccessBase,
    canManageTickets,
    canViewAllTickets
  }

  return (
    <AuthContext.Provider value={value}>
      {loading
        ? (
          <div className="flex h-screen items-center justify-center">
            <div className="loading-spinner"></div>
          </div>
        )
        : children
      }
    </AuthContext.Provider>
   )
}