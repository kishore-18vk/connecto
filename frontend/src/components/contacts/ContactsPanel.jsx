import React, { useState, useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { setActiveChatId, addChat } from '../../redux/chatSlice'
import api from '../../services/api'
import { User, Search, UserPlus, MessageSquare, Star, Trash2, ShieldAlert } from 'lucide-react'

function ContactsPanel({ onStartChat }) {
  const [contacts, setContacts] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const dispatch = useDispatch()

  const fetchContacts = async () => {
    try {
      const res = await api.get('contacts/')
      setContacts(res.data)
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    fetchContacts()
  }, [])

  // Execute global user directory search
  const handleDirectorySearch = async (e) => {
    const val = e.target.value
    setSearchQuery(val)
    if (val.trim().length > 1) {
      setSearching(true)
      try {
        const res = await api.get(`accounts/search/?q=${val}`)
        setSearchResults(res.data)
      } catch (err) {
        console.error(err)
      } finally {
        setSearching(false)
      }
    } else {
      setSearchResults([])
    }
  }

  const handleAddContact = async (user) => {
    try {
      await api.post('contacts/', { contact: user.id })
      await fetchContacts()
      setSearchQuery('')
      setSearchResults([])
      await handleInitiateChat(user)
    } catch (err) {
      console.error(err)
    }
  }

  const handleToggleFavorite = async (contactId) => {
    try {
      await api.post(`contacts/${contactId}/toggle_favorite/`)
      fetchContacts()
    } catch (err) {
      console.error(err)
    }
  }

  const handleRemoveContact = async (contactId) => {
    try {
      await api.delete(`contacts/${contactId}/`)
      fetchContacts()
    } catch (err) {
      console.error(err)
    }
  }

  const handleInitiateChat = async (otherUser) => {
    try {
      // Find if we already have a DM chat with this user
      const res = await api.post('chats/', {
        type: 'DM',
        participants: [otherUser.id]
      })
      dispatch(addChat(res.data))
      dispatch(setActiveChatId(res.data.id))
      if (onStartChat) onStartChat()
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#111b21]">
      {/* Header */}
      <div className="p-4 bg-[#111b21] border-b border-wa-border">
        <h2 className="text-xl font-bold text-white">Contacts</h2>
      </div>

      {/* Directory Search */}
      <div className="p-3 bg-[#111b21] border-b border-wa-border space-y-2">
        <label className="text-xs text-wa-gray font-bold uppercase tracking-wider block">Find Users globally</label>
        <div className="flex items-center gap-2 bg-[#202c33] rounded-lg px-3 py-1.5 border border-transparent focus-within:border-wa-green/30">
          <Search size={18} className="text-wa-gray" />
          <input 
            type="text" 
            placeholder="Search email or username" 
            value={searchQuery}
            onChange={handleDirectorySearch}
            className="bg-transparent text-sm w-full outline-none text-white placeholder-wa-gray"
          />
        </div>
      </div>

      {/* Scrollable contacts display list */}
      <div className="flex-1 overflow-y-auto divide-y divide-wa-border">
        
        {/* Directory Search Results */}
        {searchQuery.trim().length > 1 && (
          <div className="bg-wa-darker pb-2">
            <h3 className="text-xs font-bold text-wa-green uppercase p-3 tracking-wider bg-wa-dark/30">Global Search Results</h3>
            {searching ? (
              <p className="text-xs text-wa-gray p-4 italic">Searching directory...</p>
            ) : searchResults.length === 0 ? (
              <p className="text-xs text-wa-gray p-4 italic">No users found</p>
            ) : (
              searchResults.map((user) => {
                const isAlreadyContact = contacts.some(c => c.contact_details.id === user.id)
                return (
                  <div key={user.id} className="flex items-center justify-between px-4 py-3 hover:bg-wa-active/20 select-none">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-wa-active overflow-hidden flex items-center justify-center shrink-0">
                        {user.avatar_url || user.profile?.profile_picture ? (
                          <img src={user.avatar_url || user.profile?.profile_picture} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          <User size={16} className="text-wa-gray" />
                        )}
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-white">{user.nickname || user.first_name || user.username}</h4>
                        <span className="text-xs text-wa-gray">{user.email || `@${user.username}`}</span>
                      </div>
                    </div>

                    {isAlreadyContact ? (
                      <button 
                        onClick={() => handleInitiateChat(user)}
                        className="p-2 bg-wa-active hover:bg-wa-green text-white hover:text-wa-dark rounded-lg cursor-pointer transition-all"
                        title="Chat now"
                      >
                        <MessageSquare size={16} />
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleAddContact(user)}
                        className="p-2 bg-wa-green hover:bg-wa-green/90 text-wa-dark font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1 text-xs"
                        title="Add to contacts"
                      >
                        <UserPlus size={14} /> Add
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* Saved Contacts List */}
        <div className="py-2">
          <h3 className="text-xs font-bold text-wa-gray uppercase p-3 tracking-wider">My Contacts ({contacts.length})</h3>
          {contacts.length === 0 ? (
            <p className="text-xs text-wa-gray italic p-4">No contacts added yet. Search above to find friends!</p>
          ) : (
            contacts.map((c) => {
              const userObj = c.contact_details
              return (
                <div key={c.id} className="flex items-center justify-between px-4 py-3 hover:bg-wa-active/20 transition-all select-none">
                  <div 
                    onClick={() => handleInitiateChat(userObj)}
                    className="flex items-center gap-3 cursor-pointer min-w-0 flex-1"
                  >
                    <div className="w-10 h-10 rounded-full bg-wa-active overflow-hidden flex items-center justify-center shrink-0">
                      {userObj.avatar_url || userObj.profile?.profile_picture ? (
                        <img src={userObj.avatar_url || userObj.profile?.profile_picture} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <User size={16} className="text-wa-gray" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-white truncate">
                        {userObj.nickname || `${userObj.first_name} ${userObj.last_name || ''}`.trim() || userObj.username}
                      </h4>
                      <p className="text-xs text-wa-gray truncate">{userObj.profile?.bio || 'Hey there! I am using Connecto.'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Favorite star */}
                    <button 
                      onClick={() => handleToggleFavorite(c.id)}
                      className="p-1.5 rounded hover:bg-wa-active text-wa-gray transition-colors cursor-pointer"
                      title={c.is_favorite ? "Unfavorite" : "Favorite"}
                    >
                      <Star size={16} className={c.is_favorite ? 'fill-yellow-400 text-yellow-400' : ''} />
                    </button>
                    {/* Delete */}
                    <button 
                      onClick={() => handleRemoveContact(c.id)}
                      className="p-1.5 rounded hover:bg-wa-active text-red-400 transition-colors cursor-pointer"
                      title="Remove contact"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

      </div>
    </div>
  )
}

export default ContactsPanel
