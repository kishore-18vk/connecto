import React, { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { setActiveChatId, addChat } from '../../redux/chatSlice'
import api from '../../services/api'
import { 
  Search, Plus, Users, X, Image as ImageIcon, Camera, 
  Pin, VolumeX, Archive, Trash2, MoreVertical, Star 
} from 'lucide-react'

function ChatList({ onStartChat }) {
  const chats = useSelector((state) => state.chat.chats)
  const activeChatId = useSelector((state) => state.chat.activeChatId)
  const presenceMap = useSelector((state) => state.chat.presence)
  const currentUser = useSelector((state) => state.auth.user)
  const dispatch = useDispatch()

  const [search, setSearch] = useState('')
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [groupDesc, setGroupDesc] = useState('')
  const [groupPicture, setGroupPicture] = useState(null)
  const [selectedContacts, setSelectedContacts] = useState([])
  const [contacts, setContacts] = useState([])

  // Premium tab filter state
  const [activeFilter, setActiveFilter] = useState('ALL') // ALL, UNREAD, GROUPS, FAVORITES, ARCHIVED
  const [pinnedChats, setPinnedChats] = useState([])
  const [mutedChats, setMutedChats] = useState([])
  const [archivedChats, setArchivedChats] = useState([])
  const [favoriteChats, setFavoriteChats] = useState([])
  const [deletedChats, setDeletedChats] = useState([])
  const [activeMenuChatId, setActiveMenuChatId] = useState(null)

  // Fetch contacts for group membership selection
  useEffect(() => {
    if (showCreateGroup) {
      api.get('contacts/').then((res) => {
        setContacts(res.data)
      }).catch(err => console.error("Error loading contacts", err))
    }
  }, [showCreateGroup])

  // Load preferences from localStorage per user
  useEffect(() => {
    if (currentUser) {
      const uId = currentUser.id
      setPinnedChats(JSON.parse(localStorage.getItem(`connecto_pinned_${uId}`) || '[]'))
      setMutedChats(JSON.parse(localStorage.getItem(`connecto_muted_${uId}`) || '[]'))
      setArchivedChats(JSON.parse(localStorage.getItem(`connecto_archived_${uId}`) || '[]'))
      setFavoriteChats(JSON.parse(localStorage.getItem(`connecto_favorites_${uId}`) || '[]'))
      setDeletedChats(JSON.parse(localStorage.getItem(`connecto_deleted_${uId}`) || '[]'))
    }
  }, [currentUser])

  // Helper to persist array preferences
  const saveToLocalStorage = (key, data) => {
    if (currentUser) {
      localStorage.setItem(`connecto_${key}_${currentUser.id}`, JSON.stringify(data))
    }
  }

  // Action togglers
  const togglePin = (chatId, e) => {
    e.stopPropagation()
    const updated = pinnedChats.includes(chatId) 
      ? pinnedChats.filter(id => id !== chatId) 
      : [...pinnedChats, chatId]
    setPinnedChats(updated)
    saveToLocalStorage('pinned', updated)
    setActiveMenuChatId(null)
  }

  const toggleMute = (chatId, e) => {
    e.stopPropagation()
    const updated = mutedChats.includes(chatId) 
      ? mutedChats.filter(id => id !== chatId) 
      : [...mutedChats, chatId]
    setMutedChats(updated)
    saveToLocalStorage('muted', updated)
    setActiveMenuChatId(null)
  }

  const toggleArchive = (chatId, e) => {
    e.stopPropagation()
    const updated = archivedChats.includes(chatId) 
      ? archivedChats.filter(id => id !== chatId) 
      : [...archivedChats, chatId]
    setArchivedChats(updated)
    saveToLocalStorage('archived', updated)
    setActiveMenuChatId(null)
  }

  const toggleFavorite = (chatId, e) => {
    e.stopPropagation()
    const updated = favoriteChats.includes(chatId) 
      ? favoriteChats.filter(id => id !== chatId) 
      : [...favoriteChats, chatId]
    setFavoriteChats(updated)
    saveToLocalStorage('favorites', updated)
    setActiveMenuChatId(null)
  }

  const handleDeleteChat = (chatId, e) => {
    e.stopPropagation()
    if (window.confirm("Are you sure you want to delete this chat?")) {
      const updated = [...deletedChats, chatId]
      setDeletedChats(updated)
      saveToLocalStorage('deleted', updated)
      if (activeChatId === chatId) {
        dispatch(setActiveChatId(null))
      }
      setActiveMenuChatId(null)
    }
  }

  // Click outside menus to dismiss
  useEffect(() => {
    const handleOutsideClick = () => setActiveMenuChatId(null)
    document.addEventListener('click', handleOutsideClick)
    return () => document.removeEventListener('click', handleOutsideClick)
  }, [])

  const filteredChats = chats.filter((c) => {
    // Hide deleted chats
    if (deletedChats.includes(c.id)) return false

    // Filter by filter tab
    if (activeFilter === 'ARCHIVED') {
      if (!archivedChats.includes(c.id)) return false
    } else {
      if (archivedChats.includes(c.id)) return false
    }

    if (activeFilter === 'UNREAD' && !(c.unread_count > 0)) return false
    if (activeFilter === 'GROUPS' && c.type !== 'GROUP') return false
    if (activeFilter === 'FAVORITES' && !favoriteChats.includes(c.id)) return false

    // Filter by search query
    if (c.type === 'GROUP') {
      return c.group_details?.name?.toLowerCase().includes(search.toLowerCase())
    } else {
      const other = c.participants_details?.find((p) => p.id !== currentUser?.id)
      return other?.username?.toLowerCase().includes(search.toLowerCase()) || 
             other?.nickname?.toLowerCase().includes(search.toLowerCase()) ||
             other?.first_name?.toLowerCase().includes(search.toLowerCase())
    }
  })

  // Sort pinned chats first, then chronological
  const sortedChats = [...filteredChats].sort((a, b) => {
    const pinA = pinnedChats.includes(a.id) ? 1 : 0
    const pinB = pinnedChats.includes(b.id) ? 1 : 0
    if (pinA !== pinB) return pinB - pinA 

    const timeA = new Date(a.last_message?.created_at || a.updated_at || 0).getTime()
    const timeB = new Date(b.last_message?.created_at || b.updated_at || 0).getTime()
    return timeB - timeA
  })

  const getChatDetails = (chat) => {
    if (chat.type === 'GROUP') {
      return {
        name: chat.group_details?.name || 'Group Chat',
        avatar: chat.group_details?.profile_picture,
        isOnline: false,
        isGroup: true
      }
    } else {
      const other = chat.participants_details?.find((p) => p.id !== currentUser?.id)
      const otherPresence = presenceMap[other?.id]
      return {
        name: other ? (other.nickname || `${other.first_name} ${other.last_name || ''}`.trim() || other.username) : 'Unknown User',
        avatar: other?.avatar_url || other?.profile?.profile_picture,
        isOnline: otherPresence ? otherPresence.is_online : other?.is_online,
        isGroup: false
      }
    }
  }

  const formatMessageTime = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const handleGroupPictureChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setGroupPicture(e.target.files[0])
    }
  }

  const handleContactToggle = (contactId) => {
    if (selectedContacts.includes(contactId)) {
      setSelectedContacts(selectedContacts.filter(id => id !== contactId))
    } else {
      setSelectedContacts([...selectedContacts, contactId])
    }
  }

  const handleCreateGroupSubmit = async (e) => {
    e.preventDefault()
    if (!groupName) return

    const formData = new FormData()
    formData.append('name', groupName)
    formData.append('description', groupDesc)
    if (groupPicture) {
      formData.append('profile_picture', groupPicture)
    }
    selectedContacts.forEach(id => {
      formData.append('members', id)
    })

    try {
      const res = await api.post('groups/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      const newChatRes = await api.get(`chats/${res.data.chat_id}/`)
      dispatch(addChat(newChatRes.data))
      dispatch(setActiveChatId(res.data.chat_id))
      setShowCreateGroup(false)
      setGroupName('')
      setGroupDesc('')
      setGroupPicture(null)
      setSelectedContacts([])
      if (onStartChat) onStartChat()
    } catch (err) {
      console.error("Error creating group", err)
    }
  }

  return (
    <div className="flex flex-col h-full w-full">
      {/* List Header */}
      <div className="p-5 flex justify-between items-center border-b border-white/5">
        <h2 className="text-xl font-bold text-white font-display">Chats</h2>
        <button 
          onClick={() => setShowCreateGroup(true)}
          className="p-2 rounded-xl text-gray-400 hover:bg-white/5 hover:text-brand-primary transition-all cursor-pointer border border-transparent hover:border-white/5"
          title="New Group Chat"
        >
          <Plus size={18} />
        </button>
      </div>

      {/* Search Bar */}
      <div className="px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2.5 bg-white/5 rounded-xl px-3.5 py-2 border border-white/5 focus-within:border-brand-primary/45 focus-within:shadow-[0_0_12px_rgba(124,58,237,0.15)] transition-all">
          <Search size={16} className="text-gray-400" />
          <input 
            type="text" 
            placeholder="Search conversations..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm w-full outline-none text-white placeholder-gray-400"
          />
        </div>
      </div>

      {/* Premium Filter Tabs */}
      <div className="px-4 py-2 border-b border-white/5 flex gap-1.5 overflow-x-auto no-scrollbar scrollbar-none">
        {[
          { id: 'ALL', label: 'All Chats' },
          { id: 'UNREAD', label: 'Unread' },
          { id: 'GROUPS', label: 'Groups' },
          { id: 'FAVORITES', label: 'Favorites' },
          { id: 'ARCHIVED', label: 'Archived' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveFilter(tab.id)}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${activeFilter === tab.id ? 'bg-brand-primary text-white shadow-md shadow-brand-primary/20' : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Chats Container */}
      <div className="flex-1 overflow-y-auto py-2">
        {sortedChats.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400 flex flex-col items-center gap-2">
            <span className="text-2xl opacity-60">✉️</span>
            <span>No conversations found</span>
          </div>
        ) : (
          sortedChats.map((chat) => {
            const details = getChatDetails(chat)
            const isActive = activeChatId === chat.id
            const lastMsg = chat.last_message
            const isPinned = pinnedChats.includes(chat.id)
            const isMuted = mutedChats.includes(chat.id)
            const isFavorite = favoriteChats.includes(chat.id)

            return (
              <div 
                key={chat.id}
                onClick={() => { dispatch(setActiveChatId(chat.id)); if(onStartChat) onStartChat(); }}
                className={`flex items-center gap-3.5 px-4 py-3 mx-2 my-1 rounded-xl cursor-pointer select-none transition-all relative group ${isActive ? 'bg-white/10 text-white' : 'hover:bg-white/[0.03] text-gray-300'}`}
              >
                {/* Active indicator bar */}
                {isActive && (
                  <div className="absolute left-0 top-3 bottom-3 w-1 bg-gradient-to-b from-brand-primary to-brand-accent rounded-r-lg"></div>
                )}

                {/* Chat Avatar */}
                <div className="relative shrink-0">
                  {details.avatar ? (
                    <img src={details.avatar} alt="Avatar" className="w-11 h-11 rounded-full object-cover border border-white/5" />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary font-bold">
                      {details.isGroup ? <Users size={20} /> : <span className="font-semibold text-xs">{details.name.substring(0, 2).toUpperCase()}</span>}
                    </div>
                  )}
                  {details.isOnline && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-brand-success border-2 border-[#0F172A] rounded-full"></div>
                  )}
                </div>

                {/* Name, Msg, Time info */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <div className="flex items-center gap-1 min-w-0">
                      <h3 className="text-sm font-semibold truncate pr-1">{details.name}</h3>
                      {isPinned && <Pin size={11} className="text-brand-primary shrink-0" />}
                      {isMuted && <VolumeX size={11} className="text-gray-400 shrink-0" />}
                      {isFavorite && <Star size={11} className="text-yellow-400 fill-yellow-400 shrink-0" />}
                    </div>
                    <span className="text-[10px] text-gray-400 shrink-0">{formatMessageTime(chat.last_message?.created_at || chat.updated_at)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-gray-400 truncate pr-2">
                      {lastMsg ? (
                        lastMsg.is_deleted_for_everyone ? (
                          <span className="italic">This message was deleted</span>
                        ) : lastMsg.message_type === 'TEXT' ? (
                          lastMsg.content
                        ) : (
                          <span className="flex items-center gap-1">
                            <ImageIcon size={11} />
                            {lastMsg.message_type}
                          </span>
                        )
                      ) : (
                        <span className="italic text-[10px] opacity-60">No messages yet</span>
                      )}
                    </p>
                    
                    {/* Unread count & Context Options Trigger */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {chat.unread_count > 0 && (
                        <span className="min-w-[18px] h-[18px] bg-gradient-to-r from-brand-primary to-brand-accent text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-lg shadow-brand-primary/20">
                          {chat.unread_count}
                        </span>
                      )}
                      
                      {/* Three-dots menu trigger */}
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setActiveMenuChatId(activeMenuChatId === chat.id ? null : chat.id)
                          }}
                          className="p-1 rounded-lg text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreVertical size={14} />
                        </button>

                        {/* Action Dropdown Menu */}
                        {activeMenuChatId === chat.id && (
                          <div className="absolute right-0 bottom-6 w-36 bg-[#1e293b] border border-white/10 rounded-xl py-1 shadow-2xl z-30 glass-card">
                            <button
                              onClick={(e) => togglePin(chat.id, e)}
                              className="w-full text-left px-3.5 py-2 text-xs hover:bg-white/5 text-white flex items-center gap-2"
                            >
                              <Pin size={12} /> {isPinned ? 'Unpin' : 'Pin Chat'}
                            </button>
                            <button
                              onClick={(e) => toggleMute(chat.id, e)}
                              className="w-full text-left px-3.5 py-2 text-xs hover:bg-white/5 text-white flex items-center gap-2"
                            >
                              <VolumeX size={12} /> {isMuted ? 'Unmute' : 'Mute Chat'}
                            </button>
                            <button
                              onClick={(e) => toggleArchive(chat.id, e)}
                              className="w-full text-left px-3.5 py-2 text-xs hover:bg-white/5 text-white flex items-center gap-2"
                            >
                              <Archive size={12} /> {archivedChats.includes(chat.id) ? 'Unarchive' : 'Archive'}
                            </button>
                            <button
                              onClick={(e) => toggleFavorite(chat.id, e)}
                              className="w-full text-left px-3.5 py-2 text-xs hover:bg-white/5 text-white flex items-center gap-2"
                            >
                              <Star size={12} /> {isFavorite ? 'Remove Fav' : 'Add Fav'}
                            </button>
                            <div className="h-[1px] bg-white/5 my-1"></div>
                            <button
                              onClick={(e) => handleDeleteChat(chat.id, e)}
                              className="w-full text-left px-3.5 py-2 text-xs hover:bg-rose-950/20 text-rose-400 flex items-center gap-2"
                            >
                              <Trash2 size={12} /> Delete Chat
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Group Creation Modal */}
      {showCreateGroup && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form 
            onSubmit={handleCreateGroupSubmit}
            className="w-full max-w-md bg-[#1e293b]/90 border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] glass-card"
          >
            {/* Modal Header */}
            <div className="p-4 border-b border-white/5 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white font-display">Create New Group</h3>
              <button 
                type="button" 
                onClick={() => setShowCreateGroup(false)}
                className="text-gray-400 hover:text-white p-1"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Scroll Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              
              {/* Group Avatar Upload */}
              <div className="flex flex-col items-center">
                <div className="relative group cursor-pointer w-24 h-24 rounded-full bg-[#0f172a] border border-white/10 flex items-center justify-center text-gray-400 overflow-hidden">
                  {groupPicture ? (
                    <img 
                      src={URL.createObjectURL(groupPicture)} 
                      alt="Group Preview" 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <Users size={40} />
                  )}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera size={20} className="text-white" />
                  </div>
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={handleGroupPictureChange}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
                <span className="text-[11px] text-gray-400 mt-2">Upload Group Picture</span>
              </div>

              {/* Group Name & Desc */}
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Group Name</label>
                  <input 
                    type="text" 
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="e.g. Family Chat"
                    className="w-full bg-[#0f172a] border border-white/10 focus:border-brand-primary rounded-xl px-4 py-2.5 text-sm text-white outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Group Description</label>
                  <textarea 
                    value={groupDesc}
                    onChange={(e) => setGroupDesc(e.target.value)}
                    placeholder="What is this group about?"
                    rows={2}
                    className="w-full bg-[#0f172a] border border-white/10 focus:border-brand-primary rounded-xl px-4 py-2.5 text-sm text-white outline-none resize-none"
                  />
                </div>
              </div>

              {/* Contacts Selection */}
              <div>
                <label className="text-xs text-gray-400 block mb-2">Select Members</label>
                {contacts.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No contacts added yet. Add contacts to add them to groups.</p>
                ) : (
                  <div className="max-h-48 overflow-y-auto border border-white/10 rounded-xl bg-[#0f172a] divide-y divide-white/5">
                    {contacts.map((c) => {
                      const details = c.contact_details
                      const isChecked = selectedContacts.includes(details.id)
                      return (
                        <div 
                          key={c.id} 
                          onClick={() => handleContactToggle(details.id)}
                          className="flex items-center gap-3 p-3 hover:bg-white/[0.03] cursor-pointer select-none"
                        >
                          <input 
                            type="checkbox"
                            checked={isChecked}
                            readOnly
                            className="accent-brand-primary"
                          />
                          <div className="w-8 h-8 rounded-full bg-white/10 overflow-hidden flex items-center justify-center shrink-0">
                            {details.avatar_url ? (
                              <img src={details.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-xs font-semibold text-white">{(details.nickname || details.first_name || details.username)[0].toUpperCase()}</span>
                            )}
                          </div>
                          <span className="text-sm text-white truncate">{details.nickname || `${details.first_name} ${details.last_name || ''}`.trim() || details.username}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-white/5 flex justify-end gap-3 bg-[#1e293b]/50">
              <button
                type="button"
                onClick={() => setShowCreateGroup(false)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-gradient-to-r from-brand-primary to-brand-accent hover:opacity-90 text-white font-semibold rounded-xl px-5 py-2.5 text-sm cursor-pointer transition-all shadow-md shadow-brand-primary/10"
              >
                Create Group
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  )
}

export default ChatList
