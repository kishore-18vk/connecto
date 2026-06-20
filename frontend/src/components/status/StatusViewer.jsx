import React, { useState, useEffect } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import api from '../../services/api'

function StatusViewer({ stories, onClose }) {
  const [activeIdx, setActiveIdx] = useState(0)
  const [progress, setProgress] = useState(0)
  const currentStory = stories[activeIdx]

  // Track status view in background
  useEffect(() => {
    if (currentStory) {
      api.post(`status/${currentStory.id}/view/`).catch(err => {
        // Quietly handle already viewed status
      })
    }
  }, [currentStory])

  // Timer loop for automatic transition
  useEffect(() => {
    setProgress(0)
    const intervalTime = 50 // progress ticks
    const totalTime = 5000  // 5 seconds per status
    const step = (intervalTime / totalTime) * 100

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer)
          handleNext()
          return 0
        }
        return prev + step
      })
    }, intervalTime)

    return () => clearInterval(timer)
  }, [activeIdx])

  const handleNext = () => {
    if (activeIdx < stories.length - 1) {
      setActiveIdx(activeIdx + 1)
    } else {
      onClose()
    }
  }

  const handlePrev = () => {
    if (activeIdx > 0) {
      setActiveIdx(activeIdx - 1)
    }
  }

  if (!currentStory) return null

  const avatar = currentStory.user_details?.profile?.profile_picture || currentStory.user_details?.avatar_url

  return (
    <div className="fixed inset-0 z-50 bg-[#020617]/95 flex flex-col justify-between select-none backdrop-blur-md">
      
      {/* 1. Top progress bar panel */}
      <div className="absolute top-0 inset-x-0 p-4 bg-gradient-to-b from-black/80 to-transparent z-20 space-y-4">
        {/* Progress indicators */}
        <div className="flex gap-1.5 w-full">
          {stories.map((story, index) => {
            let widthVal = '0%'
            if (index < activeIdx) widthVal = '100%'
            if (index === activeIdx) widthVal = `${progress}%`

            return (
              <div key={story.id} className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
                <div 
                  style={{ width: widthVal }} 
                  className="h-full bg-brand-primary transition-all duration-75"
                />
              </div>
            )
          })}
        </div>

        {/* User Info & Close button */}
        <div className="flex justify-between items-center px-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center shrink-0 border border-brand-primary/40">
              {avatar ? (
                <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white font-bold">{(currentStory.user_details?.first_name || currentStory.user_details?.username || '?')[0].toUpperCase()}</span>
              )}
            </div>
            <div>
              <h4 className="text-sm font-bold text-white leading-tight font-display">
                {currentStory.user_details?.first_name || currentStory.user_details?.username} {currentStory.user_details?.last_name || ''}
              </h4>
              <span className="text-[10px] text-gray-300">
                {new Date(currentStory.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>

          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 cursor-pointer transition-colors">
            <X size={22} />
          </button>
        </div>
      </div>

      {/* 2. Main Story Slides Panel */}
      <div className="flex-1 flex items-center justify-center relative">
        {/* Clickable regions to page forward/backward */}
        <div 
          onClick={handlePrev}
          className="absolute left-0 inset-y-0 w-1/4 z-10 cursor-pointer flex items-center pl-4 group"
        >
          <button className="opacity-0 group-hover:opacity-100 bg-black/40 text-white rounded-full p-2.5 transition-all">
            <ChevronLeft size={22} />
          </button>
        </div>

        <div 
          onClick={handleNext}
          className="absolute right-0 inset-y-0 w-1/4 z-10 cursor-pointer flex items-center justify-end pr-4 group"
        >
          <button className="opacity-0 group-hover:opacity-100 bg-black/40 text-white rounded-full p-2.5 transition-all">
            <ChevronRight size={22} />
          </button>
        </div>

        {/* Story content viewport */}
        <div className="w-full max-w-sm h-[70vh] flex flex-col justify-center items-center p-4 text-center">
          {currentStory.media_type === 'TEXT' ? (
            <div 
              style={{ backgroundColor: currentStory.background_color }}
              className="w-full h-full rounded-3xl flex items-center justify-center p-8 shadow-2xl relative border border-white/5"
            >
              <p className="text-white text-xl font-bold break-words whitespace-pre-wrap leading-relaxed select-text font-display">
                {currentStory.text_content}
              </p>
            </div>
          ) : (
            <div className="w-full h-full rounded-3xl overflow-hidden relative shadow-2xl bg-slate-900 border border-white/5 flex flex-col justify-between">
              <img 
                src={currentStory.media_file} 
                alt="Story View" 
                className="w-full h-full object-cover select-none" 
              />
              {currentStory.text_content && (
                <div className="absolute bottom-0 inset-x-0 p-5 bg-gradient-to-t from-black/90 via-black/40 to-transparent text-center">
                  <p className="text-white text-sm font-semibold drop-shadow-md select-text">
                    {currentStory.text_content}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}

export default StatusViewer
