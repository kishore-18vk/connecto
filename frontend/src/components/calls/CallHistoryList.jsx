import React, { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { startCall } from '../../redux/callSlice'
import api from '../../services/api'
import { Phone, Video, PhoneCall, PhoneMissed, PhoneIncoming, PhoneOutgoing, User } from 'lucide-react'

function CallHistoryList() {
  const [logs, setLogs] = useState([])
  const currentUser = useSelector((state) => state.auth.user)
  const dispatch = useDispatch()

  const fetchCallLogs = async () => {
    try {
      const res = await api.get('calls/')
      setLogs(res.data)
    } catch (err) {
      console.error("Failed to load call logs:", err)
    }
  }

  useEffect(() => {
    fetchCallLogs()
  }, [])

  const handleRedial = (log) => {
    const otherUser = log.caller === currentUser?.id ? log.receiver_details : log.caller_details
    if (otherUser) {
      dispatch(startCall({ receiver: otherUser, callType: log.type }))
    }
  }

  const formatDuration = (seconds) => {
    if (!seconds) return '0s'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
  }

  const getCallDirectionDetails = (log) => {
    const isOutgoing = log.caller === currentUser?.id
    if (log.status === 'MISSED' || log.status === 'REJECTED') {
      return {
        icon: <PhoneMissed size={14} className="text-rose-500" />,
        text: isOutgoing ? 'Missed Dial' : 'Missed Call',
        colorClass: 'text-rose-500'
      }
    }
    return {
      icon: isOutgoing ? <PhoneOutgoing size={14} className="text-brand-secondary" /> : <PhoneIncoming size={14} className="text-brand-secondary" />,
      text: isOutgoing ? 'Outgoing' : 'Incoming',
      colorClass: 'text-gray-400'
    }
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#0b1329]/20">
      
      {/* Header */}
      <div className="p-5 bg-slate-900/60 border-b border-white/5 backdrop-blur-md shrink-0">
        <h2 className="text-lg font-bold text-white font-display">Call History</h2>
      </div>

      {/* Logs Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {logs.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-500 italic">
            No call records found.
          </div>
        ) : (
          logs.map((log) => {
            const isOutgoing = log.caller === currentUser?.id
            const contact = isOutgoing ? log.receiver_details : log.caller_details
            const dir = getCallDirectionDetails(log)

            if (!contact) return null

            const avatar = contact.profile?.profile_picture || contact.avatar_url

            return (
              <div 
                key={log.id}
                className="flex items-center justify-between p-3 border border-white/5 rounded-2xl hover:bg-white/5 transition-all select-none"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  {/* Contact Avatar */}
                  <div className="w-11 h-11 rounded-xl bg-brand-primary/10 overflow-hidden flex items-center justify-center shrink-0 border border-white/5">
                    {avatar ? (
                      <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-brand-primary text-sm font-bold">{(contact.first_name || contact.username || '?')[0].toUpperCase()}</span>
                    )}
                  </div>

                  {/* Name and Direction */}
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-white truncate font-display">
                      {contact.first_name || contact.username} {contact.last_name || ''}
                    </h4>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {dir.icon}
                      <span className={`text-[11px] ${dir.colorClass}`}>
                        {dir.text} • {new Date(log.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Redial & Duration */}
                <div className="flex items-center gap-3.5 shrink-0">
                  {log.status === 'COMPLETED' && (
                    <span className="text-[10px] text-gray-400 bg-white/5 px-2 py-0.5 rounded-lg border border-white/5">{formatDuration(log.duration)}</span>
                  )}
                  <button 
                    onClick={() => handleRedial(log)}
                    className="p-2.5 rounded-xl bg-[#0f172a]/60 text-brand-secondary hover:text-white border border-white/5 hover:border-brand-secondary/40 hover:scale-105 transition-all cursor-pointer shadow-sm"
                    title="Call again"
                  >
                    {log.type === 'VIDEO' ? <Video size={14} /> : <Phone size={14} />}
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export default CallHistoryList
