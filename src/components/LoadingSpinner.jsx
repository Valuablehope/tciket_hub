import React from 'react'

const LoadingSpinner = ({ size = 'md', message = 'Loading...' }) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
    xl: 'h-12 w-12'
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className={`loading-spinner mx-auto ${sizeClasses[size]}`}></div>
        <p className="mt-2 text-sm text-gray-600">{message}</p>
      </div>
    </div>
  )
}

export default LoadingSpinner