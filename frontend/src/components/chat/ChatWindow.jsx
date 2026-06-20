import React, { useState, useEffect, useRef } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { setMessages, addMessage, updateMessage } from '../../redux/chatSlice'
import { startCall } from '../../redux/callSlice'
import api from '../../services/api'
import wsService from '../../services/websocket'

// Icons
import { 
  Phone, Video, MoreVertical, Send, Paperclip, Smile, Reply, Star, 
  Pin, Trash2, X, MessageSquare, ShieldAlert, Search, Download, 
  Slash, Info, Forward, Copy, Edit3, Image, FileText, Gift, SmileIcon, Mic 
} from 'lucide-react'

function ChatWindow() {
  const dispatch = useDispatch()
  const activeChatId = useSelector((state) => state.chat.activeChatId)
  const chats = useSelector((state) => state.chat.chats)
  const messagesMap = useSelector((state) => state.chat.messages)
  const typingMap = useSelector((state) => state.chat.typing)
  const presenceMap = useSelector((state) => state.chat.presence)
  const currentUser = useSelector((state) => state.auth.user)

  const messages = messagesMap[activeChatId] || []
  const currentChat = chats.find((c) => c.id === activeChatId)
  
  const [inputText, setInputText] = useState('')
  const [replyMessage, setReplyMessage] = useState(null)
  const [editingMessage, setEditingMessage] = useState(null)
  
  // Menu/Overlay states
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showForwardModal, setShowForwardModal] = useState(false)
  const [messageToForward, setMessageToForward] = useState(null)
  
  const [showOptionsId, setShowOptionsId] = useState(null)
  const [showReactionsId, setShowReactionsId] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [typingState, setTypingState] = useState(false)

  // Message search state
  const [isSearching, setIsSearching] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Attachment menu states
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false)
  const [showGifSelector, setShowGifSelector] = useState(false)
  const [showStickerSelector, setShowStickerSelector] = useState(false)
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false)
  
  // Voice note simulation state
  const [isRecording, setIsRecording] = useState(false)
  const [recordDuration, setRecordDuration] = useState(0)

  const messagesEndRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const fileInputRef = useRef(null)
  const docInputRef = useRef(null)
  const recordIntervalRef = useRef(null)

  // Fetch messages when active chat changes
  useEffect(() => {
    if (activeChatId) {
      api.get(`chats/${activeChatId}/messages/`).then((res) => {
        dispatch(setMessages({ chatId: activeChatId, messages: res.data }))
        wsService.sendReadReceipt(activeChatId)
      }).catch(err => console.error("Error loading messages", err))

      setReplyMessage(null)
      setEditingMessage(null)
      setInputText('')
      setIsSearching(false)
      setSearchQuery('')
      setShowAttachmentMenu(false)
      setShowGifSelector(false)
      setShowStickerSelector(false)
      setShowVoiceRecorder(false)
    }
  }, [activeChatId, dispatch])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Mark new incoming messages as read immediately
  useEffect(() => {
    if (activeChatId && messages.length > 0) {
      const lastMsg = messages[messages.length - 1]
      if (lastMsg && lastMsg.sender !== currentUser?.id && !lastMsg.is_seen) {
        wsService.sendReadReceipt(activeChatId)
      }
    }
  }, [messages, activeChatId, currentUser])

  // Compute other user or group details
  const getChatHeaderInfo = () => {
    if (!currentChat) return null
    if (currentChat.type === 'GROUP') {
      const activeTypers = []
      const typingStates = typingMap[activeChatId] || {}
      Object.keys(typingStates).forEach(uid => {
        if (typingStates[uid]) {
          const userObj = currentChat.participants_details?.find(p => p.id === parseInt(uid))
          if (userObj) activeTypers.push(userObj.nickname || userObj.first_name || userObj.username)
        }
      })

      if (activeTypers.length > 0) {
        return {
          title: currentChat.group_details?.name || 'Group Chat',
          avatar: currentChat.group_details?.profile_picture,
          statusText: `${activeTypers.join(', ')} is typing...`,
          isGroup: true
        }
      }

      const count = currentChat.participants_details?.length || 0
      return {
        title: currentChat.group_details?.name || 'Group Chat',
        avatar: currentChat.group_details?.profile_picture,
        statusText: `${count} participants`,
        isGroup: true
      }
    } else {
      const other = currentChat.participants_details?.find(p => p.id !== currentUser?.id)
      const otherPresence = presenceMap[other?.id] || { is_online: other?.is_online, last_seen: other?.last_seen }
      
      const isTyping = typingMap[activeChatId]?.[other?.id]
      if (isTyping) {
        return {
          title: other ? (other.nickname || `${other.first_name} ${other.last_name || ''}`.trim() || other.username) : 'Chat',
          avatar: other?.avatar_url || other?.profile?.profile_picture,
          statusText: 'typing...',
          isGroup: false
        }
      }

      return {
        title: other ? (other.nickname || `${other.first_name} ${other.last_name || ''}`.trim() || other.username) : 'Chat',
        avatar: other?.avatar_url || other?.profile?.profile_picture,
        statusText: otherPresence.is_online ? 'online' : (otherPresence.last_seen ? `last seen at ${new Date(otherPresence.last_seen).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}` : 'offline'),
        isGroup: false,
        otherUser: other
      }
    }
  }

  const headerInfo = getChatHeaderInfo()

  // Typing state management
  const handleInputChange = (e) => {
    setInputText(e.target.value)
    if (!typingState) {
      setTypingState(true)
      wsService.sendTyping(activeChatId, true)
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      setTypingState(false)
      wsService.sendTyping(activeChatId, false)
    }, 2000)
  }

  // Outbound WebRTC initiation
  const initiateCall = (callType) => {
    if (currentChat.type === 'GROUP') return
    const otherUser = currentChat.participants_details?.find(p => p.id !== currentUser?.id)
    if (otherUser) {
      dispatch(startCall({ receiver: otherUser, callType }))
    }
  }

  // Handle message sending & editing
  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!inputText.trim()) return

    if (editingMessage) {
      try {
        const res = await api.patch(`chats/messages/${editingMessage.id}/`, { content: inputText })
        dispatch(updateMessage(res.data))
        setEditingMessage(null)
      } catch (err) {
        console.error("Failed to edit message", err)
      }
    } else {
      wsService.sendMessage(activeChatId, inputText, 'TEXT', null, replyMessage?.id)
      setReplyMessage(null)
    }
    setInputText('')
  }

  // Handle media uploading
  const handleFileUpload = async (e, forcedType = null) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setUploading(true)
      const formData = new FormData()
      formData.append('file', file)

      try {
        const res = await api.post('media/upload/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        const mediaUrl = res.data.file_url
        const fileType = forcedType || res.data.file_type

        wsService.sendMessage(activeChatId, file.name, fileType, mediaUrl, replyMessage?.id)
        setReplyMessage(null)
        setShowAttachmentMenu(false)
      } catch (err) {
        console.error("Error uploading media file", err)
      } finally {
        setUploading(false)
      }
    }
  }

  // Toggle Starring
  const handleToggleStar = async (msgId) => {
    try {
      await api.post(`chats/messages/${msgId}/star/`)
      const updatedMsgs = messages.map(m => m.id === msgId ? { ...m, is_starred: !m.is_starred } : m)
      dispatch(setMessages({ chatId: activeChatId, messages: updatedMsgs }))
    } catch (e) {
      console.error(e)
    }
  }

  // Toggle Pinning
  const handleTogglePin = async (msgId) => {
    try {
      await api.post(`chats/messages/${msgId}/pin/`)
      const updatedMsgs = messages.map(m => m.id === msgId ? { ...m, is_pinned: !m.is_pinned } : m)
      dispatch(setMessages({ chatId: activeChatId, messages: updatedMsgs }))
    } catch (e) {
      console.error(e)
    }
  }

  // Delete message for me
  const handleDeleteForMe = async (msgId) => {
    try {
      await api.post(`chats/messages/${msgId}/delete_for_me/`)
      const updatedMsgs = messages.filter(m => m.id !== msgId)
      dispatch(setMessages({ chatId: activeChatId, messages: updatedMsgs }))
    } catch (e) {
      console.error(e)
    }
  }

  // Delete message for everyone
  const handleDeleteForEveryone = async (msgId) => {
    try {
      await api.post(`chats/messages/${msgId}/delete_for_everyone/`)
      const updatedMsgs = messages.map(m => m.id === msgId ? { ...m, is_deleted_for_everyone: true, content: "This message was deleted." } : m)
      dispatch(setMessages({ chatId: activeChatId, messages: updatedMsgs }))
    } catch (e) {
      console.error(e)
    }
  }

  // Add emoji reaction
  const handleAddReaction = async (msgId, emoji) => {
    try {
      const res = await api.post(`chats/messages/${msgId}/react/`, { emoji })
      const updatedMsgs = messages.map(m => {
        if (m.id === msgId) {
          return {
            ...m,
            reactions: res.data.reactions || []
          }
        }
        return m
      })
      dispatch(setMessages({ chatId: activeChatId, messages: updatedMsgs }))
      setShowReactionsId(null)
    } catch (e) {
      console.error(e)
    }
  }

  // Copy Message to clipboard
  const handleCopyMessage = (content) => {
    navigator.clipboard.writeText(content)
    alert("Message copied to clipboard")
    setShowOptionsId(null)
  }

  // Forward message helper
  const handleForwardMessage = (chatId) => {
    if (messageToForward) {
      wsService.sendMessage(chatId, messageToForward.content, messageToForward.message_type, messageToForward.media_url)
      setShowForwardModal(false)
      setMessageToForward(null)
      alert("Message forwarded successfully!")
    }
  }

  // Export Chat History
  const handleExportChat = () => {
    const historyText = messages.map(m => {
      const time = new Date(m.created_at).toLocaleString()
      const senderName = m.sender === currentUser?.id ? 'You' : (headerInfo?.title || 'Other')
      return `[${time}] ${senderName}: ${m.content || (m.message_type + ' media attachment')}`
    }).join('\n')
    
    const blob = new Blob([historyText], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `chat_history_${headerInfo?.title || 'export'}.txt`
    link.click()
    URL.revokeObjectURL(url)
    setShowMoreMenu(false)
  }

  // Clear Chat History (locally & asynchronously calling delete_for_me on all messages)
  const handleClearChat = async () => {
    if (window.confirm("Are you sure you want to clear this chat? This deletes all messages for you.")) {
      dispatch(setMessages({ chatId: activeChatId, messages: [] }))
      setShowMoreMenu(false)
      // Call api endpoints asynchronously
      messages.forEach(async (m) => {
        try {
          await api.post(`chats/messages/${m.id}/delete_for_me/`)
        } catch(e){}
      })
    }
  }

  // Block contact user
  const handleBlockUser = async () => {
    if (headerInfo?.isGroup) return
    const otherUser = headerInfo?.otherUser
    if (otherUser) {
      if (window.confirm(`Are you sure you want to block ${headerInfo.title}?`)) {
        try {
          await api.post('accounts/block/', { blocked_user_id: otherUser.id })
          alert("User blocked successfully")
          setShowMoreMenu(false)
        } catch (e) {
          console.error(e)
        }
      }
    }
  }

  // Report contact user
  const handleReportUser = () => {
    alert("User reported successfully. Connecto security team will review the conversation.")
    setShowMoreMenu(false)
  }

  // Simulated Voice Note actions
  const startRecording = () => {
    setIsRecording(true)
    setRecordDuration(0)
    recordIntervalRef.current = setInterval(() => {
      setRecordDuration(prev => prev + 1)
    }, 1000)
  }

  const stopRecordingAndSend = () => {
    clearInterval(recordIntervalRef.current)
    setIsRecording(false)
    // Send simulated voice note URL
    wsService.sendMessage(
      activeChatId, 
      `Voice Note (${recordDuration}s)`, 
      'AUDIO', 
      'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'
    )
    setShowVoiceRecorder(false)
    setShowAttachmentMenu(false)
  }

  const cancelRecording = () => {
    clearInterval(recordIntervalRef.current)
    setIsRecording(false)
    setRecordDuration(0)
    setShowVoiceRecorder(false)
  }

  // Simulated GIF send
  const sendGif = (gifUrl) => {
    wsService.sendMessage(activeChatId, 'Shared a GIF', 'IMAGE', gifUrl)
    setShowGifSelector(false)
    setShowAttachmentMenu(false)
  }

  // Simulated Sticker send
  const sendSticker = (stickerUrl) => {
    wsService.sendMessage(activeChatId, 'Shared a Sticker', 'IMAGE', stickerUrl)
    setShowStickerSelector(false)
    setShowAttachmentMenu(false)
  }

  // Highlight message helper
  const highlightText = (text, highlight) => {
    if (!highlight.trim()) return text
    const regex = new RegExp(`(${highlight})`, 'gi')
    const parts = text.split(regex)
    return (
      <span>
        {parts.map((part, i) => 
          regex.test(part) 
            ? <mark key={i} className="bg-brand-primary/40 text-brand-secondary px-0.5 rounded font-medium">{part}</mark> 
            : part
        )}
      </span>
    )
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#0b1329]/20 relative">
      
      {/* 1. Chat Header */}
      {headerInfo && (
        <div className="h-[68px] bg-slate-900/60 border-b border-white/5 flex justify-between items-center px-5 shrink-0 z-20 backdrop-blur-md">
          <div className="flex items-center gap-3">
            {headerInfo.avatar ? (
              <img src={headerInfo.avatar} alt="Avatar" className="w-10 h-10 rounded-xl object-cover border border-white/10" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center text-brand-primary text-sm font-semibold">
                {headerInfo.title.substring(0,2).toUpperCase()}
              </div>
            )}
            <div>
              <h3 className="text-sm font-bold text-white leading-tight font-display">{headerInfo.title}</h3>
              <span className="text-[11px] text-gray-400">{headerInfo.statusText}</span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-gray-300">
            {/* Inline message search toggle */}
            <button 
              onClick={() => setIsSearching(!isSearching)} 
              className={`hover:text-brand-primary transition-all p-1.5 rounded-lg cursor-pointer ${isSearching ? 'text-brand-primary bg-white/5' : ''}`}
              title="Search Messages"
            >
              <Search size={18} />
            </button>

            {!headerInfo.isGroup && (
              <>
                <button onClick={() => initiateCall('VOICE')} className="hover:text-brand-primary hover:scale-105 transition-all p-1.5 rounded-lg cursor-pointer" title="Voice Call">
                  <Phone size={18} />
                </button>
                <button onClick={() => initiateCall('VIDEO')} className="hover:text-brand-primary hover:scale-105 transition-all p-1.5 rounded-lg cursor-pointer" title="Video Call">
                  <Video size={18} />
                </button>
              </>
            )}
            
            <div className="relative">
              <button 
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className="hover:text-brand-primary transition-all p-1.5 rounded-lg cursor-pointer"
              >
                <MoreVertical size={18} />
              </button>

              {showMoreMenu && (
                <div className="absolute right-0 top-9 w-44 bg-[#1e293b] border border-white/10 rounded-2xl py-1.5 shadow-2xl z-30 glass-card">
                  <button 
                    onClick={() => { setShowProfileModal(true); setShowMoreMenu(false); }}
                    className="w-full px-4 py-2 text-xs text-white hover:bg-white/5 text-left flex items-center gap-2"
                  >
                    <Info size={13} /> View Profile
                  </button>
                  <button 
                    onClick={() => { setIsSearching(true); setShowMoreMenu(false); }}
                    className="w-full px-4 py-2 text-xs text-white hover:bg-white/5 text-left flex items-center gap-2"
                  >
                    <Search size={13} /> Search Messages
                  </button>
                  <button 
                    onClick={handleClearChat}
                    className="w-full px-4 py-2 text-xs text-white hover:bg-white/5 text-left flex items-center gap-2"
                  >
                    <Trash2 size={13} /> Clear Chat
                  </button>
                  <button 
                    onClick={handleExportChat}
                    className="w-full px-4 py-2 text-xs text-white hover:bg-white/5 text-left flex items-center gap-2"
                  >
                    <Download size={13} /> Export Chat
                  </button>
                  <div className="h-[1px] bg-white/5 my-1.5"></div>
                  {!headerInfo.isGroup && (
                    <button 
                      onClick={handleBlockUser}
                      className="w-full px-4 py-2 text-xs text-rose-400 hover:bg-rose-950/20 text-left flex items-center gap-2"
                    >
                      <Slash size={13} /> Block User
                    </button>
                  )}
                  <button 
                    onClick={handleReportUser}
                    className="w-full px-4 py-2 text-xs text-rose-400 hover:bg-rose-950/20 text-left flex items-center gap-2"
                  >
                    <ShieldAlert size={13} /> Report User
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Message search inline input */}
      {isSearching && (
        <div className="px-5 py-2.5 bg-slate-900/40 border-b border-white/5 flex items-center justify-between gap-3 animate-fade-in z-10 backdrop-blur-md">
          <div className="flex items-center gap-2 bg-white/5 border border-white/5 rounded-xl px-3.5 py-1.5 flex-1 max-w-md focus-within:border-brand-primary/40">
            <Search size={14} className="text-gray-400" />
            <input
              type="text"
              placeholder="Search in this chat..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-xs w-full text-white outline-none placeholder-gray-400"
            />
          </div>
          <button 
            onClick={() => { setIsSearching(false); setSearchQuery(''); }}
            className="text-gray-400 hover:text-white p-1"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* 2. Messages List Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-transparent relative">
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-repeat bg-[size:300px] bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')]"></div>

        <div className="relative z-10 space-y-3">
          {messages.map((msg) => {
            const isMe = msg.sender === currentUser?.id
            const isSystem = msg.message_type === 'SYSTEM'
            const showOptions = showOptionsId === msg.id
            const showReactions = showReactionsId === msg.id

            if (isSystem) {
              return (
                <div key={msg.id} className="flex justify-center my-2">
                  <span className="bg-white/5 border border-white/5 text-[11px] text-gray-400 px-3 py-1 rounded-lg">
                    {msg.content}
                  </span>
                </div>
              )
            }

            return (
              <div 
                key={msg.id} 
                className={`flex w-full group relative ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                
                {/* Message Bubble */}
                <div 
                  className={`max-w-[65%] rounded-2xl px-4 py-2.5 shadow-md relative border transition-all ${
                    isMe 
                      ? 'bg-brand-primary/20 text-white border-brand-primary/30 rounded-tr-none shadow-brand-primary/5' 
                      : 'bg-white/5 text-gray-200 border-white/5 rounded-tl-none'
                  }`}
                  onMouseLeave={() => { setShowOptionsId(null); setShowReactionsId(null); }}
                >
                  
                  {/* Reply Reference Preview */}
                  {msg.parent_message_details && (
                    <div className="bg-black/20 border-l-4 border-brand-secondary p-2 rounded-xl text-[11px] mb-2 flex flex-col">
                      <span className="font-semibold text-brand-secondary text-[10px]">
                        {msg.parent_message_details.sender === currentUser?.id ? 'You' : 'Reply'}
                      </span>
                      <span className="text-gray-300 truncate">{msg.parent_message_details.content}</span>
                    </div>
                  )}

                  {/* Sender Name for group chats */}
                  {headerInfo?.isGroup && !isMe && (
                    <span className="block text-[11px] font-bold text-brand-secondary mb-0.5">
                      {msg.sender_details?.nickname || msg.sender_details?.first_name || msg.sender_details?.username || 'Member'}
                    </span>
                  )}

                  {/* Message Content */}
                  <div className="text-sm break-words whitespace-pre-wrap pr-12">
                    {msg.is_deleted_for_everyone ? (
                      <span className="italic text-gray-400 text-xs">{msg.content}</span>
                    ) : msg.message_type === 'IMAGE' ? (
                      <div className="my-1 rounded-xl overflow-hidden border border-white/10">
                        <img src={msg.media_url} alt="Shared Attachment" className="max-h-60 w-full object-cover" />
                        {msg.content && msg.content !== 'Shared a Sticker' && msg.content !== 'Shared a GIF' && (
                          <p className="text-xs text-gray-300 mt-1.5 p-1">{msg.content}</p>
                        )}
                      </div>
                    ) : msg.message_type === 'DOCUMENT' ? (
                      <div className="my-1 p-2.5 rounded-xl bg-black/20 border border-white/5 flex items-center gap-2">
                        <FileText size={16} className="text-brand-secondary shrink-0" />
                        <a href={msg.media_url} target="_blank" rel="noreferrer" className="text-xs hover:underline text-brand-secondary truncate">
                          {msg.content}
                        </a>
                      </div>
                    ) : msg.message_type === 'AUDIO' ? (
                      <div className="my-1 py-1">
                        <audio controls src={msg.media_url} className="w-full max-w-[240px] rounded-lg" />
                        <p className="text-[10px] text-gray-400 mt-1">{msg.content}</p>
                      </div>
                    ) : (
                      highlightText(msg.content, searchQuery)
                    )}
                  </div>

                  {/* Reactions Badge */}
                  {msg.reactions && msg.reactions.length > 0 && (
                    <div className="absolute -bottom-2 right-3 bg-slate-800 border border-white/10 rounded-full px-2 py-0.5 text-[10px] flex items-center gap-0.5 shadow-lg">
                      {msg.reactions.map((r, i) => (
                        <span key={i} title={`Reacted by ${r.user}`}>{r.emoji}</span>
                      ))}
                    </div>
                  )}

                  {/* Message Footer Info */}
                  <div className="absolute bottom-1 right-2.5 flex items-center gap-1.5">
                    {msg.is_starred && <Star size={9} className="fill-yellow-400 text-yellow-400" />}
                    {msg.is_pinned && <Pin size={9} className="text-brand-secondary rotate-45" />}
                    <span className="text-[9px] text-gray-400">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {isMe && !msg.is_deleted_for_everyone && (
                      <>
                        {msg.is_seen ? (
                          <span className="text-[9px] text-brand-secondary font-bold" title="Read">✓✓</span>
                        ) : msg.is_delivered ? (
                          <span className="text-[9px] text-gray-400 font-bold" title="Delivered">✓✓</span>
                        ) : (
                          <span className="text-[9px] text-gray-400" title="Sent">✓</span>
                        )}
                      </>
                    )}
                  </div>

                  {/* Actions Dropdown triggers */}
                  {!msg.is_deleted_for_everyone && (
                    <div className="absolute top-1.5 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => setShowOptionsId(showOptions ? null : msg.id)}
                        className="text-gray-400 hover:text-white p-0.5"
                      >
                        <MoreVertical size={14} />
                      </button>

                      {/* Dropdown Options menu */}
                      {showOptions && (
                        <div className="absolute right-0 top-6 w-36 bg-[#1e293b] border border-white/10 rounded-xl shadow-2xl z-30 py-1 text-xs divide-y divide-white/5 glass-card">
                          <button 
                            onClick={() => { setReplyMessage(msg); setEditingMessage(null); setShowOptionsId(null); }}
                            className="w-full px-3 py-2 flex items-center gap-2 hover:bg-white/5 text-white text-left cursor-pointer"
                          >
                            <Reply size={11} /> Reply
                          </button>
                          <button 
                            onClick={() => { setMessageToForward(msg); setShowForwardModal(true); setShowOptionsId(null); }}
                            className="w-full px-3 py-2 flex items-center gap-2 hover:bg-white/5 text-white text-left cursor-pointer"
                          >
                            <Forward size={11} /> Forward
                          </button>
                          <button 
                            onClick={() => handleCopyMessage(msg.content)}
                            className="w-full px-3 py-2 flex items-center gap-2 hover:bg-white/5 text-white text-left cursor-pointer"
                          >
                            <Copy size={11} /> Copy Text
                          </button>
                          {isMe && msg.message_type === 'TEXT' && (
                            <button 
                              onClick={() => { setEditingMessage(msg); setReplyMessage(null); setInputText(msg.content); setShowOptionsId(null); }}
                              className="w-full px-3 py-2 flex items-center gap-2 hover:bg-white/5 text-white text-left cursor-pointer"
                            >
                              <Edit3 size={11} /> Edit Message
                            </button>
                          )}
                          <button 
                            onClick={() => { handleToggleStar(msg.id); setShowOptionsId(null); }}
                            className="w-full px-3 py-2 flex items-center gap-2 hover:bg-white/5 text-white text-left cursor-pointer"
                          >
                            <Star size={11} /> {msg.is_starred ? 'Unstar' : 'Star'}
                          </button>
                          <button 
                            onClick={() => { handleTogglePin(msg.id); setShowOptionsId(null); }}
                            className="w-full px-3 py-2 flex items-center gap-2 hover:bg-white/5 text-white text-left cursor-pointer"
                          >
                            <Pin size={11} /> {msg.is_pinned ? 'Unpin' : 'Pin'}
                          </button>
                          <button 
                            onClick={() => { setShowReactionsId(msg.id); setShowOptionsId(null); }}
                            className="w-full px-3 py-2 flex items-center gap-2 hover:bg-white/5 text-white text-left cursor-pointer"
                          >
                            <Smile size={11} /> React
                          </button>
                          <button 
                            onClick={() => { handleDeleteForMe(msg.id); setShowOptionsId(null); }}
                            className="w-full px-3 py-2 flex items-center gap-2 hover:bg-white/5 text-rose-400 text-left cursor-pointer"
                          >
                            <Trash2 size={11} /> Delete for Me
                          </button>
                          {isMe && (
                            <button 
                              onClick={() => { handleDeleteForEveryone(msg.id); setShowOptionsId(null); }}
                              className="w-full px-3 py-2 flex items-center gap-2 hover:bg-white/5 text-rose-400 text-left cursor-pointer"
                            >
                              <Trash2 size={11} /> Delete for All
                            </button>
                          )}
                        </div>
                      )}

                      {/* Reactions Palette */}
                      {showReactions && (
                        <div className="absolute right-0 top-6 bg-slate-800 border border-white/10 rounded-full py-1 px-2.5 flex gap-1.5 shadow-2xl z-40">
                          {['👍', '❤️', '😂', '😮', '😢', '🙏'].map((emoji) => (
                            <button 
                              key={emoji}
                              onClick={() => handleAddReaction(msg.id, emoji)}
                              className="hover:scale-125 transition-transform text-xs cursor-pointer"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}

                    </div>
                  )}

                </div>
              </div>
            )
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 3. Input Text Bar */}
      <div className="p-4 bg-slate-900/60 border-t border-white/5 flex flex-col shrink-0 backdrop-blur-md">
        
        {/* Reply Context Banner */}
        {replyMessage && (
          <div className="bg-white/5 border-l-4 border-brand-primary p-2.5 rounded-xl text-xs flex justify-between items-center mb-2.5 animate-fade-in">
            <div className="flex flex-col">
              <span className="font-semibold text-brand-primary text-[10px]">Replying to message</span>
              <span className="text-gray-300 truncate max-w-lg">{replyMessage.content}</span>
            </div>
            <button 
              onClick={() => setReplyMessage(null)}
              className="text-gray-400 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Edit Context Banner */}
        {editingMessage && (
          <div className="bg-white/5 border-l-4 border-brand-secondary p-2.5 rounded-xl text-xs flex justify-between items-center mb-2.5 animate-fade-in">
            <div className="flex flex-col">
              <span className="font-semibold text-brand-secondary text-[10px]">Editing message</span>
              <span className="text-gray-300 truncate max-w-lg">{editingMessage.content}</span>
            </div>
            <button 
              onClick={() => { setEditingMessage(null); setInputText(''); }}
              className="text-gray-400 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <form onSubmit={handleSendMessage} className="flex items-center gap-3 relative">
          
          {/* File Attachment Upload */}
          <div className="relative">
            <button 
              type="button"
              onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
              className="p-2 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl cursor-pointer transition-colors"
              title="Attach media"
              disabled={uploading}
            >
              <Paperclip size={18} className={uploading ? 'animate-spin' : ''} />
            </button>

            {/* Rich Attachment Popup */}
            {showAttachmentMenu && (
              <div className="absolute left-0 bottom-12 w-48 bg-[#1e293b] border border-white/10 rounded-2xl p-2 shadow-2xl z-30 glass-card space-y-1">
                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full px-3 py-2 text-xs text-white hover:bg-white/5 text-left flex items-center gap-2.5 rounded-xl"
                >
                  <Image size={14} className="text-brand-primary" /> Image / Video
                </button>
                <button 
                  type="button"
                  onClick={() => docInputRef.current?.click()}
                  className="w-full px-3 py-2 text-xs text-white hover:bg-white/5 text-left flex items-center gap-2.5 rounded-xl"
                >
                  <FileText size={14} className="text-brand-secondary" /> Document
                </button>
                <button 
                  type="button"
                  onClick={() => { setShowGifSelector(true); setShowAttachmentMenu(false); }}
                  className="w-full px-3 py-2 text-xs text-white hover:bg-white/5 text-left flex items-center gap-2.5 rounded-xl"
                >
                  <Gift size={14} className="text-brand-accent" /> Send GIF
                </button>
                <button 
                  type="button"
                  onClick={() => { setShowStickerSelector(true); setShowAttachmentMenu(false); }}
                  className="w-full px-3 py-2 text-xs text-white hover:bg-white/5 text-left flex items-center gap-2.5 rounded-xl"
                >
                  <SmileIcon size={14} className="text-yellow-400" /> Send Sticker
                </button>
                <button 
                  type="button"
                  onClick={() => { setShowVoiceRecorder(true); setShowAttachmentMenu(false); }}
                  className="w-full px-3 py-2 text-xs text-white hover:bg-white/5 text-left flex items-center gap-2.5 rounded-xl"
                >
                  <Mic size={14} className="text-red-400" /> Voice Note
                </button>
              </div>
            )}
          </div>

          <input 
            type="file"
            ref={fileInputRef}
            onChange={(e) => handleFileUpload(e, 'IMAGE')}
            className="hidden"
            accept="image/*,video/*"
          />
          <input 
            type="file"
            ref={docInputRef}
            onChange={(e) => handleFileUpload(e, 'DOCUMENT')}
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.zip"
          />

          {/* Text Input */}
          <input 
            type="text"
            value={inputText}
            onChange={handleInputChange}
            placeholder={editingMessage ? "Edit message..." : "Type a message..."}
            className="flex-1 bg-white/5 border border-white/5 focus:border-brand-primary/40 outline-none rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-400 transition-all focus:shadow-[0_0_12px_rgba(124,58,237,0.1)]"
          />

          {/* Send Action */}
          <button 
            type="submit"
            className="p-2.5 bg-gradient-to-r from-brand-primary to-brand-accent hover:opacity-95 text-white rounded-xl transition-all cursor-pointer shadow shadow-brand-primary/20"
          >
            <Send size={16} />
          </button>
        </form>
      </div>

      {/* 4. MODALS & DRAWERS OVERLAYS */}

      {/* A. Profile details modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#1e293b]/90 border border-white/10 rounded-3xl overflow-hidden shadow-2xl p-6 glass-card text-center relative animate-fade-in">
            <button 
              onClick={() => setShowProfileModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>
            <div className="flex flex-col items-center">
              {headerInfo.avatar ? (
                <img src={headerInfo.avatar} alt="Avatar" className="w-24 h-24 rounded-2xl object-cover border border-white/10 mb-4" />
              ) : (
                <div className="w-24 h-24 rounded-2xl bg-brand-primary/10 flex items-center justify-center text-brand-primary text-3xl font-bold mb-4">
                  {headerInfo.title.substring(0,2).toUpperCase()}
                </div>
              )}
              <h3 className="text-xl font-bold text-white font-display mb-1">{headerInfo.title}</h3>
              <span className="text-xs text-brand-secondary mb-4">{headerInfo.statusText}</span>
              
              <div className="w-full bg-[#0f172a]/50 rounded-2xl p-4 text-left space-y-3 mb-4">
                <div>
                  <label className="text-[10px] uppercase font-bold text-gray-400 block">Username</label>
                  <span className="text-sm text-white">@{headerInfo.otherUser?.username || 'group_chat'}</span>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-gray-400 block">Email</label>
                  <span className="text-sm text-white">{headerInfo.otherUser?.email || 'N/A'}</span>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-gray-400 block">Bio</label>
                  <span className="text-xs text-gray-300">{headerInfo.otherUser?.bio || 'Hey there! I am using Connecto.'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* B. Forward message modal */}
      {showForwardModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#1e293b]/90 border border-white/10 rounded-3xl overflow-hidden shadow-2xl p-5 glass-card flex flex-col max-h-[80vh] animate-fade-in">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-white font-display">Forward Message</h3>
              <button onClick={() => { setShowForwardModal(false); setMessageToForward(null); }} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-3 italic">"{(messageToForward?.content || '').substring(0, 60)}..."</p>
            <div className="flex-1 overflow-y-auto space-y-2">
              {chats.map(chat => {
                const details = chat.type === 'GROUP' 
                  ? { name: chat.group_details?.name || 'Group Chat', avatar: chat.group_details?.profile_picture }
                  : { 
                      name: chat.participants_details?.find(p => p.id !== currentUser?.id)?.nickname || chat.participants_details?.find(p => p.id !== currentUser?.id)?.username || 'Chat',
                      avatar: chat.participants_details?.find(p => p.id !== currentUser?.id)?.avatar_url
                    }
                return (
                  <div 
                    key={chat.id}
                    onClick={() => handleForwardMessage(chat.id)}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 cursor-pointer transition-all"
                  >
                    {details.avatar ? (
                      <img src={details.avatar} alt="Avatar" className="w-8 h-8 rounded-lg object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-brand-primary/10 flex items-center justify-center text-brand-primary text-xs font-bold">
                        {details.name.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <span className="text-sm text-white font-medium truncate">{details.name}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* C. GIF Selector Drawer */}
      {showGifSelector && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#1e293b]/90 border border-white/10 rounded-3xl overflow-hidden shadow-2xl p-5 glass-card flex flex-col animate-fade-in">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-white font-display">Select a GIF</h3>
              <button onClick={() => setShowGifSelector(false)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3ZtZHN5ZzA2d21tdjFmbDRxcm9pZnd5ZXZ4d2VldWZlNHl5ZmR6MyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/t3s340udVWzAM2ox3d/giphy.gif",
                "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMmdrZTF1ZWw5YnQ4N25hYTRzOTgyanQzb2k5ZHhiYnR1MWtqZTViMyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/XIqCQx02E1U9W/giphy.gif",
                "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExZHhhMHA3YTM5OWlzZGFiaG0wdjV4dG5ndW0zbDJyeDF5MTlybGRhYSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/unQ3IJU2rg76dec3IF/giphy.gif",
                "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExYnQ2ODg3Z2V0YmR4cWJ5ZHBrdnd0ZDVnaWZ2NGZ6cGwyYWRkNDN3dyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/l3q2zVr6cu95nF6O4/giphy.gif"
              ].map((gif, index) => (
                <div 
                  key={index}
                  onClick={() => sendGif(gif)}
                  className="rounded-xl overflow-hidden cursor-pointer border border-white/5 hover:border-brand-primary/45 hover:scale-[1.02] transition-all"
                >
                  <img src={gif} alt="gif" className="w-full h-28 object-cover" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* D. Sticker Selector Drawer */}
      {showStickerSelector && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#1e293b]/90 border border-white/10 rounded-3xl overflow-hidden shadow-2xl p-5 glass-card flex flex-col animate-fade-in">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-white font-display">Select a Sticker</h3>
              <button onClick={() => setShowStickerSelector(false)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                "https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExZ3BhNzYxNXQyNGlhc3UxaGpyamR4a2VreHBpeHBrOHRraG1lZ3UwayZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/X8y7G3sQz7R5Gv5hDq/giphy.gif",
                "https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExNzJrdDR0amxtamU3ejA0am5hd3AwcGpyZ3N5ZGNocnl2ZTh4NDF5eiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/jOzSg0aP6N426iUfsu/giphy.gif",
                "https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExOGIwdWFibmd2bnlyNDIxeTRkcmxmcG5qYmt0eGdxZW16OGoxczYweCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/ZCTZukVl0U4rO4wLdG/giphy.gif",
                "https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3hxdHBvdmptOHdma3FhM3l2aWNscHppcmQ1azhyZWh3dDZibjlnYyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/S99q00Wz9K7N8Oq1j4/giphy.gif"
              ].map((sticker, index) => (
                <div 
                  key={index}
                  onClick={() => sendSticker(sticker)}
                  className="rounded-xl overflow-hidden cursor-pointer border border-white/5 hover:border-brand-primary/45 hover:scale-[1.02] transition-all flex items-center justify-center p-2 bg-[#0F172A]"
                >
                  <img src={sticker} alt="sticker" className="w-20 h-20 object-contain" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* E. Voice Note Recorder Simulation Modal */}
      {showVoiceRecorder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#1e293b]/90 border border-white/10 rounded-3xl overflow-hidden shadow-2xl p-6 glass-card text-center animate-fade-in space-y-6">
            <h3 className="text-base font-bold text-white font-display">Voice Recorder</h3>
            <div className="flex flex-col items-center justify-center py-4 space-y-3">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-500 ${isRecording ? 'bg-red-500 animate-pulse-glow shadow-lg shadow-red-500/30' : 'bg-brand-primary'}`}>
                <Mic size={24} className="text-white" />
              </div>
              <span className="text-sm font-semibold text-white">
                {isRecording ? `Recording: ${recordDuration}s` : 'Ready to record'}
              </span>
            </div>
            <div className="flex justify-center gap-4">
              {!isRecording ? (
                <>
                  <button 
                    onClick={() => { setShowVoiceRecorder(false); }}
                    className="px-4 py-2 text-xs text-gray-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={startRecording}
                    className="px-5 py-2 bg-brand-primary text-white text-xs font-semibold rounded-xl"
                  >
                    Start
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={cancelRecording}
                    className="px-4 py-2 text-xs text-rose-400 hover:text-rose-300 font-semibold"
                  >
                    Discard
                  </button>
                  <button 
                    onClick={stopRecordingAndSend}
                    className="px-5 py-2 bg-brand-success text-white text-xs font-semibold rounded-xl shadow-md shadow-brand-success/20"
                  >
                    Stop & Send
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default ChatWindow
