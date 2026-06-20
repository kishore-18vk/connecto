import React, { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { clearCredentials } from '../../redux/authSlice'
import api from '../../services/api'
import wsService from '../../services/websocket'
import { 
  Shield, ShieldAlert, LogOut, RefreshCw, Smartphone, Key, 
  Palette, Eye, Bell, Volume2, Moon, Sun, Monitor 
} from 'lucide-react'

function SettingsPanel() {
  const currentUser = useSelector((state) => state.auth.user)
  const [profile, setProfile] = useState(null)
  const [blockedUsers, setBlockedUsers] = useState([])
  const [loadingBlocked, setLoadingBlocked] = useState(false)
  
  // Local setting states
  const [soundAlerts, setSoundAlerts] = useState(true)
  const [desktopAlerts, setDesktopAlerts] = useState(true)
  const [activeTheme, setActiveTheme] = useState('space')

  const dispatch = useDispatch()

  const fetchProfileAndSettings = async () => {
    try {
      const res = await api.get('accounts/me/')
      setProfile(res.data)
    } catch (err) {
      console.error("Failed to load user profile:", err)
    }
  }

  const fetchBlockedUsers = async () => {
    setLoadingBlocked(true)
    try {
      const res = await api.get('accounts/blocked/')
      setBlockedUsers(res.data)
    } catch (err) {
      console.error("Failed to load blocked users list", err)
    } finally {
      setLoadingBlocked(false)
    }
  }

  useEffect(() => {
    fetchProfileAndSettings()
    fetchBlockedUsers()
    
    // Load local storage preferences
    const storedTheme = localStorage.getItem('connecto-theme') || 'space'
    setActiveTheme(storedTheme)
    const storedSound = localStorage.getItem('connecto-sound') !== 'false'
    setSoundAlerts(storedSound)
    const storedDesktop = localStorage.getItem('connecto-desktop') !== 'false'
    setDesktopAlerts(storedDesktop)
  }, [])

  const handleUpdatePrivacy = async (key, val) => {
    try {
      const updatedData = {}
      updatedData[key] = val
      const res = await api.put('accounts/profile/', updatedData)
      setProfile(res.data)
      alert("Privacy preference updated successfully!")
    } catch (err) {
      console.error("Failed to update privacy preference:", err)
    }
  }

  const handleUnblockUser = async (userId) => {
    try {
      await api.post('accounts/unblock/', { user_id: userId })
      fetchBlockedUsers()
    } catch (err) {
      console.error(err)
    }
  }

  const handleLogoutAll = async () => {
    if (window.confirm("Are you sure you want to terminate all sessions? You will be logged out of this device as well.")) {
      try {
        await api.post('auth/logout/all/')
      } catch (e) {
        console.error(e)
      }
      wsService.disconnect()
      dispatch(clearCredentials())
    }
  }

  const changeTheme = (themeName) => {
    setActiveTheme(themeName)
    localStorage.setItem('connecto-theme', themeName)
    // Apply theme changes to document
    document.documentElement.className = `theme-${themeName}`
  }

  const toggleSound = () => {
    setSoundAlerts(!soundAlerts)
    localStorage.setItem('connecto-sound', (!soundAlerts).toString())
  }

  const toggleDesktop = () => {
    setDesktopAlerts(!desktopAlerts)
    localStorage.setItem('connecto-desktop', (!desktopAlerts).toString())
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#0b1329]/20">
      
      {/* Header */}
      <div className="p-5 bg-slate-900/60 border-b border-white/5 backdrop-blur-md shrink-0">
        <h2 className="text-lg font-bold text-white font-display">Settings</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        
        {/* Theme Settings */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-brand-secondary uppercase tracking-wider">Appearance & Themes</h3>
          <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-4 space-y-3 glass-card">
            <div className="flex items-center gap-2 mb-1">
              <Palette size={16} className="text-brand-secondary" />
              <span className="text-xs font-semibold text-white">Select Application Theme</span>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { id: 'space', name: 'Deep Space Glassmorphism', color: 'from-[#0b1329] to-[#1e1b4b]' },
                { id: 'dark', name: 'Connecto Dark Mode', color: 'from-[#0f172a] to-[#1e293b]' },
                { id: 'neon', name: 'Cyberpunk Neon Pink', color: 'from-[#1a0b2e] to-[#2d004d]' },
                { id: 'matrix', name: 'Matrix Terminal Green', color: 'from-[#022c22] to-[#042f1a]' }
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => changeTheme(t.id)}
                  className={`p-3 rounded-xl border text-left flex flex-col justify-between h-20 transition-all ${
                    activeTheme === t.id 
                      ? 'border-brand-primary bg-white/5 ring-1 ring-brand-primary' 
                      : 'border-white/5 hover:border-white/10 hover:bg-white/5 bg-transparent'
                  }`}
                >
                  <span className="font-semibold text-white leading-tight">{t.name}</span>
                  <div className={`h-2.5 w-12 rounded-full bg-gradient-to-r ${t.color}`}></div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Privacy Settings */}
        {profile && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-brand-secondary uppercase tracking-wider">Privacy Preferences</h3>
            <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-4 space-y-3.5 glass-card text-xs">
              
              <div className="flex justify-between items-center py-0.5">
                <div>
                  <span className="block text-white font-semibold">Last Seen visibility</span>
                  <span className="text-[10px] text-gray-400">Who can see when you were online</span>
                </div>
                <select
                  value={profile.profile?.privacy_last_seen || 'EVERYONE'}
                  onChange={(e) => handleUpdatePrivacy('privacy_last_seen', e.target.value)}
                  className="bg-[#0f172a] border border-white/5 rounded-xl px-2.5 py-1.5 text-white outline-none cursor-pointer"
                >
                  <option value="EVERYONE">Everyone</option>
                  <option value="FRIENDS">Contacts</option>
                  <option value="PRIVATE">Nobody</option>
                </select>
              </div>

              <div className="flex justify-between items-center py-0.5 border-t border-white/5 pt-3.5">
                <div>
                  <span className="block text-white font-semibold">Profile Photo visibility</span>
                  <span className="text-[10px] text-gray-400">Who can see your avatar image</span>
                </div>
                <select
                  value={profile.profile?.privacy_profile_picture || 'EVERYONE'}
                  onChange={(e) => handleUpdatePrivacy('privacy_profile_picture', e.target.value)}
                  className="bg-[#0f172a] border border-white/5 rounded-xl px-2.5 py-1.5 text-white outline-none cursor-pointer"
                >
                  <option value="EVERYONE">Everyone</option>
                  <option value="FRIENDS">Contacts</option>
                  <option value="PRIVATE">Nobody</option>
                </select>
              </div>

              <div className="flex justify-between items-center py-0.5 border-t border-white/5 pt-3.5">
                <div>
                  <span className="block text-white font-semibold">Status visibility</span>
                  <span className="text-[10px] text-gray-400">Who can view your status stories</span>
                </div>
                <select
                  value={profile.profile?.privacy_status || 'EVERYONE'}
                  onChange={(e) => handleUpdatePrivacy('privacy_status', e.target.value)}
                  className="bg-[#0f172a] border border-white/5 rounded-xl px-2.5 py-1.5 text-white outline-none cursor-pointer"
                >
                  <option value="EVERYONE">Everyone</option>
                  <option value="FRIENDS">Contacts</option>
                  <option value="PRIVATE">Nobody</option>
                </select>
              </div>

              <div className="flex justify-between items-center py-0.5 border-t border-white/5 pt-3.5">
                <div>
                  <span className="block text-white font-semibold">Email address visibility</span>
                  <span className="text-[10px] text-gray-400">Who can search you by email</span>
                </div>
                <select
                  value={profile.profile?.privacy_email || 'EVERYONE'}
                  onChange={(e) => handleUpdatePrivacy('privacy_email', e.target.value)}
                  className="bg-[#0f172a] border border-white/5 rounded-xl px-2.5 py-1.5 text-white outline-none cursor-pointer"
                >
                  <option value="EVERYONE">Everyone</option>
                  <option value="FRIENDS">Contacts</option>
                  <option value="PRIVATE">Nobody</option>
                </select>
              </div>

            </div>
          </div>
        )}

        {/* Notification Settings */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-brand-secondary uppercase tracking-wider">Alerts & Notifications</h3>
          <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-4 space-y-3.5 glass-card text-xs">
            
            <div className="flex justify-between items-center py-0.5">
              <div className="flex items-center gap-2">
                <Volume2 size={15} className="text-gray-400" />
                <div>
                  <span className="block text-white font-semibold">Audio Notifications</span>
                  <span className="text-[10px] text-gray-400">Play standard alerts for messages</span>
                </div>
              </div>
              <input 
                type="checkbox" 
                checked={soundAlerts}
                onChange={toggleSound}
                className="w-4 h-4 accent-brand-primary rounded cursor-pointer"
              />
            </div>

            <div className="flex justify-between items-center py-0.5 border-t border-white/5 pt-3.5">
              <div className="flex items-center gap-2">
                <Bell size={15} className="text-gray-400" />
                <div>
                  <span className="block text-white font-semibold">Desktop Alert popups</span>
                  <span className="text-[10px] text-gray-400">Show notification toasts on receiver</span>
                </div>
              </div>
              <input 
                type="checkbox" 
                checked={desktopAlerts}
                onChange={toggleDesktop}
                className="w-4 h-4 accent-brand-primary rounded cursor-pointer"
              />
            </div>

          </div>
        </div>

        {/* Session Management */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-brand-secondary uppercase tracking-wider">Session Management</h3>
          <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-4 divide-y divide-white/5 glass-card text-xs">
            <div className="flex justify-between items-center pb-3">
              <div className="flex items-center gap-2.5">
                <Smartphone size={16} className="text-gray-400" />
                <div>
                  <span className="block text-white font-semibold">Current JWT Session</span>
                  <span className="text-[10px] text-gray-400">Active logged-in token</span>
                </div>
              </div>
            </div>
            
            <div className="flex justify-between items-center pt-3">
              <div className="flex items-center gap-2.5">
                <Key size={16} className="text-gray-400" />
                <div>
                  <span className="block text-white font-semibold">Log out all other devices</span>
                  <span className="text-[10px] text-gray-400">Invalidates other device sessions</span>
                </div>
              </div>
              <button 
                onClick={handleLogoutAll}
                className="px-3 py-1.5 bg-rose-950/20 text-rose-400 border border-rose-900/50 hover:bg-rose-900/30 font-bold rounded-lg transition-colors cursor-pointer text-[10px]"
              >
                Terminate Sessions
              </button>
            </div>
          </div>
        </div>

        {/* Blocking Controls */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-brand-secondary uppercase tracking-wider">Blocking Controls</h3>
          <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-4 glass-card text-xs">
            <div className="flex items-center gap-2 mb-3">
              <Shield size={16} className="text-brand-secondary" />
              <span className="font-semibold text-white">Blocked Users</span>
            </div>

            {loadingBlocked ? (
              <p className="text-xs text-gray-500 italic">Loading list...</p>
            ) : blockedUsers.length === 0 ? (
              <p className="text-xs text-gray-500 italic">No users are currently blocked.</p>
            ) : (
              <div className="divide-y divide-white/5 max-h-48 overflow-y-auto">
                {blockedUsers.map((b) => {
                  const details = b.blocked_user_details
                  return (
                    <div key={b.id} className="flex justify-between items-center py-2">
                      <div className="min-w-0">
                        <span className="block text-xs font-bold text-white truncate font-display">
                          {details.first_name || details.username} {details.last_name || ''}
                        </span>
                        <span className="block text-[10px] text-gray-400 truncate">{details.email}</span>
                      </div>
                      <button 
                        onClick={() => handleUnblockUser(details.id)}
                        className="px-2.5 py-1.5 bg-[#0f172a] border border-white/5 hover:border-brand-secondary/40 text-brand-secondary hover:text-white rounded-lg transition-all cursor-pointer text-[10px]"
                      >
                        Unblock
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}

export default SettingsPanel
