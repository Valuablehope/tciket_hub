import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useAuth } from '../contexts/AuthContext'
import { Eye, EyeOff, LogIn, Zap } from 'lucide-react'
import logo from '../assets/logo.png';

const LoginPage = () => {
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const from = location.state?.from?.pathname || '/dashboard'

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError
  } = useForm()

  const onSubmit = async (data) => {
    try {
      setLoading(true)
      await signIn(data.email, data.password)
      navigate(from, { replace: true })
    } catch (error) {
      setError('root', {
        type: 'manual',
        message: error.message
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white/90 via-white/80 to-gray-100/80 relative overflow-hidden">
      {/* Smokey white background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-white/60 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-gray-200/40 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>
      <div className="relative w-full max-w-md">
        {/* Main card */}
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-10 shadow-2xl border border-white/60">
          {/* Header */}
          <div className="text-center mb-10">
  <div className="text-center mb-10">
  <img
    src={logo}
    alt="Logo"
    className="w-48 h-48 mx-auto mb-2 object-contain"
  />
  <h1 className="text-3xl font-extrabold text-gray-800 mb-2">Welcome Back</h1>
  <p className="text-gray-500">Sign in to continue to Ticket Hub</p>
</div>
</div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
              <input
                type="email"
                className={`w-full px-4 py-3 bg-white/60 border ${
                  errors.email ? 'border-red-300' : 'border-gray-200'
                } rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-all`}
                placeholder="Enter your email"
                {...register('email', {
                  required: 'Email is required',
                  pattern: {
                    value: /\S+@\S+\.\S+/,
                    message: 'Enter a valid email'
                  }
                })}
              />
              {errors.email && (
                <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>
              )}
            </div>
            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className={`w-full px-4 py-3 pr-12 bg-white/60 border ${
                    errors.password ? 'border-red-300' : 'border-gray-200'
                  } rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-all`}
                  placeholder="Enter your password"
                  {...register('password', {
                    required: 'Password is required'
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
                  <LogIn className="w-5 h-5" />
                  Sign In
                </div>
              )}
            </button>
          </form>
          {/* Footer */}
          <div className="mt-8 text-center space-y-4">
            <Link
              to="/forgot-password"
              className="text-gray-600 hover:text-gray-900 text-sm transition-colors"
            >
              Forgot your password?
            </Link>
            <div className="border-t border-gray-200 pt-4">
              <p className="text-gray-600 text-sm">
                Don't have an account?{' '}
                <Link
                  to="/signup"
                  className="text-gray-900 font-semibold hover:underline transition-all"
                >
                  Sign up
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoginPage