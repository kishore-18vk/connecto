import React, { useState } from 'react'
import { useDispatch } from 'react-redux'
import { setCredentials } from '../redux/authSlice'
import api from '../services/api'
import { LogIn, ShieldAlert, Mail, Lock, User } from 'lucide-react'

function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [emailInput, setEmailInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [nicknameInput, setNicknameInput] = useState('')
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('')

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const dispatch = useDispatch()

  const handleEmailAuth = async (e) => {
    e.preventDefault()
    if (isSignUp) {
      if (!emailInput || !passwordInput || !nicknameInput || !confirmPasswordInput) {
        setError('All fields are required for sign up')
        return
      }
      if (passwordInput !== confirmPasswordInput) {
        setError('Passwords do not match')
        return
      }
      setLoading(true)
      setError('')
      try {
        const res = await api.post('auth/register/', {
          email: emailInput,
          nickname: nicknameInput,
          password: passwordInput,
          confirm_password: confirmPasswordInput
        })
        dispatch(setCredentials(res.data))
      } catch (err) {
        setError(err.response?.data?.detail || 'Registration failed. Please check inputs.')
      } finally {
        setLoading(false)
      }
    } else {
      if (!emailInput || !passwordInput) {
        setError('Email and password are required')
        return
      }
      setLoading(true)
      setError('')
      try {
        const res = await api.post('auth/login/', {
          email: emailInput,
          password: passwordInput
        })
        dispatch(setCredentials(res.data))
      } catch (err) {
        setError(err.response?.data?.detail || 'Invalid email or password.')
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-wa-dark via-[#111b21] to-[#0c2e26] p-4">
      <div className="w-full max-w-md bg-wa-darker border border-wa-border rounded-2xl p-8 shadow-2xl flex flex-col items-center">
        
        <div className="w-20 h-20 bg-gradient-to-tr from-wa-green via-teal-500 to-emerald-400 rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-wa-green/20 hover:scale-105 transition-transform duration-300">
          <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.963 9.963 0 0 0 12 22Z" />
            <path d="M8 11.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM16 11.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM12 15.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM8 10h8v4" />
          </svg>
        </div>

        <h1 className="text-3xl font-bold font-display text-white mb-2">Connecto</h1>
        <p className="text-wa-gray text-center mb-8">Sign in or register using your email and password.</p>

        {error && (
          <div className="w-full bg-red-950/40 border border-red-500/50 text-red-200 p-3 rounded-lg flex items-center gap-2 mb-6 text-sm">
            <ShieldAlert size={18} className="text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleEmailAuth} className="w-full space-y-4">
          {/* Email form Sub tabs */}
          <div className="flex justify-center gap-6 mb-6 border-b border-wa-border pb-3">
            <button
              type="button"
              onClick={() => { setIsSignUp(false); setError(''); setConfirmPasswordInput(''); }}
              className={`text-base font-semibold pb-1 cursor-pointer transition-all ${!isSignUp ? 'text-wa-green border-b-2 border-wa-green' : 'text-wa-gray hover:text-white'}`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setIsSignUp(true); setError(''); setConfirmPasswordInput(''); }}
              className={`text-base font-semibold pb-1 cursor-pointer transition-all ${isSignUp ? 'text-wa-green border-b-2 border-wa-green' : 'text-wa-gray hover:text-white'}`}
            >
              Sign Up
            </button>
          </div>

          {isSignUp && (
            <div>
              <label className="text-xs text-wa-gray block mb-1">Nickname</label>
              <div className="relative flex items-center bg-wa-dark border border-wa-border focus-within:border-wa-green rounded-lg px-3">
                <User size={16} className="text-wa-gray mr-2" />
                <input 
                  type="text" 
                  value={nicknameInput}
                  onChange={(e) => setNicknameInput(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full bg-transparent py-2.5 text-sm text-white outline-none"
                  required={isSignUp}
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs text-wa-gray block mb-1">Email Address</label>
            <div className="relative flex items-center bg-wa-dark border border-wa-border focus-within:border-wa-green rounded-lg px-3">
              <Mail size={16} className="text-wa-gray mr-2" />
              <input 
                type="email" 
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="name@example.com"
                className="w-full bg-transparent py-2.5 text-sm text-white outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-wa-gray block mb-1">Password</label>
            <div className="relative flex items-center bg-wa-dark border border-wa-border focus-within:border-wa-green rounded-lg px-3">
              <Lock size={16} className="text-wa-gray mr-2" />
              <input 
                type="password" 
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-transparent py-2.5 text-sm text-white outline-none"
                required
              />
            </div>
          </div>

          {isSignUp && (
            <div>
              <label className="text-xs text-wa-gray block mb-1">Confirm Password</label>
              <div className="relative flex items-center bg-wa-dark border border-wa-border focus-within:border-wa-green rounded-lg px-3">
                <Lock size={16} className="text-wa-gray mr-2" />
                <input 
                  type="password" 
                  value={confirmPasswordInput}
                  onChange={(e) => setConfirmPasswordInput(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-transparent py-2.5 text-sm text-white outline-none"
                  required={isSignUp}
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-wa-green hover:bg-wa-green/90 text-white font-semibold rounded-lg py-2.5 text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-wa-green/10 mt-6"
          >
            <LogIn size={16} />
            {loading ? 'Processing...' : (isSignUp ? 'Create Secure Account' : 'Sign In with Password')}
          </button>
        </form>
      </div>
    </div>
  )
}

export default LoginPage
