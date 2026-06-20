import store from '../redux/store'
import { addMessage, updateMessage, updateMessageStatus, setTyping, setPresence } from '../redux/chatSlice'
import { incomingCall } from '../redux/callSlice'
import { API_URL } from './api'

class WebSocketService {
  constructor() {
    this.socket = null
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 5
    this.listeners = new Set()
  }

  connect() {
    const state = store.getState()
    const token = state.auth.accessToken
    
    if (!token) {
      console.warn("WebSocket cannot connect without an access token.")
      return
    }

    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return
    }

    const wsScheme = window.location.protocol === 'https:' ? 'wss' : 'ws'
    let wsHost = import.meta.env.VITE_WS_HOST
    if (!wsHost) {
      try {
        wsHost = new URL(API_URL).host
      } catch (e) {
        wsHost = window.location.host
      }
    }
    const wsUrl = import.meta.env.VITE_WS_URL || `${wsScheme}://${wsHost}/ws/chat/`
    
    this.socket = new WebSocket(`${wsUrl}?token=${token}`)

    this.socket.onopen = () => {
      console.log("WebSocket connected successfully.")
      this.reconnectAttempts = 0
    }

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        this.handleMessage(data)
      } catch (err) {
        console.error("Error parsing WebSocket message:", err)
      }
    }

    this.socket.onclose = (event) => {
      console.warn(`WebSocket closed. Code: ${event.code}. Reconnecting...`)
      this.attemptReconnect()
    }

    this.socket.onerror = (err) => {
      console.error("WebSocket error:", err)
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      setTimeout(() => {
        this.connect()
      }, 3000)
    } else {
      console.error("Max WebSocket reconnect attempts reached.")
    }
  }

  handleMessage(data) {
    const { type } = data
    
    switch (type) {
      case 'message':
        store.dispatch(addMessage(data.message))
        break
      case 'typing':
        store.dispatch(setTyping({
          chatId: data.chatId,
          userId: data.user_id,
          is_typing: data.is_typing
        }))
        break
      case 'receipt':
        if (data.msg_ids && data.msg_ids.length > 0) {
          store.dispatch(updateMessageStatus({
            chatId: data.chat_id,
            msgIds: data.msg_ids,
            status: data.status
          }))
        } else {
          const state = store.getState()
          const msgs = state.chat.messages[data.chat_id] || []
          const msgIds = msgs.filter(m => m.sender !== state.auth.user?.id).map(m => m.id)
          if (msgIds.length > 0) {
            store.dispatch(updateMessageStatus({
              chatId: data.chat_id,
              msgIds: msgIds,
              status: data.status
            }))
          }
        }
        break
      case 'presence':
        store.dispatch(setPresence({
          userId: data.user_id,
          is_online: data.is_online,
          last_seen: data.last_seen
        }))
        break
      case 'call_signal':
        if (data.signal?.type === 'offer') {
          const caller = {
            id: data.sender_id,
            username: `User_${data.sender_id}`,
            first_name: `Caller`,
            last_name: `#${data.sender_id}`,
          }
          store.dispatch(incomingCall({
            caller,
            callType: data.call_type,
            signal: data.signal
          }))
        } else {
          this.listeners.forEach(listener => listener(data))
        }
        break
      default:
        console.log("Unhandled WebSocket message type:", type)
    }
  }

  addEventListener(listener) {
    this.listeners.add(listener)
  }

  removeEventListener(listener) {
    this.listeners.delete(listener)
  }

  send(data) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data))
    } else {
      console.error("Cannot send message. WebSocket is not open.")
    }
  }

  sendMessage(chatId, content, messageType = 'TEXT', mediaUrl = null, parentMessageId = null) {
    this.send({
      action: 'message',
      chat_id: chatId,
      content,
      message_type: messageType,
      media_url: mediaUrl,
      parent_message_id: parentMessageId
    })
  }

  sendTyping(chatId, isTyping) {
    this.send({
      action: 'typing',
      chat_id: chatId,
      is_typing: isTyping
    })
  }

  sendReadReceipt(chatId) {
    this.send({
      action: 'read',
      chat_id: chatId
    })
  }

  sendDeliveryReceipt(chatId) {
    this.send({
      action: 'deliver',
      chat_id: chatId
    })
  }

  sendCallSignal(receiverId, signal, callType = 'VOICE') {
    this.send({
      action: 'call_signal',
      receiver_id: receiverId,
      signal,
      call_type: callType
    })
  }

  disconnect() {
    if (this.socket) {
      this.socket.onclose = null
      this.socket.close()
      this.socket = null
    }
  }
}

const wsService = new WebSocketService()
export default wsService
