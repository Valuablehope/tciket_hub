import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useForm } from 'react-hook-form'
import { toast } from 'react-hot-toast'
import { db } from '../lib/supabase.js'
import { 
  User, 
  Bell, 
  Shield, 
  Database,
  MessageSquare,
  Save,
  Eye,
  EyeOff,
  Link,
  Unlink,
  Check,
  X
} from 'lucide-react'

const SettingsPage = () => {
  const { profile, updateProfile } = useAuth()
  const [activeTab, setActiveTab] = useState('profile')
  const [userSettings, setUserSettings] = useState(null)
  const [loading, setLoading] = useState(true)

  const tabs = [
    { id: 'profile', name: 'Profile', icon: User },
    { id: 'notifications', name: 'Notifications', icon: Bell },
    { id: 'security', name: 'Security', icon: Shield },
    { id: 'telegram', name: 'Telegram', icon: MessageSquare }
  ]

  // Load user settings on component mount
  useEffect(() => {
    const loadUserSettings = async () => {
      if (!profile?.id) return
      
      try {
        setLoading(true)
        const settings = await db.getUserSettings(profile.id)
        setUserSettings(settings)
      } catch (error) {
        console.error('Error loading user settings:', error)
        toast.error('Failed to load settings')
      } finally {
        setLoading(false)
      }
    }

    loadUserSettings()
  }, [profile?.id])

  // Function to update user settings
  const updateUserSettings = async (updates) => {
    try {
      const updatedSettings = await db.updateUserSettings(profile.id, updates)
      setUserSettings(updatedSettings)
      toast.success('Settings updated successfully!')
      return updatedSettings
    } catch (error) {
      console.error('Error updating settings:', error)
      toast.error('Failed to update settings')
      throw error
    }
  }

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-500">
        Loading settings...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-600">
          Manage your account settings and preferences
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                  activeTab === tab.id
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <tab.icon className="h-5 w-5 mr-3" />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          {activeTab === 'profile' && (
            <ProfileTab profile={profile} updateProfile={updateProfile} />
          )}
          {activeTab === 'notifications' && (
            <NotificationsTab 
              userSettings={userSettings} 
              updateUserSettings={updateUserSettings} 
            />
          )}
          {activeTab === 'security' && (
            <SecurityTab 
              userSettings={userSettings} 
              updateUserSettings={updateUserSettings} 
            />
          )}
          {activeTab === 'telegram' && (
            <TelegramTab 
              profile={profile} 
              userSettings={userSettings} 
              updateUserSettings={updateUserSettings} 
            />
          )}
        </div>
      </div>
    </div>
  )
}

const ProfileTab = ({ profile, updateProfile }) => {
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError
  } = useForm({
    defaultValues: {
      fullName: profile?.full_name || '',
      email: profile?.email || '',
      base: profile?.base || 'South'
    }
  })

  const onSubmit = async (data) => {
    try {
      setLoading(true)
      await updateProfile({
        full_name: data.fullName,
        base: data.base
      })
      toast.success('Profile updated successfully!')
    } catch (error) {
      setError('root', {
        type: 'manual',
        message: error.message
      })
      toast.error('Failed to update profile')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="text-lg font-medium text-gray-900">Profile Information</h3>
        <p className="text-sm text-gray-600">
          Update your personal information and preferences
        </p>
      </div>
      <div className="card-body">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label htmlFor="fullName" className="form-label">
              Full Name
            </label>
            <input
              id="fullName"
              type="text"
              className="form-input"
              {...register('fullName', {
                required: 'Full name is required'
              })}
            />
            {errors.fullName && (
              <p className="form-error">{errors.fullName.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="email" className="form-label">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              className="form-input bg-gray-50"
              disabled
              {...register('email')}
            />
            <p className="text-xs text-gray-500 mt-1">
              Email cannot be changed. Contact administrator if needed.
            </p>
          </div>

          <div>
            <label htmlFor="role" className="form-label">
              Role
            </label>
            <input
              id="role"
              type="text"
              className="form-input bg-gray-50"
              value={profile?.role || ''}
              disabled
            />
            <p className="text-xs text-gray-500 mt-1">
              Role is assigned by administrators
            </p>
          </div>

          <div>
            <label htmlFor="base" className="form-label">
              Base
            </label>
            <select
              id="base"
              className="form-input"
              disabled={profile?.role !== 'Admin'}
              {...register('base')}
            >
              <option value="South">South</option>
              <option value="BML">BML</option>
              <option value="North">North</option>
            </select>
            {profile?.role !== 'Admin' && (
              <p className="text-xs text-gray-500 mt-1">
                Base assignment requires administrator approval
              </p>
            )}
          </div>

          {errors.root && (
            <div className="rounded-md bg-error-50 p-4">
              <p className="text-sm text-error-700">{errors.root.message}</p>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
            >
              {loading ? (
                <div className="loading-spinner h-4 w-4 mr-2"></div>
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const NotificationsTab = ({ userSettings, updateUserSettings }) => {
  const [loading, setLoading] = useState(false)

  const notifications = userSettings?.notifications || {
    email_notifications: true,
    telegram_notifications: true,
    ticket_updates: true,
    assignment_notifications: true,
    weekly_reports: false
  }

  const handleNotificationChange = async (key) => {
    try {
      setLoading(true)
      const newNotifications = {
        ...notifications,
        [key]: !notifications[key]
      }
      await updateUserSettings({
        notifications: newNotifications
      })
    } catch (error) {
      console.error('Error updating notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="text-lg font-medium text-gray-900">Notification Preferences</h3>
        <p className="text-sm text-gray-600">
          Choose how you want to be notified about ticket updates
        </p>
      </div>
      <div className="card-body space-y-6">
        <NotificationToggle
          title="Email Notifications"
          description="Receive notifications via email"
          checked={notifications.email_notifications}
          onChange={() => handleNotificationChange('email_notifications')}
          disabled={loading}
        />
        
        <NotificationToggle
          title="Telegram Notifications"
          description="Receive notifications via Telegram bot"
          checked={notifications.telegram_notifications}
          onChange={() => handleNotificationChange('telegram_notifications')}
          disabled={loading}
        />
        
        <NotificationToggle
          title="Ticket Updates"
          description="Notify when tickets are updated or commented on"
          checked={notifications.ticket_updates}
          onChange={() => handleNotificationChange('ticket_updates')}
          disabled={loading}
        />
        
        <NotificationToggle
          title="Assignment Notifications"
          description="Notify when tickets are assigned to you"
          checked={notifications.assignment_notifications}
          onChange={() => handleNotificationChange('assignment_notifications')}
          disabled={loading}
        />
        
        <NotificationToggle
          title="Weekly Reports"
          description="Receive weekly summary reports"
          checked={notifications.weekly_reports}
          onChange={() => handleNotificationChange('weekly_reports')}
          disabled={loading}
        />
      </div>
    </div>
  )
}

const SecurityTab = ({ userSettings, updateUserSettings }) => {
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    reset,
    setError
  } = useForm()

  const newPassword = watch('newPassword')

  const onSubmit = async (data) => {
    try {
      setLoading(true)
      await db.changePassword(data.currentPassword, data.newPassword)
      
      // Update security settings
      await updateUserSettings({
        security: {
          ...userSettings?.security,
          password_last_changed: new Date().toISOString(),
          password_change_required: false
        }
      })
      
      toast.success('Password changed successfully!')
      reset()
    } catch (error) {
      setError('root', {
        type: 'manual',
        message: error.message || 'Failed to change password. Please try again.'
      })
      toast.error('Failed to change password')
    } finally {
      setLoading(false)
    }
  }

  const lastPasswordChange = userSettings?.security?.password_last_changed
  const passwordChangeRequired = userSettings?.security?.password_change_required

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-gray-900">Change Password</h3>
          <p className="text-sm text-gray-600">
            Update your password to keep your account secure
          </p>
        </div>
        <div className="card-body">
          {passwordChangeRequired && (
            <div className="rounded-md bg-yellow-50 p-4 mb-6">
              <p className="text-sm text-yellow-800">
                Password change required. Please update your password.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label htmlFor="currentPassword" className="form-label">
                Current Password
              </label>
              <div className="relative">
                <input
                  id="currentPassword"
                  type={showCurrentPassword ? 'text' : 'password'}
                  className="form-input pr-10"
                  {...register('currentPassword', {
                    required: 'Current password is required'
                  })}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  {showCurrentPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
              {errors.currentPassword && (
                <p className="form-error">{errors.currentPassword.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="newPassword" className="form-label">
                New Password
              </label>
              <div className="relative">
                <input
                  id="newPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  className="form-input pr-10"
                  {...register('newPassword', {
                    required: 'New password is required',
                    minLength: {
                      value: 8,
                      message: 'Password must be at least 8 characters'
                    },
                    pattern: {
                      value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                      message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
                    }
                  })}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
              {errors.newPassword && (
                <p className="form-error">{errors.newPassword.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="form-label">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="form-input pr-10"
                  {...register('confirmPassword', {
                    required: 'Please confirm your password',
                    validate: value =>
                      value === newPassword || 'Passwords do not match'
                  })}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="form-error">{errors.confirmPassword.message}</p>
              )}
            </div>

            {errors.root && (
              <div className="rounded-md bg-error-50 p-4">
                <p className="text-sm text-error-700">{errors.root.message}</p>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="btn-primary"
              >
                {loading ? (
                  <div className="loading-spinner h-4 w-4 mr-2"></div>
                ) : (
                  <Shield className="h-4 w-4 mr-2" />
                )}
                Change Password
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Security Information */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-gray-900">Security Information</h3>
        </div>
        <div className="card-body">
          <div className="space-y-4">
            {lastPasswordChange && (
              <div className="flex items-start space-x-3">
                <Shield className="h-5 w-5 text-blue-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Last Password Change</p>
                  <p className="text-sm text-gray-600">
                    {new Date(lastPasswordChange).toLocaleDateString()}
                  </p>
                </div>
              </div>
            )}
            
            <div className="flex items-start space-x-3">
              <Shield className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900">Password Requirements</p>
                <p className="text-sm text-gray-600">
                  Passwords must be at least 8 characters long and contain uppercase, lowercase, and numeric characters.
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <Shield className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900">Account Security</p>
                <p className="text-sm text-gray-600">
                  Your account is protected by secure authentication. Change your password regularly for better security.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const TelegramTab = ({ profile, userSettings, updateUserSettings }) => {
  const [loading, setLoading] = useState(false)

  const telegramSettings = userSettings?.telegram || {
    username: '',
    chat_id: null,
    is_connected: false,
    connected_at: null
  }

  const [telegramUsername, setTelegramUsername] = useState(telegramSettings.username || '')

  const handleConnectTelegram = async () => {
    if (!telegramUsername.trim()) {
      toast.error('Please enter your Telegram username')
      return
    }

    try {
      setLoading(true)
      
      // Validate username format
      const cleanUsername = telegramUsername.startsWith('@') 
        ? telegramUsername 
        : `@${telegramUsername}`

      // Connect to Telegram (implement your Telegram bot logic here)
      const telegramData = await db.connectTelegram(profile.id, cleanUsername)
      
      await updateUserSettings({
        telegram: {
          username: cleanUsername,
          chat_id: telegramData.chat_id,
          is_connected: true,
          connected_at: new Date().toISOString()
        }
      })

      toast.success('Successfully connected to Telegram!')
    } catch (error) {
      console.error('Error connecting to Telegram:', error)
      toast.error('Failed to connect to Telegram. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleDisconnectTelegram = async () => {
    try {
      setLoading(true)
      
      await db.disconnectTelegram(profile.id)
      
      await updateUserSettings({
        telegram: {
          username: '',
          chat_id: null,
          is_connected: false,
          connected_at: null
        }
      })

      setTelegramUsername('')
      toast.success('Successfully disconnected from Telegram!')
    } catch (error) {
      console.error('Error disconnecting from Telegram:', error)
      toast.error('Failed to disconnect from Telegram. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-gray-900">Telegram Integration</h3>
          <p className="text-sm text-gray-600">
            Connect your Telegram account to receive notifications
          </p>
        </div>
        <div className="card-body">
          {!telegramSettings.is_connected ? (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <MessageSquare className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-blue-900">How to connect</h4>
                    <ol className="text-sm text-blue-800 mt-2 space-y-1 list-decimal list-inside">
                      <li>Open Telegram and search for @his_ticket_alert_bot</li>
                      <li>Start a chat with the bot</li>
                      <li>Send the command /start</li>
                      <li>Enter your Telegram username below</li>
                    </ol>
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="telegramUsername" className="form-label">
                  Telegram Username
                </label>
                <input
                  id="telegramUsername"
                  type="text"
                  className="form-input"
                  placeholder="@username"
                  value={telegramUsername}
                  onChange={(e) => setTelegramUsername(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter your Telegram username (including @)
                </p>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleConnectTelegram}
                  disabled={loading}
                  className="btn-primary"
                >
                  {loading ? (
                    <div className="loading-spinner h-4 w-4 mr-2"></div>
                  ) : (
                    <Link className="h-4 w-4 mr-2" />
                  )}
                  Connect Telegram
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <Check className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-green-900">Connected</h4>
                    <p className="text-sm text-green-800">
                      Your Telegram account {telegramSettings.username} is connected and ready to receive notifications.
                    </p>
                  </div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Connection Details</h4>
                <dl className="space-y-2">
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-600">Username:</dt>
                    <dd className="text-sm font-medium text-gray-900">{telegramSettings.username}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-600">Status:</dt>
                    <dd className="text-sm font-medium text-green-600">Connected</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-gray-600">Connected:</dt>
                    <dd className="text-sm font-medium text-gray-900">
                      {telegramSettings.connected_at 
                        ? new Date(telegramSettings.connected_at).toLocaleDateString()
                        : 'Unknown'
                      }
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleDisconnectTelegram}
                  disabled={loading}
                  className="btn-secondary"
                >
                  {loading ? (
                    <div className="loading-spinner h-4 w-4 mr-2"></div>
                  ) : (
                    <Unlink className="h-4 w-4 mr-2" />
                  )}
                  Disconnect
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const NotificationToggle = ({ title, description, checked, onChange, disabled }) => {
  return (
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <h4 className="text-sm font-medium text-gray-900">{title}</h4>
        <p className="text-sm text-gray-600">{description}</p>
      </div>
      <div className="ml-4">
        <button
          type="button"
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
            checked ? 'bg-primary-600' : 'bg-gray-200'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          onClick={onChange}
          disabled={disabled}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              checked ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
    </div>
  )
}

export default SettingsPage