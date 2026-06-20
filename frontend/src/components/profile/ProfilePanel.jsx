import React, { useState, useRef } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { updateProfile } from '../../redux/authSlice'
import api from '../../services/api'
import { Camera, User, Edit3, Check, X } from 'lucide-react'

function ProfilePanel() {
  const currentUser = useSelector((state) => state.auth.user)
  const dispatch = useDispatch()

  const [firstName, setFirstName] = useState(currentUser?.first_name || '')
  const [lastName, setLastName] = useState(currentUser?.last_name || '')
  const [nickname, setNickname] = useState(currentUser?.nickname || '')
  const [bio, setBio] = useState(currentUser?.profile?.bio || 'Hey there! I am using Connecto.')
  const [privacyEmail, setPrivacyEmail] = useState(currentUser?.profile?.privacy_email || 'PRIVATE')
  const [updating, setUpdating] = useState(false)
  const [success, setSuccess] = useState(false)

  const [isEditingName, setIsEditingName] = useState(false)
  const [isEditingNickname, setIsEditingNickname] = useState(false)
  const [isEditingBio, setIsEditingBio] = useState(false)

  const fileInputRef = useRef(null)

  const handleAvatarUpload = async (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      const formData = new FormData()
      formData.append('profile_picture', file)
      setUpdating(true)

      try {
        const res = await api.put('accounts/profile/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        dispatch(updateProfile({
          avatar_url: res.data.profile_picture,
          profile: res.data
        }))
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
      } catch (err) {
        console.error(err)
      } finally {
        setUpdating(false)
      }
    }
  }

  const handleSaveProfileData = async () => {
    setUpdating(true)
    try {
      const res = await api.put('accounts/profile/', {
        bio,
        nickname,
        privacy_email: privacyEmail,
        user: {
          first_name: firstName,
          last_name: lastName
        }
      })
      dispatch(updateProfile({
        first_name: firstName,
        last_name: lastName,
        nickname: nickname,
        profile: res.data
      }))
      setIsEditingName(false)
      setIsEditingNickname(false)
      setIsEditingBio(false)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      console.error(err)
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#111b21]">
      {/* Header */}
      <div className="p-4 bg-[#111b21] border-b border-wa-border">
        <h2 className="text-xl font-bold text-white">Profile</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        
        {/* Profile Avatar Upload block */}
        <div className="flex flex-col items-center">
          <div className="relative group cursor-pointer w-32 h-32 rounded-full bg-wa-active border border-wa-border flex items-center justify-center text-wa-gray overflow-hidden">
            {currentUser?.avatar_url || currentUser?.profile?.profile_picture ? (
              <img 
                src={currentUser?.profile?.profile_picture || currentUser?.avatar_url} 
                alt="Profile Preview" 
                className="w-full h-full object-cover" 
              />
            ) : (
              <User size={48} />
            )}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera size={24} className="text-white" />
            </div>
            <input 
              type="file" 
              ref={fileInputRef}
              accept="image/*"
              onChange={handleAvatarUpload}
              className="absolute inset-0 opacity-0 cursor-pointer"
              disabled={updating}
            />
          </div>
          {updating && <span className="text-xs text-wa-green mt-2 animate-pulse">Uploading Image...</span>}
          {success && <span className="text-xs text-wa-green mt-2">Profile updated successfully!</span>}
        </div>

        {/* Edit Fields */}
        <div className="space-y-6 text-sm">
          
          {/* User Email (Immutable Info) */}
          <div className="bg-wa-darker/30 p-3 rounded-lg border border-wa-border/50">
            <span className="text-xs text-wa-gray block uppercase font-semibold mb-0.5">Google Email</span>
            <span className="text-white select-all">{currentUser?.email}</span>
            
            {/* Email Privacy Setting */}
            <div className="mt-3 pt-3 border-t border-wa-border/30 flex items-center justify-between">
              <span className="text-xs text-wa-gray font-semibold">Email Visibility</span>
              <select
                value={privacyEmail}
                onChange={(e) => {
                  const val = e.target.value;
                  setPrivacyEmail(val);
                  api.put('accounts/profile/', { privacy_email: val })
                    .then((res) => {
                      dispatch(updateProfile({ profile: res.data }));
                    })
                    .catch((err) => console.error(err));
                }}
                className="bg-wa-dark border border-wa-border rounded px-2 py-1 text-xs text-white outline-none focus:border-wa-green"
              >
                <option value="PRIVATE">Private (Nobody)</option>
                <option value="FRIENDS">Friends Only (Contacts)</option>
                <option value="PUBLIC">Public (Everyone)</option>
              </select>
            </div>
          </div>

          {/* Nickname (WhatsApp-style choice name) */}
          <div className="bg-wa-darker/30 p-3 rounded-lg border border-wa-border/50">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-wa-gray uppercase font-semibold">Nickname</span>
              {!isEditingNickname ? (
                <button onClick={() => setIsEditingNickname(true)} className="text-wa-green hover:underline cursor-pointer">
                  <Edit3 size={14} />
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={handleSaveProfileData} className="text-wa-green hover:underline cursor-pointer">
                    <Check size={14} />
                  </button>
                  <button onClick={() => setIsEditingNickname(false)} className="text-red-400 hover:underline cursor-pointer">
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
            {!isEditingNickname ? (
              <span className="text-white font-medium">{nickname || 'No Nickname chosen'}</span>
            ) : (
              <input 
                type="text" 
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Choose nickname"
                className="w-full mt-2 bg-wa-dark border border-wa-border rounded px-3 py-1 text-xs text-white outline-none focus:border-wa-green"
              />
            )}
          </div>

          {/* First Name & Last Name */}
          <div className="bg-wa-darker/30 p-3 rounded-lg border border-wa-border/50">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-wa-gray uppercase font-semibold">Your Name</span>
              {!isEditingName ? (
                <button onClick={() => setIsEditingName(true)} className="text-wa-green hover:underline cursor-pointer">
                  <Edit3 size={14} />
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={handleSaveProfileData} className="text-wa-green hover:underline cursor-pointer">
                    <Check size={14} />
                  </button>
                  <button onClick={() => setIsEditingName(false)} className="text-red-400 hover:underline cursor-pointer">
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
            {!isEditingName ? (
              <span className="text-white font-medium">{firstName} {lastName}</span>
            ) : (
              <div className="flex gap-2 mt-2">
                <input 
                  type="text" 
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  className="w-1/2 bg-wa-dark border border-wa-border rounded px-3 py-1 text-xs text-white outline-none focus:border-wa-green"
                />
                <input 
                  type="text" 
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                  className="w-1/2 bg-wa-dark border border-wa-border rounded px-3 py-1 text-xs text-white outline-none focus:border-wa-green"
                />
              </div>
            )}
          </div>

          {/* Bio tagline */}
          <div className="bg-wa-darker/30 p-3 rounded-lg border border-wa-border/50">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-wa-gray uppercase font-semibold">About / Bio</span>
              {!isEditingBio ? (
                <button onClick={() => setIsEditingBio(true)} className="text-wa-green hover:underline cursor-pointer">
                  <Edit3 size={14} />
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={handleSaveProfileData} className="text-wa-green hover:underline cursor-pointer">
                    <Check size={14} />
                  </button>
                  <button onClick={() => setIsEditingBio(false)} className="text-red-400 hover:underline cursor-pointer">
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
            {!isEditingBio ? (
              <p className="text-white">{bio}</p>
            ) : (
              <textarea 
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Write something about yourself"
                rows={2}
                className="w-full mt-2 bg-wa-dark border border-wa-border rounded px-3 py-2 text-xs text-white outline-none resize-none focus:border-wa-green"
              />
            )}
          </div>

        </div>

      </div>
    </div>
  )
}

export default ProfilePanel
