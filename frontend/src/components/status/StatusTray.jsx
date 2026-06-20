import React, { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import api from '../../services/api'
import { Plus, RotateCw, X, Camera, Palette, Send, Eye } from 'lucide-react'
import StatusViewer from './StatusViewer'

function StatusTray() {
  const currentUser = useSelector((state) => state.auth.user)
  const [feed, setFeed] = useState([])
  const [myStatus, setMyStatus] = useState([])
  const [showCreator, setShowCreator] = useState(false)
  const [statusType, setStatusType] = useState('TEXT') // TEXT, IMAGE, VIDEO
  const [content, setContent] = useState('')
  const [mediaFile, setMediaFile] = useState(null)
  const [bgColor, setBgColor] = useState('#7c3aed') // Premium Violet Brand Color
  const [uploading, setUploading] = useState(false)
  const [viewingUserStatus, setViewingUserStatus] = useState(null)

  const bgColors = ['#7c3aed', '#06b6d4', '#ec4899', '#f43f5e', '#10b981', '#f59e0b', '#3b82f6', '#1e293b']

  const fetchStatusUpdates = async () => {
    try {
      const feedRes = await api.get('status/')
      // The backend returns a flat list of statuses. Let's group them by user on the frontend.
      const grouped = groupStatusesByUser(feedRes.data)
      setFeed(grouped.filter(g => g.user_details.id !== currentUser?.id))
      
      const myRes = await api.get('status/my_statuses/')
      setMyStatus(myRes.data)
    } catch (err) {
      console.error("Failed to load status updates", err)
    }
  }

  const groupStatusesByUser = (flatList) => {
    const groups = {}
    flatList.forEach(item => {
      const userId = item.user_details?.id
      if (!userId) return
      if (!groups[userId]) {
        groups[userId] = {
          user_details: item.user_details,
          stories: []
        }
      }
      groups[userId].stories.push(item)
    })
    return Object.values(groups)
  }

  useEffect(() => {
    fetchStatusUpdates()
  }, [])

  const handleMediaChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setMediaFile(e.target.files[0])
    }
  }

  const handleSubmitStatus = async (e) => {
    e.preventDefault()
    setUploading(true)
    const formData = new FormData()
    
    // Match exact backend expectations
    formData.append('media_type', statusType)
    formData.append('background_color', bgColor)
    
    if (statusType === 'TEXT') {
      formData.append('text_content', content)
    } else {
      formData.append('text_content', content) // Caption
      if (mediaFile) {
        formData.append('media_file', mediaFile)
      }
    }

    try {
      await api.post('status/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      fetchStatusUpdates()
      setShowCreator(false)
      setContent('')
      setMediaFile(null)
    } catch (err) {
      console.error("Failed to post status update", err)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#0b1329]/20">
      
      {/* Header */}
      <div className="p-5 flex justify-between items-center bg-slate-900/60 border-b border-white/5 backdrop-blur-md shrink-0">
        <h2 className="text-lg font-bold text-white font-display flex items-center gap-2">
          Status Updates
        </h2>
        <button 
          onClick={() => setShowCreator(true)}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-brand-primary to-brand-accent text-white hover:opacity-95 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold shadow-md shadow-brand-primary/20"
          title="New Status"
        >
          <Plus size={15} /> Update
        </button>
      </div>

      {/* List content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        
        {/* Own Status display */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-brand-secondary uppercase tracking-wider">My Status</h3>
          {myStatus.length === 0 ? (
            <div 
              onClick={() => setShowCreator(true)}
              className="flex items-center gap-4 p-3 hover:bg-white/5 border border-white/5 rounded-2xl cursor-pointer transition-all"
            >
              <div className="w-12 h-12 rounded-xl border border-dashed border-gray-500 flex items-center justify-center text-gray-400">
                <Plus size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Add to my status</h4>
                <p className="text-xs text-gray-400">Share a photo or text message</p>
              </div>
            </div>
          ) : (
            <div 
              onClick={() => setViewingUserStatus(myStatus)}
              className="flex items-center gap-4 p-3 hover:bg-white/5 border border-white/5 rounded-2xl cursor-pointer transition-all"
            >
              <div className="relative shrink-0 w-12 h-12 rounded-xl overflow-hidden border-2 border-brand-primary p-0.5">
                {myStatus[0].media_type === 'IMAGE' || myStatus[0].media_type === 'VIDEO' ? (
                  <img src={myStatus[0].media_file} alt="My Story" className="w-full h-full object-cover rounded-lg" />
                ) : (
                  <div style={{ backgroundColor: myStatus[0].background_color }} className="w-full h-full rounded-lg flex items-center justify-center text-[8px] text-white font-bold truncate p-1">
                    {myStatus[0].text_content}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-white">My Status</h4>
                <p className="text-xs text-gray-400">{myStatus.length} update{myStatus.length > 1 ? 's' : ''} posted</p>
              </div>
              <span className="text-xs text-gray-400 flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-lg">
                <Eye size={12} className="text-brand-secondary" /> {myStatus[0].view_count || 0}
              </span>
            </div>
          )}
        </div>

        {/* Contacts Status display */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Recent updates</h3>
          {feed.length === 0 ? (
            <p className="text-xs text-gray-500 italic p-2">No updates from your contacts in the last 24 hours.</p>
          ) : (
            <div className="grid gap-3">
              {feed.map((userStory, index) => {
                const userObj = userStory.user_details
                const stories = userStory.stories
                const latest = stories[0]

                return (
                  <div 
                    key={index}
                    onClick={() => setViewingUserStatus(stories)}
                    className="flex items-center gap-4 p-3 hover:bg-white/5 border border-white/5 rounded-2xl cursor-pointer transition-all"
                  >
                    <div className="relative shrink-0 w-12 h-12 rounded-xl overflow-hidden border-2 border-brand-secondary p-0.5">
                      {latest.media_type === 'IMAGE' || latest.media_type === 'VIDEO' ? (
                        <img src={latest.media_file} alt="Story" className="w-full h-full object-cover rounded-lg" />
                      ) : (
                        <div style={{ backgroundColor: latest.background_color }} className="w-full h-full rounded-lg flex items-center justify-center text-[8px] text-white font-semibold truncate p-1">
                          {latest.text_content}
                        </div>
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">
                        {userObj.first_name || userObj.username} {userObj.last_name || ''}
                      </h4>
                      <p className="text-xs text-gray-400">
                        {new Date(latest.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>

      {/* 3. Status Creator Modal */}
      {showCreator && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form 
            onSubmit={handleSubmitStatus}
            className="w-full max-w-md bg-[#1e293b]/90 border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col glass-card animate-fade-in"
          >
            <div className="p-4 border-b border-white/5 flex justify-between items-center">
              <h3 className="text-base font-bold text-white font-display">Create Status Update</h3>
              <button 
                type="button" 
                onClick={() => setShowCreator(false)}
                className="text-gray-400 hover:text-white p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-5">
              
              {/* Type Switcher */}
              <div className="flex bg-[#0f172a]/60 p-1 rounded-xl border border-white/5">
                <button
                  type="button"
                  onClick={() => { setStatusType('TEXT'); setContent(''); }}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${statusType === 'TEXT' ? 'bg-gradient-to-r from-brand-primary to-brand-accent text-white shadow-md' : 'text-gray-400'}`}
                >
                  <Palette size={13} className="inline mr-1" /> Text Status
                </button>
                <button
                  type="button"
                  onClick={() => { setStatusType('IMAGE'); setContent(''); }}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${statusType === 'IMAGE' ? 'bg-gradient-to-r from-brand-primary to-brand-accent text-white shadow-md' : 'text-gray-400'}`}
                >
                  <Camera size={13} className="inline mr-1" /> Image Status
                </button>
              </div>

              {/* Text-based Editor */}
              {statusType === 'TEXT' ? (
                <div className="space-y-4">
                  <div 
                    style={{ backgroundColor: bgColor }} 
                    className="h-44 rounded-2xl flex items-center justify-center p-5 relative transition-colors shadow-inner"
                  >
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="Type a status update..."
                      maxLength={200}
                      rows={4}
                      className="bg-transparent border-none outline-none text-center text-white text-lg font-bold w-full placeholder-white/40 resize-none font-display"
                      required
                    />
                  </div>
                  
                  {/* Color Palette selectors */}
                  <div className="flex gap-2 justify-center flex-wrap">
                    {bgColors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setBgColor(color)}
                        style={{ backgroundColor: color }}
                        className={`w-6 h-6 rounded-full border-2 cursor-pointer transition-transform ${bgColor === color ? 'border-white scale-110 shadow-md shadow-black/20' : 'border-transparent'}`}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                // Image-based Editor
                <div className="space-y-4">
                  <div className="h-44 bg-[#0f172a]/60 border border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center p-4 relative overflow-hidden group cursor-pointer hover:border-brand-primary/40 transition-colors">
                    {mediaFile ? (
                      <img src={URL.createObjectURL(mediaFile)} alt="Upload Preview" className="w-full h-full object-cover rounded-xl" />
                    ) : (
                      <>
                        <Camera size={30} className="text-gray-400 mb-2" />
                        <span className="text-xs text-gray-400">Click to choose image</span>
                      </>
                    )}
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={handleMediaChange}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Image Caption</label>
                    <input 
                      type="text"
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="Add a caption..."
                      className="w-full bg-[#0f172a]/60 border border-white/5 focus:border-brand-primary/45 rounded-xl px-4 py-2 text-sm text-white outline-none placeholder-gray-500"
                    />
                  </div>
                </div>
              )}

            </div>

            <div className="p-4 border-t border-white/5 flex justify-end gap-3 bg-[#0f172a]/30">
              <button
                type="button"
                onClick={() => setShowCreator(false)}
                className="px-4 py-2 text-xs text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={uploading}
                className="bg-gradient-to-r from-brand-primary to-brand-accent hover:opacity-95 text-white font-semibold rounded-xl px-5 py-2 text-xs cursor-pointer transition-all flex items-center gap-1.5 shadow-md shadow-brand-primary/20"
              >
                <Send size={12} /> {uploading ? 'Posting...' : 'Share Update'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 4. Full screen status viewer overlay */}
      {viewingUserStatus && (
        <StatusViewer 
          stories={viewingUserStatus} 
          onClose={() => { setViewingUserStatus(null); fetchStatusUpdates(); }} 
        />
      )}

    </div>
  )
}

export default StatusTray
