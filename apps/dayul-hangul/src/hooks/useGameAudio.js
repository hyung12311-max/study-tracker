import { useCallback, useEffect, useState } from 'react'
import { audioEngine } from '../audio/audioEngine.js'
import { soundStorageKey } from '../integration/memberStorage.js'

const SOUND_KEY = soundStorageKey()
const DEFAULT_SOUND = { soundEnabled: true, musicEnabled: true, effectsEnabled: true, musicVolume: 0.32, effectsVolume: 0.65 }

function readSoundSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SOUND_KEY))
    return {
      ...DEFAULT_SOUND,
      ...(saved && typeof saved === 'object' ? saved : {}),
      musicVolume: Math.min(1, Math.max(0, Number(saved?.musicVolume ?? DEFAULT_SOUND.musicVolume))),
      effectsVolume: Math.min(1, Math.max(0, Number(saved?.effectsVolume ?? DEFAULT_SOUND.effectsVolume))),
    }
  } catch {
    return DEFAULT_SOUND
  }
}

export function useGameAudio() {
  const [soundSettings, setSoundSettings] = useState(readSoundSettings)

  useEffect(() => {
    localStorage.setItem(SOUND_KEY, JSON.stringify(soundSettings))
    audioEngine.updateSettings(soundSettings)
  }, [soundSettings])

  useEffect(() => {
    const activate = () => audioEngine.handleUserGesture()
    const visibility = () => audioEngine.handleVisibility(document.hidden)
    window.addEventListener('pointerdown', activate, { once: true })
    window.addEventListener('keydown', activate, { once: true })
    document.addEventListener('visibilitychange', visibility)
    return () => {
      window.removeEventListener('pointerdown', activate)
      window.removeEventListener('keydown', activate)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [])

  const updateSound = useCallback((patch) => {
    audioEngine.handleUserGesture()
    setSoundSettings((old) => ({ ...old, ...patch }))
  }, [])

  const playEffect = useCallback((name) => audioEngine.playEffect(name), [])
  return { soundSettings, updateSound, playEffect }
}
