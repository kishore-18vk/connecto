import React, { useState, useEffect, useRef } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { acceptCall, endCall } from '../../redux/callSlice'
import wsService from '../../services/websocket'
import api from '../../services/api'
import { Phone, PhoneOff, Video, Mic, MicOff, VideoOff, Volume2, User, Play } from 'lucide-react'

function CallOverlay() {
  const dispatch = useDispatch()
  const { callState, caller, receiver, callType, incomingSignal } = useSelector((state) => state.call)
  const currentUser = useSelector((state) => state.auth.user)

  const [localStream, setLocalStream] = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)
  const [micMuted, setMicMuted] = useState(false)
  const [cameraOff, setCameraOff] = useState(false)

  // Simulation timer for active call length
  const [callDuration, setCallDuration] = useState(0)

  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const peerConnectionRef = useRef(null)
  const durationIntervalRef = useRef(null)

  const isCaller = caller?.id === currentUser?.id
  const targetUser = isCaller ? receiver : caller

  const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  }

  // Timer duration logic
  useEffect(() => {
    if (callState === 'CONNECTED') {
      setCallDuration(0)
      durationIntervalRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1)
      }, 1000)
    } else {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current)
      }
    }
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current)
      }
    }
  }, [callState])

  useEffect(() => {
    if (callState === 'CONNECTED' || callState === 'DIALING') {
      navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === 'VIDEO'
      }).then((stream) => {
        setLocalStream(stream)
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream
        }
        
        if (callState === 'CONNECTED') {
          initializePeerConnection(stream)
        }
      }).catch((err) => {
        console.warn("Media devices access denied/unavailable in environment. Proceeding with simulated call.", err)
      })
    }

    const signalListener = (data) => {
      const { type, signal, sender_id } = data
      if (type === 'call_signal' && sender_id === targetUser?.id) {
        handleIncomingSignal(signal)
      }
    }
    wsService.addEventListener(signalListener)

    return () => {
      wsService.removeEventListener(signalListener)
      stopStreams()
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close()
      }
    }
  }, [callState])

  useEffect(() => {
    if (callState === 'CONNECTED' && localStream && !peerConnectionRef.current) {
      initializePeerConnection(localStream)
    }
  }, [callState, localStream])

  const stopStreams = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop())
    }
    setLocalStream(null)
    setRemoteStream(null)
  }

  const initializePeerConnection = (stream) => {
    const pc = new RTCPeerConnection(configuration)
    peerConnectionRef.current = pc

    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream)
    })

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0])
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0]
      }
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        wsService.sendCallSignal(targetUser.id, {
          candidate: event.candidate
        }, callType)
      }
    }

    if (isCaller) {
      pc.createOffer().then((offer) => {
        return pc.setLocalDescription(offer)
      }).then(() => {
        wsService.sendCallSignal(targetUser.id, pc.localDescription, callType)
      }).catch(err => console.error(err))
    } else if (incomingSignal) {
      pc.setRemoteDescription(new RTCSessionDescription(incomingSignal))
        .then(() => pc.createAnswer())
        .then((answer) => pc.setLocalDescription(answer))
        .then(() => {
          wsService.sendCallSignal(targetUser.id, pc.localDescription, callType)
        }).catch(err => console.error(err))
    }
  }

  const handleIncomingSignal = async (signal) => {
    const pc = peerConnectionRef.current
    if (!pc) return

    try {
      if (signal.type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal))
      } else if (signal.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate))
      }
    } catch (err) {
      console.error("Error processing signaling candidate/SDP", err)
    }
  }

  const handleAccept = () => {
    dispatch(acceptCall())
    api.post('calls/', {
      receiver: currentUser?.id,
      caller: targetUser?.id,
      type: callType,
      status: 'COMPLETED',
      duration: 0
    }).catch(() => {})
  }

  const handleDecline = () => {
    wsService.sendCallSignal(targetUser.id, { type: 'reject' }, callType)
    recordCallLog('REJECTED')
    dispatch(endCall())
  }

  const handleHangup = () => {
    wsService.sendCallSignal(targetUser.id, { type: 'hangup' }, callType)
    recordCallLog('COMPLETED')
    dispatch(endCall())
  }

  const recordCallLog = (status) => {
    api.post('calls/', {
      receiver: targetUser.id,
      type: callType,
      status: status,
      duration: callDuration || 12
    }).catch(() => {})
  }

  const toggleMic = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setMicMuted(!audioTrack.enabled)
      }
    } else {
      setMicMuted(!micMuted)
    }
  }

  const toggleCamera = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        setCameraOff(!videoTrack.enabled)
      }
    } else {
      setCameraOff(!cameraOff)
    }
  }

  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0')
    const s = (secs % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  const avatar = targetUser?.profile?.profile_picture || targetUser?.avatar_url

  return (
    <div className="fixed inset-0 z-50 bg-[#020617]/95 backdrop-blur-xl flex flex-col items-center justify-between p-8 text-white select-none">
      
      {/* 1. Header (Call Type and User Info) */}
      <div className="text-center mt-12 space-y-4">
        {callState !== 'CONNECTED' && (
          <div className="w-24 h-24 rounded-2xl bg-brand-primary/10 overflow-hidden mx-auto flex items-center justify-center border border-white/10 relative calling-pulse shadow-lg">
            {avatar ? (
              <img src={avatar} alt="Target Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-brand-primary text-3xl font-bold">{(targetUser?.first_name || targetUser?.username || '?')[0].toUpperCase()}</span>
            )}
          </div>
        )}
        <div>
          <h2 className="text-2xl font-bold font-display">{targetUser?.first_name || targetUser?.username} {targetUser?.last_name || ''}</h2>
          <p className="text-xs text-gray-400 mt-2 tracking-wider uppercase font-semibold">
            {callState === 'DIALING' && 'Dialing Call...'}
            {callState === 'RINGING' && `Incoming ${callType.toLowerCase()} Call`}
            {callState === 'CONNECTED' && `Connected • ${formatTimer(callDuration)}`}
          </p>
        </div>
      </div>

      {/* 2. Video Streams pane (Only visible if type is VIDEO and CONNECTED) */}
      {callType === 'VIDEO' && callState === 'CONNECTED' && (
        <div className="flex-1 w-full max-w-2xl aspect-video bg-[#0f172a] rounded-3xl overflow-hidden border border-white/5 relative my-8 shadow-2xl">
          {/* Remote Video Stream */}
          {!cameraOff && remoteStream ? (
            <video 
              ref={remoteVideoRef} 
              autoPlay 
              playsInline 
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-tr from-slate-900 to-slate-800 relative">
              <div className="w-20 h-20 rounded-2xl bg-brand-secondary/15 flex items-center justify-center border border-brand-secondary/30 mb-3 animate-pulse">
                {avatar ? (
                  <img src={avatar} alt="Remote" className="w-full h-full object-cover rounded-xl" />
                ) : (
                  <span className="text-brand-secondary text-2xl font-bold">{(targetUser?.first_name || targetUser?.username || '?')[0].toUpperCase()}</span>
                )}
              </div>
              <span className="text-xs text-gray-400 font-medium">Camera feed from peer...</span>
            </div>
          )}
          
          {/* Local Video Stream (floating inset card) */}
          <div className="absolute top-4 right-4 w-36 aspect-video bg-[#020617] rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
            {!cameraOff && localStream ? (
              <video 
                ref={localVideoRef} 
                autoPlay 
                playsInline 
                muted 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-slate-950">
                <VideoOff size={16} className="text-gray-500 animate-pulse" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Audio Wave Simulation (Only visible if type is VOICE and CONNECTED) */}
      {callType === 'VOICE' && callState === 'CONNECTED' && (
        <div className="flex-1 flex flex-col items-center justify-center space-y-6">
          <div className="relative flex items-center justify-center">
            {/* Pulsing ring visual */}
            <div className="absolute inset-0 bg-brand-primary/10 rounded-full animate-call-ring"></div>
            <div className="w-28 h-28 rounded-3xl bg-brand-primary/15 flex items-center justify-center border border-brand-primary/30 relative z-10 shadow-xl">
              {avatar ? (
                <img src={avatar} alt="Avatar" className="w-full h-full object-cover rounded-2xl" />
              ) : (
                <span className="text-brand-primary text-3xl font-bold">{(targetUser?.first_name || targetUser?.username || '?')[0].toUpperCase()}</span>
              )}
            </div>
          </div>
          
          {/* Waveform lines */}
          <div className="flex gap-1 items-center justify-center h-8">
            {[1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1].map((h, i) => (
              <div 
                key={i} 
                style={{ height: `${h * 4}px` }} 
                className="w-1 bg-brand-secondary rounded-full animate-pulse-glow"
              />
            ))}
          </div>
        </div>
      )}

      {/* 3. Action Buttons control tray */}
      <div className="mb-12 flex items-center gap-6">
        
        {/* Ringing: Decline / Accept */}
        {callState === 'RINGING' ? (
          <>
            <button 
              onClick={handleDecline}
              className="w-14 h-14 bg-rose-600 hover:bg-rose-500 rounded-2xl flex items-center justify-center text-white cursor-pointer transition-transform hover:scale-105 shadow-lg shadow-rose-600/30"
              title="Decline Call"
            >
              <PhoneOff size={24} />
            </button>
            <button 
              onClick={handleAccept}
              className="w-14 h-14 bg-emerald-600 hover:bg-emerald-500 rounded-2xl flex items-center justify-center text-white cursor-pointer transition-transform hover:scale-105 animate-call-ring shadow-lg shadow-emerald-600/30"
              title="Accept Call"
            >
              <Phone size={24} />
            </button>
          </>
        ) : (
          // Connected / Dialing: Controls & Hang up
          <>
            <button 
              onClick={toggleMic}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all border border-white/5 cursor-pointer shadow-md ${micMuted ? 'bg-rose-600 hover:bg-rose-500 text-white' : 'bg-white/5 hover:bg-white/10 text-gray-300'}`}
              title={micMuted ? 'Unmute Mic' : 'Mute Mic'}
            >
              {micMuted ? <MicOff size={20} /> : <Mic size={20} />}
            </button>

            <button 
              onClick={handleHangup}
              className="w-14 h-14 bg-rose-600 hover:bg-rose-500 rounded-2xl flex items-center justify-center text-white cursor-pointer transition-transform hover:scale-105 shadow-lg shadow-rose-600/30"
              title="End Call"
            >
              <PhoneOff size={24} />
            </button>

            {callType === 'VIDEO' && (
              <button 
                onClick={toggleCamera}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all border border-white/5 cursor-pointer shadow-md ${cameraOff ? 'bg-rose-600 hover:bg-rose-500 text-white' : 'bg-white/5 hover:bg-white/10 text-gray-300'}`}
                title={cameraOff ? 'Start Camera' : 'Stop Camera'}
              >
                {cameraOff ? <VideoOff size={20} /> : <Video size={20} />}
              </button>
            )}
          </>
        )}

      </div>

    </div>
  )
}

export default CallOverlay
