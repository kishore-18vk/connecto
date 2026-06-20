import axios from 'axios'
import store from '../redux/store'
import { setCredentials, clearCredentials } from '../redux/authSlice'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/'

const api = axios.create({
  baseURL: API_URL
})

api.interceptors.request.use(
  (config) => {
    const token = store.getState().auth.accessToken
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      const state = store.getState().auth
      const refreshToken = state.refreshToken
      const user = state.user
      
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_URL}auth/refresh/`, {
            refresh: refreshToken
          })
          const { access, refresh } = response.data
          
          store.dispatch(setCredentials({
            access,
            refresh: refresh || refreshToken,
            user
          }))
          
          originalRequest.headers.Authorization = `Bearer ${access}`
          return api(originalRequest)
        } catch (refreshError) {
          store.dispatch(clearCredentials())
          return Promise.reject(refreshError)
        }
      } else {
        store.dispatch(clearCredentials())
      }
    }
    return Promise.reject(error)
  }
)

export default api
export { API_URL }
