import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  chats: [],
  activeChatId: null,
  messages: {},
  typing: {},
  presence: {}
}

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setChats: (state, action) => {
      state.chats = action.payload
    },
    addChat: (state, action) => {
      const exists = state.chats.some(c => c.id === action.payload.id)
      if (!exists) {
        state.chats = [action.payload, ...state.chats]
      }
    },
    updateChat: (state, action) => {
      const index = state.chats.findIndex(c => c.id === action.payload.id)
      if (index !== -1) {
        state.chats[index] = { ...state.chats[index], ...action.payload }
      }
      state.chats.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    },
    setActiveChatId: (state, action) => {
      state.activeChatId = action.payload
      const chat = state.chats.find(c => c.id === action.payload)
      if (chat) {
        chat.unread_count = 0
      }
    },
    setMessages: (state, action) => {
      const { chatId, messages } = action.payload
      state.messages[chatId] = messages
    },
    addMessage: (state, action) => {
      const msg = action.payload
      const chatId = msg.chat
      if (!state.messages[chatId]) {
        state.messages[chatId] = []
      }
      const exists = state.messages[chatId].some(m => m.id === msg.id)
      if (!exists) {
        state.messages[chatId].push(msg)
      }
      
      const chatIndex = state.chats.findIndex(c => c.id === chatId)
      if (chatIndex !== -1) {
        state.chats[chatIndex].last_message = msg
        state.chats[chatIndex].updated_at = new Date().toISOString()
        
        const currentUser = JSON.parse(localStorage.getItem('user'))
        if (state.activeChatId !== chatId && currentUser && msg.sender !== currentUser.id) {
          state.chats[chatIndex].unread_count = (state.chats[chatIndex].unread_count || 0) + 1
        }
        
        const chat = state.chats[chatIndex]
        state.chats.splice(chatIndex, 1)
        state.chats.unshift(chat)
      }
    },
    updateMessage: (state, action) => {
      const msg = action.payload
      const chatId = msg.chat
      if (state.messages[chatId]) {
        const index = state.messages[chatId].findIndex(m => m.id === msg.id)
        if (index !== -1) {
          state.messages[chatId][index] = { ...state.messages[chatId][index], ...msg }
        }
      }
    },
    updateMessageStatus: (state, action) => {
      const { chatId, msgIds, status } = action.payload
      if (state.messages[chatId]) {
        state.messages[chatId] = state.messages[chatId].map(m => {
          if (msgIds.includes(m.id)) {
            if (status === 'READ') {
              return { ...m, is_seen: true, is_delivered: true }
            } else if (status === 'DELIVERED') {
              return { ...m, is_delivered: true }
            }
          }
          return m
        })
      }
    },
    setTyping: (state, action) => {
      const { chatId, userId, is_typing } = action.payload
      if (!state.typing[chatId]) {
        state.typing[chatId] = {}
      }
      state.typing[chatId][userId] = is_typing
    },
    setPresence: (state, action) => {
      const { userId, is_online, last_seen } = action.payload
      state.presence[userId] = { is_online, last_seen }
    }
  }
})

export const {
  setChats, addChat, updateChat, setActiveChatId, setMessages,
  addMessage, updateMessage, updateMessageStatus, setTyping, setPresence
} = chatSlice.actions
export default chatSlice.reducer
