import React, { useState, useEffect, useRef } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { clearCredentials } from '../redux/authSlice'
import { setActiveChatId, setChats, addChat } from '../redux/chatSlice'
import api from '../services/api'

// Import icons
import { 
  MessageSquare, Users, Bell, Settings, LogOut, Shield, User, 
  Compass, HelpCircle, Phone, CircleDot, Bookmark, Search, Plus, Sparkles, Send, Globe
} from 'lucide-react'

// Import components
import ChatList from '../components/chat/ChatList'
import ChatWindow from '../components/chat/ChatWindow'
import ContactsPanel from '../components/contacts/ContactsPanel'
import SettingsPanel from '../components/settings/SettingsPanel'
import ProfilePanel from '../components/profile/ProfilePanel'
import CallOverlay from '../components/calls/CallOverlay'
import CallHistoryList from '../components/calls/CallHistoryList'
import StatusTray from '../components/status/StatusTray'
import wsService from '../services/websocket'

// Particle Network component for the empty state
function ParticleCanvas() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let animationFrameId
    
    let width = canvas.width = canvas.offsetWidth
    let height = canvas.height = canvas.offsetHeight

    const handleResize = () => {
      if (canvas) {
        width = canvas.width = canvas.offsetWidth
        height = canvas.height = canvas.offsetHeight
      }
    }
    window.addEventListener('resize', handleResize)

    // Generate particles
    const particleCount = 45
    const particles = []
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 2 + 1,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        color: i % 2 === 0 ? 'rgba(124, 58, 237, 0.25)' : 'rgba(6, 182, 212, 0.25)'
      })
    }

    const draw = () => {
      ctx.clearRect(0, 0, width, height)
      
      particles.forEach((p, idx) => {
        p.x += p.vx
        p.y += p.vy

        if (p.x < 0 || p.x > width) p.vx *= -1
        if (p.y < 0 || p.y > height) p.vy *= -1

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.fill()

        // Draw connections
        for (let j = idx + 1; j < particles.length; j++) {
          const p2 = particles[j]
          const dist = Math.hypot(p.x - p2.x, p.y - p2.y)
          if (dist < 100) {
            ctx.beginPath()
            ctx.moveTo(p.x, p.y)
            ctx.lineTo(p2.x, p2.y)
            ctx.strokeStyle = `rgba(124, 58, 237, ${0.12 * (1 - dist / 100)})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      })

      animationFrameId = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-0" />
}

// Inline GroupsPanel
function GroupsPanel({ onStartChat }) {
  const chats = useSelector((state) => state.chat.chats)
  const activeChatId = useSelector((state) => state.chat.activeChatId)
  const dispatch = useDispatch()
  const groupChats = chats.filter(c => c.type === 'GROUP')

  return (
    <div className="flex flex-col h-full w-full">
      <div className="p-5 flex justify-between items-center border-b border-white/5">
        <h2 className="text-xl font-bold text-white font-display">Groups</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {groupChats.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            No group chats found. Create one in the Chats panel!
          </div>
        ) : (
          groupChats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => { dispatch(setActiveChatId(chat.id)); if (onStartChat) onStartChat(); }}
              className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${activeChatId === chat.id ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-gray-300'}`}
            >
              <div className="w-10 h-10 rounded-full bg-brand-primary/20 flex items-center justify-center text-brand-primary font-bold">
                {chat.group_details?.name?.substring(0, 2).toUpperCase() || "GR"}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold truncate">{chat.group_details?.name || "Group"}</h4>
                <p className="text-xs text-gray-400 truncate">{chat.last_message?.content || "No messages yet"}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// Inline NotificationsPanel
function NotificationsPanel() {
  const [notifications, setNotifications] = useState([
    { id: 1, title: "Welcome to Connecto!", description: "Experience premium, secure and fast communication.", time: "Just now" },
    { id: 2, title: "New Feature Added", description: "You can now restrict logins to a single active session.", time: "1 hour ago" },
    { id: 3, title: "System Online", description: "Connected successfully to real-time sync networks.", time: "2 hours ago" },
  ])

  return (
    <div className="flex flex-col h-full w-full">
      <div className="p-5 border-b border-white/5">
        <h2 className="text-xl font-bold text-white font-display">Notifications</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {notifications.map(n => (
          <div key={n.id} className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-1 hover:border-brand-primary/20 transition-all">
            <div className="flex justify-between items-baseline">
              <h4 className="text-sm font-semibold text-white">{n.title}</h4>
              <span className="text-[10px] text-gray-400">{n.time}</span>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">{n.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// Inline CommunitiesPanel
function CommunitiesPanel() {
  const [search, setSearch] = useState('')
  const communities = [
    { id: 1, name: "Connecto Lounge", description: "The official lounge for general chit-chat and announcements.", members: 12450, category: "Official", image: "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=150&auto=format&fit=crop&q=60" },
    { id: 2, name: "Tech & Coding", description: "React, Django, Python, JS, AI discussion and help desk.", members: 8940, category: "Education", image: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=150&auto=format&fit=crop&q=60" },
    { id: 3, name: "Gamers Hub", description: "Find teammates for CS2, Valorant, Minecraft, League and more.", members: 24320, category: "Gaming", image: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=150&auto=format&fit=crop&q=60" },
    { id: 4, name: "Music & Artists", description: "Share your playlist, discover new music, jam sessions.", members: 5410, category: "Art", image: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=150&auto=format&fit=crop&q=60" }
  ]

  const filtered = communities.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.description.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="flex flex-col h-full w-full">
      <div className="p-5 border-b border-white/5">
        <h2 className="text-xl font-bold text-white font-display">Communities</h2>
      </div>
      <div className="px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2.5 bg-white/5 rounded-xl px-3.5 py-2 border border-white/5 focus-within:border-brand-secondary/40 transition-all">
          <Search size={16} className="text-gray-400" />
          <input 
            type="text" 
            placeholder="Search communities..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm w-full outline-none text-white placeholder-gray-400"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {filtered.map(c => (
          <div key={c.id} className="p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all flex gap-3 items-center group">
            <img src={c.image} alt={c.name} className="w-12 h-12 rounded-xl object-cover border border-white/10" />
            <div className="flex-1 min-w-0">
              <span className="text-[10px] uppercase font-bold text-brand-secondary tracking-wider">{c.category}</span>
              <h4 className="text-sm font-semibold text-white truncate group-hover:text-brand-secondary transition-all">{c.name}</h4>
              <p className="text-xs text-gray-400 truncate mt-0.5">{c.description}</p>
              <span className="text-[10px] text-gray-500 mt-1 block">👥 {c.members.toLocaleString()} members</span>
            </div>
            <button className="px-3 py-1.5 bg-brand-primary/20 hover:bg-brand-primary text-white text-xs font-semibold rounded-lg border border-brand-primary/30 transition-all">
              Join
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function Dashboard() {
  const [activeTab, setActiveTab] = useState('CHATS')
  const currentUser = useSelector((state) => state.auth.user)
  const activeChatId = useSelector((state) => state.chat.activeChatId)
  const callState = useSelector((state) => state.call.callState)
  const chats = useSelector((state) => state.chat.chats)
  const dispatch = useDispatch()

  const totalUnreadChats = chats.reduce((acc, c) => acc + (c.unread_count || 0), 0)

  const handleOpenSavedMessages = async () => {
    if (!currentUser) return
    try {
      const res = await api.post('chats/', {
        type: 'DM',
        participants: [currentUser.id]
      })
      dispatch(addChat(res.data))
      dispatch(setActiveChatId(res.data.id))
      setActiveTab('CHATS')
    } catch (err) {
      console.error("Failed to open saved messages:", err)
    }
  }

  useEffect(() => {
    // Fetch initial chat list
    const fetchChats = async () => {
      try {
        const res = await api.get('chats/')
        dispatch(setChats(res.data))
      } catch (err) {
        console.error("Failed to load chats:", err)
      }
    }
    fetchChats()

    // Retrieve active theme setting and apply to document root
    const storedTheme = localStorage.getItem('connecto-theme') || 'space'
    document.documentElement.className = `theme-${storedTheme}`
  }, [dispatch])

  const handleLogout = async () => {
    try {
      const refresh = localStorage.getItem('refreshToken')
      await api.post('auth/logout/', { refresh })
    } catch (e) {
      // Ignore blacklist token error on logout
    }
    wsService.disconnect()
    dispatch(clearCredentials())
    dispatch(setActiveChatId(null))
  }

  return (
    <div className="flex h-screen w-screen bg-[#0F172A] overflow-hidden select-none relative font-sans text-white">
      
      {/* Background Animated Gradient Blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-gradient-to-br from-brand-primary/15 to-brand-accent/15 blur-[120px] animate-float-slow animate-pulse-glow"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[45vw] h-[45vw] rounded-full bg-gradient-to-tr from-brand-secondary/15 to-brand-primary/10 blur-[100px] animate-float-medium"></div>
        <div className="absolute top-[30%] right-[20%] w-[30vw] h-[30vw] rounded-full bg-gradient-to-r from-brand-accent/5 to-brand-secondary/10 blur-[90px] animate-float-fast"></div>
      </div>

      {/* 1. Left Narrow Navigation Sidebar */}
      <div className="w-[68px] glass-sidebar flex flex-col justify-between items-center py-5 shrink-0 z-20">
        <div className="flex flex-col items-center gap-6 w-full">
          {/* Logo of Connecto */}
          <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-gradient-to-tr from-brand-primary to-brand-accent shadow-lg shadow-brand-primary/20 hover:scale-105 transition-all">
            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3z" />
            </svg>
          </div>

          <div className="w-8 h-[1px] bg-white/10"></div>

          {/* Navigation Buttons */}
          <button 
            onClick={() => { setActiveTab('CHATS'); dispatch(setActiveChatId(null)); }}
            className={`p-2.5 rounded-xl transition-all cursor-pointer relative ${activeTab === 'CHATS' ? 'bg-brand-primary/20 text-brand-primary border border-brand-primary/30' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
            title="Chats"
          >
            <MessageSquare size={20} />
            {totalUnreadChats > 0 && (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[9px] font-extrabold bg-brand-accent text-white rounded-full leading-none ring-2 ring-[#0F172A]">
                {totalUnreadChats}
              </span>
            )}
          </button>

          <button 
            onClick={() => setActiveTab('CONTACTS')}
            className={`p-2.5 rounded-xl transition-all cursor-pointer ${activeTab === 'CONTACTS' ? 'bg-brand-primary/20 text-brand-primary border border-brand-primary/30' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
            title="Contacts"
          >
            <User size={20} />
          </button>

          <button 
            onClick={() => setActiveTab('GROUPS')}
            className={`p-2.5 rounded-xl transition-all cursor-pointer ${activeTab === 'GROUPS' ? 'bg-brand-primary/20 text-brand-primary border border-brand-primary/30' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
            title="Groups"
          >
            <Users size={20} />
          </button>

          <button 
            onClick={() => setActiveTab('COMMUNITIES')}
            className={`p-2.5 rounded-xl transition-all cursor-pointer ${activeTab === 'COMMUNITIES' ? 'bg-brand-primary/20 text-brand-primary border border-brand-primary/30' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
            title="Communities"
          >
            <Compass size={20} />
          </button>

          <button 
            onClick={() => setActiveTab('CALLS')}
            className={`p-2.5 rounded-xl transition-all cursor-pointer ${activeTab === 'CALLS' ? 'bg-brand-primary/20 text-brand-primary border border-brand-primary/30' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
            title="Calls"
          >
            <Phone size={20} />
          </button>

          <button 
            onClick={() => setActiveTab('STATUS')}
            className={`p-2.5 rounded-xl transition-all cursor-pointer relative ${activeTab === 'STATUS' ? 'bg-brand-primary/20 text-brand-primary border border-brand-primary/30' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
            title="Status updates"
          >
            <CircleDot size={20} />
            <span className="absolute top-1 right-1 w-2 h-2 bg-brand-secondary rounded-full ring-1 ring-[#0F172A]"></span>
          </button>

          <button 
            onClick={handleOpenSavedMessages}
            className="p-2.5 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white transition-all cursor-pointer"
            title="Saved Messages"
          >
            <Bookmark size={20} />
          </button>

          <button 
            onClick={() => setActiveTab('NOTIFICATIONS')}
            className={`p-2.5 rounded-xl transition-all cursor-pointer relative ${activeTab === 'NOTIFICATIONS' ? 'bg-brand-primary/20 text-brand-primary border border-brand-primary/30' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
            title="Notifications"
          >
            <Bell size={20} />
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-brand-accent rounded-full ring-2 ring-[#0F172A]"></span>
          </button>
        </div>

        <div className="flex flex-col items-center gap-5 w-full">
          <button 
            onClick={() => setActiveTab('SETTINGS')}
            className={`p-2.5 rounded-xl transition-all cursor-pointer ${activeTab === 'SETTINGS' ? 'bg-brand-primary/20 text-brand-primary border border-brand-primary/30' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
            title="Settings"
          >
            <Settings size={20} />
          </button>

          {/* User profile avatar at bottom */}
          <button 
            onClick={() => setActiveTab('PROFILE')}
            className={`w-9 h-9 rounded-full overflow-hidden border-2 cursor-pointer transition-all ${activeTab === 'PROFILE' ? 'border-brand-primary' : 'border-transparent hover:border-white/45'}`}
            title="My Profile"
          >
            {currentUser?.avatar_url || currentUser?.profile?.profile_picture ? (
              <img 
                src={currentUser?.profile?.profile_picture || currentUser?.avatar_url} 
                alt="Profile" 
                className="w-full h-full object-cover" 
              />
            ) : (
              <div className="w-full h-full bg-white/10 flex items-center justify-center text-white">
                <User size={16} />
              </div>
            )}
          </button>

          <button 
            onClick={handleLogout}
            className="p-2.5 rounded-xl text-rose-400 hover:bg-rose-950/20 hover:text-rose-300 transition-all cursor-pointer"
            title="Log Out"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>

      {/* 2. Left Details List Panel */}
      <div className="w-[340px] glass-chatlist border-r border-white/5 flex flex-col shrink-0 h-full z-10">
        {activeTab === 'CHATS' && <ChatList onStartChat={() => setActiveTab('CHATS')} />}
        {activeTab === 'CONTACTS' && <ContactsPanel onStartChat={() => setActiveTab('CHATS')} />}
        {activeTab === 'GROUPS' && <GroupsPanel onStartChat={() => setActiveTab('CHATS')} />}
        {activeTab === 'COMMUNITIES' && <CommunitiesPanel />}
        {activeTab === 'CALLS' && <CallHistoryList />}
        {activeTab === 'STATUS' && <StatusTray />}
        {activeTab === 'NOTIFICATIONS' && <NotificationsPanel />}
        {activeTab === 'SETTINGS' && <SettingsPanel />}
        {activeTab === 'PROFILE' && <ProfilePanel />}
      </div>

      {/* 3. Conversation / Main Display area */}
      <div className="flex-1 flex flex-col h-full relative z-10">
        {activeChatId ? (
          <ChatWindow />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none relative overflow-hidden">
            
            {/* Interactive floating particle network */}
            <ParticleCanvas />

            {/* Animated Floating Elements in the background of the empty state */}
            <div className="absolute top-[10%] left-[10%] glass-card px-4 py-2 rounded-2xl flex items-center gap-2 animate-float-slow text-xs select-none border border-white/5">
              <span className="w-2.5 h-2.5 rounded-full bg-brand-success animate-ping"></span>
              <span className="text-gray-300">Team Online</span>
            </div>
            <div className="absolute bottom-[15%] right-[10%] glass-card px-4 py-2 rounded-2xl flex items-center gap-2 animate-float-medium text-xs select-none border border-white/5">
              <span className="text-gray-300">⚡ End-to-end Encrypted</span>
            </div>
            <div className="absolute top-[25%] right-[15%] text-4xl animate-float-fast opacity-80">💬</div>
            <div className="absolute bottom-[20%] left-[15%] text-4xl animate-float-slow opacity-80">✈️</div>

            <div className="max-w-xl flex flex-col items-center relative z-10">
              
              {/* 3D messaging illustration */}
              <div className="w-64 h-64 mb-8 relative select-none">
                <svg className="w-full h-full filter drop-shadow-[0_15px_30px_rgba(124,58,237,0.35)]" viewBox="0 0 200 200" fill="none">
                  {/* Glowing core */}
                  <circle cx="100" cy="100" r="50" fill="url(#coreGrad)" className="animate-pulse-glow" />
                  
                  {/* Floating Bubbles */}
                  <g className="animate-float-slow">
                    <rect x="40" y="40" width="70" height="45" rx="15" fill="url(#bubbleGradPurple)" className="opacity-90" />
                    <circle cx="58" cy="62" r="8" fill="white" className="opacity-20" />
                    <line x1="75" y1="58" x2="95" y2="58" stroke="white" strokeWidth="3" strokeLinecap="round" className="opacity-40" />
                    <line x1="75" y1="68" x2="88" y2="68" stroke="white" strokeWidth="3" strokeLinecap="round" className="opacity-40" />
                    <path d="M50 85 L40 95 L55 90 Z" fill="#7C3AED" />
                  </g>

                  <g className="animate-float-medium">
                    <rect x="95" y="95" width="75" height="48" rx="15" fill="url(#bubbleGradCyan)" className="opacity-95" />
                    <circle cx="113" cy="119" r="8" fill="white" className="opacity-20" />
                    <line x1="130" y1="115" x2="152" y2="115" stroke="white" strokeWidth="3" strokeLinecap="round" className="opacity-40" />
                    <line x1="130" y1="125" x2="144" y2="125" stroke="white" strokeWidth="3" strokeLinecap="round" className="opacity-40" />
                    <path d="M150 143 L160 152 L145 147 Z" fill="#06B6D4" />
                  </g>
                  
                  {/* Connecting Nodes (Connecto Network) */}
                  <path d="M75 62 Q100 100 132 119" stroke="url(#lineGrad)" strokeWidth="2.5" strokeDasharray="5 5" />
                  
                  {/* Floating icons */}
                  <circle cx="150" cy="45" r="10" fill="#EC4899" className="animate-bounce" />
                  <path d="M147 42 L153 48 M153 42 L147 48" stroke="white" strokeWidth="2" />
                  
                  <circle cx="50" cy="140" r="12" fill="#10B981" className="animate-float-fast" />
                  <path d="M46 140 L49 143 L55 137" stroke="white" strokeWidth="2" strokeLinecap="round" />

                  {/* Gradients */}
                  <defs>
                    <radialGradient id="coreGrad" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#0F172A" stopOpacity="0" />
                    </radialGradient>
                    <linearGradient id="bubbleGradPurple" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#A78BFA" />
                      <stop offset="100%" stopColor="#7C3AED" />
                    </linearGradient>
                    <linearGradient id="bubbleGradCyan" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#22D3EE" />
                      <stop offset="100%" stopColor="#06B6D4" />
                    </linearGradient>
                    <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#EC4899" />
                      <stop offset="100%" stopColor="#06B6D4" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>

              <h2 className="text-4xl font-display font-bold text-white mb-4 tracking-tight">
                Welcome to <span className="bg-gradient-to-r from-brand-primary via-brand-accent to-brand-secondary bg-clip-text text-transparent animate-pulse-glow">Connecto</span>
              </h2>
              <p className="text-sm text-gray-300 max-w-md leading-relaxed mb-8">
                Connect instantly with friends, teams and communities around the world.
              </p>

              {/* Start new conversation button & community actions */}
              <div className="flex flex-wrap gap-4 justify-center">
                <button 
                  onClick={() => setActiveTab('CONTACTS')}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-brand-primary to-brand-accent hover:opacity-95 text-white font-semibold text-xs shadow-lg shadow-brand-primary/25 hover:shadow-brand-accent/45 transition-all duration-300 hover:scale-[1.02] cursor-pointer"
                >
                  Start New Chat
                </button>
                <button 
                  onClick={() => setActiveTab('GROUPS')}
                  className="px-6 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white border border-white/10 font-semibold text-xs transition-all duration-300 hover:scale-[1.02] cursor-pointer"
                >
                  Create Group
                </button>
                <button 
                  onClick={() => setActiveTab('CONTACTS')}
                  className="px-6 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white border border-white/10 font-semibold text-xs transition-all duration-300 hover:scale-[1.02] cursor-pointer"
                >
                  View Contacts
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Calling overlay handles incoming/outgoing audio-video */}
      {callState && <CallOverlay />}
    </div>
  )
}

export default Dashboard
