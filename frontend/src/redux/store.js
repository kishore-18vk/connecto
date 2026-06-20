import { configureStore } from '@reduxjs/toolkit'
import authReducer from './authSlice'
import chatReducer from './chatSlice'
import callReducer from './callSlice'
import statusReducer from './statusSlice'

const store = configureStore({
  reducer: {
    auth: authReducer,
    chat: chatReducer,
    call: callReducer,
    status: statusReducer
  }
})

export default store
