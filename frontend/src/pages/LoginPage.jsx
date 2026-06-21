import React, { useState, useEffect, useRef } from 'react'
import { useDispatch } from 'react-redux'
import { setCredentials } from '../redux/authSlice'
import api from '../services/api'
import { ShieldAlert, Mail, Lock, User, ShieldCheck, ArrowLeft, Timer, RefreshCw } from 'lucide-react'

function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [signUpStage, setSignUpStage] = useState(1) // 1: Email, 2: OTP, 3: Nickname/Password

  // Common inputs
  const [emailInput, setEmailInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [nicknameInput, setNicknameInput] = useState('')
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('')

  // OTP inputs
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', ''])
  const [otpTimer, setOtpTimer] = useState(300) // 5 minutes
  const [resendCooldown, setResendCooldown] = useState(60) // 60 seconds

  // UI state
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const dispatch = useDispatch()

  const digitRefs = [
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null)
  ]

  // OTP Timer countdown
  useEffect(() => {
    let interval = null
    if (isSignUp && signUpStage === 2 && otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer((prev) => prev - 1)
      }, 1000)
    } else if (otpTimer === 0) {
      clearInterval(interval)
    }
    return () => clearInterval(interval)
  }, [isSignUp, signUpStage, otpTimer])

  // Resend cooldown countdown
  useEffect(() => {
    let interval = null
    if (isSignUp && signUpStage === 2 && resendCooldown > 0) {
      interval = setInterval(() => {
        setResendCooldown((prev) => prev - 1)
      }, 1000)
    } else if (resendCooldown === 0) {
      clearInterval(interval)
    }
    return () => clearInterval(interval)
  }, [isSignUp, signUpStage, resendCooldown])

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`
  }

  const handleDigitChange = (index, value) => {
    if (!/^\d*$/.test(value)) return

    const newDigits = [...otpDigits]
    newDigits[index] = value.slice(-1)
    setOtpDigits(newDigits)

    if (value && index < 5) {
      digitRefs[index + 1].current.focus()
    }
  }

  const handleDigitKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!otpDigits[index] && index > 0) {
        const newDigits = [...otpDigits]
        newDigits[index - 1] = ''
        setOtpDigits(newDigits)
        digitRefs[index - 1].current.focus()
      } else {
        const newDigits = [...otpDigits]
        newDigits[index] = ''
        setOtpDigits(newDigits)
      }
    }
  }

  const handleDigitPaste = (e) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text').trim()
    if (!/^\d{6}$/.test(text)) return

    const newDigits = text.split('')
    setOtpDigits(newDigits)
    digitRefs[5].current.focus()
  }

  // --- Sign In Flow ---
  const handleSignIn = async (e) => {
    e.preventDefault()
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

  // --- Sign Up Stage 1: Send OTP ---
  const handleSendOtp = async (e) => {
    if (e) e.preventDefault()
    if (!emailInput) {
      setError('Email is required')
      return
    }
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const res = await api.post('send-otp/', { email: emailInput })
      setSuccess(res.data.detail || 'Verification code sent to your email!')
      setOtpTimer(300) // 5 minutes
      setResendCooldown(60)
      setSignUpStage(2)
      setOtpDigits(['', '', '', '', '', ''])
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to send OTP. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // --- Sign Up Stage 2: Verify OTP ---
  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault()
    const otpCode = otpDigits.join('')
    if (otpCode.length < 6) {
      setError('Please enter the 6-digit code')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await api.post('verify-otp/', {
        email: emailInput,
        otp: otpCode
      })
      setSuccess(res.data.detail || 'Email verified successfully!')
      setSignUpStage(3)
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid verification code.')
    } finally {
      setLoading(false)
    }
  }

  // --- Sign Up Stage 3: Complete Registration ---
  const handleRegister = async (e) => {
    e.preventDefault()
    if (!nicknameInput || !passwordInput || !confirmPasswordInput) {
      setError('All fields are required')
      return
    }
    if (passwordInput !== confirmPasswordInput) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    setError('')
    try {
      const otpCode = otpDigits.join('')
      const res = await api.post('auth/register/', {
        email: emailInput,
        nickname: nicknameInput,
        username: nicknameInput, // use nickname as username in backend register endpoint
        password: passwordInput,
        confirm_password: confirmPasswordInput,
        otp: otpCode
      })
      setSuccess('Account created successfully!')
      dispatch(setCredentials(res.data))
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed. Please check inputs.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-wa-dark via-[#111b21] to-[#0c2e26] p-4">
      <div className="w-full max-w-md bg-wa-darker border border-wa-border rounded-2xl p-8 shadow-2xl flex flex-col items-center transition-all duration-300">
        
        {/* Animated Icon */}
        <div className="w-20 h-20 bg-gradient-to-tr from-wa-green via-teal-500 to-emerald-400 rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-wa-green/20 hover:scale-105 transition-transform duration-300">
          <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.963 9.963 0 0 0 12 22Z" />
            <path d="M8 11.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM16 11.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM12 15.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM8 10h8v4" />
          </svg>
        </div>

        <h1 className="text-3xl font-bold font-display text-white mb-2">Connecto</h1>
        <p className="text-wa-gray text-center mb-8">
          {isSignUp 
            ? `Sign up - Step ${signUpStage} of 3` 
            : 'Sign in using your email and password.'}
        </p>

        {error && (
          <div className="w-full bg-red-950/40 border border-red-500/50 text-red-200 p-3 rounded-lg flex items-center gap-2 mb-6 text-sm">
            <ShieldAlert size={18} className="text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="w-full bg-emerald-950/40 border border-emerald-500/50 text-emerald-200 p-3 rounded-lg flex items-center gap-2 mb-6 text-sm">
            <ShieldCheck size={18} className="text-emerald-400 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Auth Tabs */}
        <div className="flex justify-center gap-6 mb-6 border-b border-wa-border pb-3 w-full">
          <button
            type="button"
            onClick={() => { setIsSignUp(false); setError(''); setSuccess(''); }}
            className={`text-base font-semibold pb-1 cursor-pointer transition-all ${!isSignUp ? 'text-wa-green border-b-2 border-wa-green' : 'text-wa-gray hover:text-white'}`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setIsSignUp(true); setSignUpStage(1); setError(''); setSuccess(''); }}
            className={`text-base font-semibold pb-1 cursor-pointer transition-all ${isSignUp ? 'text-wa-green border-b-2 border-wa-green' : 'text-wa-gray hover:text-white'}`}
          >
            Sign Up
          </button>
        </div>

        {/* --- SIGN IN FORM --- */}
        {!isSignUp && (
          <form onSubmit={handleSignIn} className="w-full space-y-4">
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

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-wa-green hover:bg-wa-green/90 text-white font-semibold rounded-lg py-2.5 text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-wa-green/10 mt-6"
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
        )}

        {/* --- SIGN UP FLOW --- */}
        {isSignUp && (
          <div className="w-full">
            {/* Stage 1: Email Input */}
            {signUpStage === 1 && (
              <form onSubmit={handleSendOtp} className="w-full space-y-4">
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

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-wa-green hover:bg-wa-green/90 text-white font-semibold rounded-lg py-2.5 text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-wa-green/10 mt-6"
                >
                  {loading ? 'Sending OTP...' : 'Send OTP'}
                </button>
              </form>
            )}

            {/* Stage 2: OTP Input */}
            {signUpStage === 2 && (
              <form onSubmit={handleVerifyOtp} className="w-full space-y-4">
                <button 
                  type="button" 
                  onClick={() => { setSignUpStage(1); setError(''); setSuccess(''); }}
                  className="flex items-center gap-2 text-xs text-wa-gray hover:text-white mb-4 mr-auto transition-colors cursor-pointer"
                >
                  <ArrowLeft size={14} /> Back to Email
                </button>

                <p className="text-sm text-wa-lightGray text-center mb-6">
                  We sent a 6-digit verification code to <span className="font-semibold text-white">{emailInput}</span>.
                </p>

                {/* 6 Digit Inputs */}
                <div className="flex justify-between gap-2 mb-4">
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={digitRefs[idx]}
                      type="text"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                      onPaste={handleDigitPaste}
                      className="w-12 h-14 bg-wa-dark border border-wa-border text-center text-xl text-white font-bold rounded-lg focus:border-wa-green focus:ring-1 focus:ring-wa-green outline-none transition-all"
                    />
                  ))}
                </div>

                <div className="flex items-center justify-between text-xs text-wa-gray px-1">
                  <div className="flex items-center gap-1">
                    <Timer size={14} />
                    <span>
                      {otpTimer > 0 ? `Expires in ${formatTime(otpTimer)}` : 'Code expired'}
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || otpTimer === 0}
                  className="w-full bg-wa-green hover:bg-wa-green/90 text-white font-semibold rounded-lg py-2.5 text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-wa-green/10 mt-6"
                >
                  {loading ? 'Verifying OTP...' : 'Verify OTP'}
                </button>

                {/* Resend OTP */}
                <div className="flex justify-center mt-4">
                  {resendCooldown > 0 ? (
                    <p className="text-xs text-wa-gray">
                      Resend code in {resendCooldown}s
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      className="flex items-center gap-1 text-xs text-wa-green hover:underline cursor-pointer"
                    >
                      <RefreshCw size={12} /> Resend OTP
                    </button>
                  )}
                </div>
              </form>
            )}

            {/* Stage 3: Nickname & Password Input */}
            {signUpStage === 3 && (
              <form onSubmit={handleRegister} className="w-full space-y-4">
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
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-wa-green hover:bg-wa-green/90 text-white font-semibold rounded-lg py-2.5 text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-wa-green/10 mt-6"
                >
                  {loading ? 'Creating Account...' : 'Create Account'}
                </button>
              </form>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

export default LoginPage
