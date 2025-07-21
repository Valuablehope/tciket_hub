import React, { useState } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import logo from '../assets/logo.png';
import {
  Home,
  Ticket,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  User
} from 'lucide-react'

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const { user, profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    if (isSigningOut) return; // Prevent multiple clicks
    
    try {
      setIsSigningOut(true)
      
      // Use the enhanced signOut method from AuthContext
      await signOut()
      
      // Navigate to login after successful sign out
      navigate('/login', { replace: true })
    } catch (error) {
      console.error('Error signing out:', error)
      
      // The AuthContext now handles AuthSessionMissingError gracefully,
      // but if we still get an error, redirect anyway
      navigate('/login', { replace: true })
      
      // Optional: Show a toast or notification about the error
      // You can add your notification system here if you have one
    } finally {
      setIsSigningOut(false)
    }
  }

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home, roles: ['Admin', 'HIS', 'User', 'Viewer'] },
    { name: 'Tickets', href: '/tickets', icon: Ticket, roles: ['Admin', 'HIS', 'User'] },
    { name: 'Reports', href: '/reports', icon: BarChart3, roles: ['Admin', 'HIS', 'Viewer'] },
    { name: 'Settings', href: '/settings', icon: Settings, roles: ['Admin', 'HIS', 'User', 'Viewer'] }
  ]

  const filteredNavigation = navigation.filter(item => 
    item.roles.includes(profile?.role)
  )

  const isCurrentPage = (href) => {
    return location.pathname === href || location.pathname.startsWith(href + '/')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 flex z-40 md:hidden ${sidebarOpen ? '' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white">
          <div className="absolute top-0 right-0 -mr-12 pt-2">
            <button
              className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-6 w-6 text-white" />
            </button>
          </div>
          <SidebarContent 
            navigation={filteredNavigation} 
            isCurrentPage={isCurrentPage}
            profile={profile}
            onSignOut={handleSignOut}
            isSigningOut={isSigningOut}
          />
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
        <SidebarContent 
          navigation={filteredNavigation} 
          isCurrentPage={isCurrentPage}
          profile={profile}
          onSignOut={handleSignOut}
          isSigningOut={isSigningOut}
        />
      </div>

      {/* Main content */}
      <div className="md:pl-64 flex flex-col flex-1">
        {/* Top bar */}
        <div className="sticky top-0 z-10 md:hidden pl-1 pt-1 sm:pl-3 sm:pt-3 bg-gray-50">
          <button
            className="-ml-0.5 -mt-0.5 h-12 w-12 inline-flex items-center justify-center rounded-md text-gray-500 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>

        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex-1">
                <h1 className="text-2xl font-semibold text-gray-900">
                  {getPageTitle(location.pathname)}
                </h1>
              </div>
              
              <div className="flex items-center space-x-4">
                {/* Notifications */}
                <button className="p-2 text-gray-400 hover:text-gray-500 relative">
                  <Bell className="h-5 w-5" />
                  {/* Notification badge */}
                  <span className="absolute top-1 right-1 block h-2 w-2 rounded-full bg-red-400"></span>
                </button>

                {/* User menu */}
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <div className="h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center">
                      <User className="h-4 w-4 text-white" />
                    </div>
                    <div className="hidden md:block">
                      <p className="text-sm font-medium text-gray-900">{profile?.full_name}</p>
                      <p className="text-xs text-gray-500">{profile?.role} • {profile?.base}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                    className={`p-2 text-gray-400 hover:text-gray-500 disabled:opacity-50 disabled:cursor-not-allowed ${
                      isSigningOut ? 'animate-pulse' : ''
                    }`}
                    title={isSigningOut ? 'Signing out...' : 'Sign out'}
                  >
                    <LogOut className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

const SidebarContent = ({ navigation, isCurrentPage, profile, onSignOut, isSigningOut }) => {
  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white border-r border-gray-200">
      <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
        <div className="flex items-center flex-shrink-0 px-4">
          <div className="flex flex-col items-center px-6 pt-6 pb-4 bg-white border-b border-gray-200 shadow-sm">
            <div className="bg-white p-2 rounded-md shadow-md">
              <img
                src={logo}
                alt="TicketHub Logo"
                className="h-12 w-auto object-contain"
              />
            </div>
            <span className="mt-3 text-lg font-bold text-gray-800 tracking-wide">
              TicketHub
            </span>
          </div>
        </div>
        <nav className="mt-8 flex-1 px-2 space-y-1">
          {navigation.map((item) => {
            const current = isCurrentPage(item.href)
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                  current
                    ? 'bg-primary-100 text-primary-900'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <item.icon
                  className={`mr-3 flex-shrink-0 h-5 w-5 ${
                    current ? 'text-primary-500' : 'text-gray-400 group-hover:text-gray-500'
                  }`}
                />
                {item.name}
              </Link>
            )
          })}
        </nav>
      </div>
      
      {/* User info at bottom */}
      <div className="flex-shrink-0 border-t border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center">
              <User className="h-4 w-4 text-white" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-900">{profile?.full_name}</p>
              <p className="text-xs text-gray-500">{profile?.role} • {profile?.base}</p>
            </div>
          </div>
          {/* Sign out button for mobile sidebar */}
          <button
            onClick={onSignOut}
            disabled={isSigningOut}
            className={`p-1 text-gray-400 hover:text-gray-500 disabled:opacity-50 disabled:cursor-not-allowed md:hidden ${
              isSigningOut ? 'animate-pulse' : ''
            }`}
            title={isSigningOut ? 'Signing out...' : 'Sign out'}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

const getPageTitle = (pathname) => {
  const routes = {
    '/dashboard': 'Dashboard',
    '/tickets': 'Tickets',
    '/reports': 'Reports',
    '/settings': 'Settings'
  }
  
  for (const [route, title] of Object.entries(routes)) {
    if (pathname === route || pathname.startsWith(route + '/')) {
      return title
    }
  }
  
  return 'Ticketing System'
}

export default Layout