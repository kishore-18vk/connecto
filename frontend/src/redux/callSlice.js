import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  callState: null, // null, 'RINGING' (incoming), 'DIALING' (outgoing), 'CONNECTED', 'DISCONNECTED'
  caller: null,
  receiver: null,
  callType: null, // 'VOICE', 'VIDEO'
  callId: null,
  incomingSignal: null
}

const callSlice = createSlice({
  name: 'call',
  initialState,
  reducers: {
    startCall: (state, action) => {
      const { receiver, callType } = action.payload
      state.callState = 'DIALING'
      state.caller = JSON.parse(localStorage.getItem('user'))
      state.receiver = receiver
      state.callType = callType
      state.callId = uuidv4()
    },
    incomingCall: (state, action) => {
      const { caller, callType, signal } = action.payload
      state.callState = 'RINGING'
      state.caller = caller
      state.receiver = JSON.parse(localStorage.getItem('user'))
      state.callType = callType
      state.incomingSignal = signal
    },
    acceptCall: (state) => {
      state.callState = 'CONNECTED'
    },
    endCall: (state) => {
      state.callState = null
      state.caller = null
      state.receiver = null
      state.callType = null
      state.callId = null
      state.incomingSignal = null
    }
  }
})

// Quick helper to generate UUIDs locally if needed
function uuidv4() {
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  )
}

export const { startCall, incomingCall, acceptCall, endCall } = callSlice.actions
export default callSlice.reducer
