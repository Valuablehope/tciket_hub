import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useAuth } from '../contexts/AuthContext'
import { Eye, EyeOff, UserPlus, CheckCircle, Sparkles } from 'lucide-react'
import { db } from '../lib/supabase.js'

const SignupPage = () => {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [bases, setBases] = useState([])
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    watch
  } = useForm()

  const password = watch('password')

  useEffect(() => {
    // Fetch bases from the database
    const fetchBases = async () => {
      try {
        const result = await db.getAllBases()
        // Support both { data, error } and direct array return
        let basesArray = Array.isArray(result) ? result : result?.data
        if (!Array.isArray(basesArray)) basesArray = []
        setBases(basesArray)
      } catch (err) {
        setBases([])
      }
    }
    fetchBases()
  }, [])

  const onSubmit = async (data) => {
    try {
      setLoading(true)
      await signUp(data.email, data.password, data.fullName, data.base)
      setSuccess(true)
      setTimeout(() => {
        navigate('/login')
      }, 3000)
    } catch (error) {
      setError('root', {
        type: 'manual',
        message: error.message
      })
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white/90 via-white/80 to-gray-100/80 relative overflow-hidden">
        {/* Smokey white background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -left-32 w-96 h-96 bg-white/60 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-gray-200/40 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>
        <div className="relative w-full max-w-lg">
          <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-10 shadow-2xl border border-white/60 text-center">
            <div className="flex items-center justify-center w-20 h-20 bg-gradient-to-br from-gray-200 to-gray-100 rounded-full mb-6 shadow-lg mx-auto">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
            <h1 className="text-3xl font-extrabold text-gray-800 mb-3">Account Created!</h1>
            <p className="text-gray-700 mb-3">Please check your email to verify your account.</p>
            <p className="text-gray-500 text-sm">Redirecting to login page...</p>
            <div className="mt-8 w-full bg-gray-200/60 rounded-full h-2">
              <div className="bg-gradient-to-r from-gray-300 to-gray-100 h-2 rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white/90 via-white/80 to-gray-100/80 relative overflow-hidden">
      {/* Smokey white background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-white/60 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-gray-200/40 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>
      <div className="relative w-full max-w-lg">
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-10 shadow-2xl border border-white/60">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="flex items-center justify-center w-20 h-20 bg-gradient-to-br from-gray-200 to-gray-100 rounded-full mb-5 shadow-lg mx-auto">
              <Sparkles className="w-10 h-10 text-yellow-400" />
            </div>
            <h1 className="text-3xl font-extrabold text-gray-800 mb-2">Create your account</h1>
            <p className="text-gray-500">Join Ticket Hub to get started</p>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Full Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name</label>
              <input
                type="text"
                className={`w-full px-4 py-3 bg-white/60 border ${errors.fullName ? 'border-red-300' : 'border-gray-200'} rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-all`}
                placeholder="Enter your full name"
                {...register('fullName', {
                  required: 'Full name is required',
                  minLength: { value: 2, message: 'Name must be at least 2 characters' }
                })}
              />
              {errors.fullName && (
                <p className="text-red-400 text-xs mt-1">{errors.fullName.message}</p>
              )}
            </div>
            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
              <input
                type="email"
                className={`w-full px-4 py-3 bg-white/60 border ${errors.email ? 'border-red-300' : 'border-gray-200'} rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-all`}
                placeholder="Enter your email"
                {...register('email', {
                  required: 'Email is required',
                  pattern: { value: /\S+@\S+\.\S+/, message: 'Enter a valid email' }
                })}
              />
              {errors.email && (
                <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>
              )}
            </div>
            {/* Base */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Base</label>
              <select
                className={`w-full px-4 py-3 bg-white/60 border ${errors.base ? 'border-red-300' : 'border-gray-200'} rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-all`}
                defaultValue=""
                {...register('base', { required: 'Please select a base' })}
              >
                <option value="" disabled>-- Select your base --</option>
                {(bases || []).map(base => (
                  <option key={base.id} value={base.name}>{base.name}</option>
                ))}
              </select>
              {errors.base && (
                <p className="text-red-400 text-xs mt-1">{errors.base.message}</p>
              )}
            </div>
            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className={`w-full px-4 py-3 pr-12 bg-white/60 border ${errors.password ? 'border-red-300' : 'border-gray-200'} rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-all`}
                  placeholder="Create a password"
                  {...register('password', {
                    required: 'Password is required',
                    minLength: { value: 8, message: 'Password must be at least 8 characters' },
                    pattern: {
                      value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                      message: 'Must contain uppercase, lowercase, and number'
                    }
                  })}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>
              )}
            </div>
            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Confirm Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  className={`w-full px-4 py-3 pr-12 bg-white/60 border ${errors.confirmPassword ? 'border-red-300' : 'border-gray-200'} rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-all`}
                  placeholder="Confirm your password"
                  {...register('confirmPassword', {
                    required: 'Please confirm your password',
                    validate: value => value === password || 'Passwords do not match'
                  })}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-red-400 text-xs mt-1">{errors.confirmPassword.message}</p>
              )}
            </div>
            {/* Error message */}
            {errors.root && (
              <div className="bg-red-100 border border-red-300 rounded-xl p-3 text-center">
                <p className="text-red-500 text-sm">{errors.root.message}</p>
              </div>
            )}
            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gray-800 text-white font-semibold py-3 px-6 rounded-xl hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <UserPlus className="w-5 h-5" />
                  Create Account
                </div>
              )}
            </button>
          </form>
          {/* Footer */}
          <div className="mt-8 text-center">
            <div className="border-t border-gray-200 pt-4">
              <p className="text-gray-600 text-sm">
                Already have an account?{' '}
                <Link
                  to="/login"
                  className="text-gray-900 font-semibold hover:underline transition-all"
                >
                  Sign in
                </Link>
              </p>
            </div>
            <p className="text-gray-400 text-xs mt-3">
              By creating an account, you agree to our Terms & Privacy Policy
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SignupPage