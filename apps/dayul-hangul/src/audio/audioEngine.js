const MELODY = [
  [523.25, 0], [659.25, 0.55], [783.99, 1.1], [659.25, 1.65],
  [587.33, 2.35], [698.46, 2.9], [880, 3.45], [698.46, 4],
  [659.25, 4.7], [587.33, 5.25], [523.25, 5.8], [392, 6.35],
]

class AudioEngine {
  constructor() {
    this.context = null
    this.settings = null
    this.userActivated = false
    this.musicPlaying = false
    this.musicTimer = null
    this.musicSources = new Set()
    this.effectSources = new Set()
    this.lastEffects = new Map()
  }

  updateSettings(settings) {
    const musicNeedsRestart = this.settings
      && this.settings.musicVolume !== settings.musicVolume
      && this.musicPlaying
    this.settings = settings
    if (musicNeedsRestart) this.stopMusic()
    if (!settings.soundEnabled || !settings.musicEnabled) this.stopMusic()
    else if (this.userActivated && document.visibilityState === 'visible') this.startMusic()
    if (!settings.soundEnabled || !settings.effectsEnabled) this.stopEffects()
  }

  ensureContext() {
    if (!this.settings?.soundEnabled) return null
    if (!this.context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      if (!AudioContextClass) return null
      this.context = new AudioContextClass()
    }
    if (this.context.state === 'suspended') this.context.resume().catch(() => {})
    return this.context
  }

  handleUserGesture() {
    this.userActivated = true
    this.ensureContext()
    if (this.settings?.musicEnabled) this.startMusic()
  }

  createTone(frequency, start, duration, volume, destinationSet, type = 'sine') {
    const context = this.context
    if (!context) return
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, start)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), start + 0.025)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    oscillator.connect(gain).connect(context.destination)
    destinationSet.add(oscillator)
    oscillator.onended = () => destinationSet.delete(oscillator)
    oscillator.start(start)
    oscillator.stop(start + duration + 0.03)
  }

  scheduleMusicLoop() {
    if (!this.musicPlaying || !this.context || !this.settings?.soundEnabled || !this.settings?.musicEnabled) return
    const start = this.context.currentTime + 0.08
    const volume = 0.035 * this.settings.musicVolume
    MELODY.forEach(([frequency, offset], index) => {
      this.createTone(frequency, start + offset, 0.42, volume, this.musicSources, index % 3 === 0 ? 'sine' : 'triangle')
      if (index % 4 === 0) this.createTone(frequency / 2, start + offset, 0.7, volume * 0.38, this.musicSources, 'sine')
    })
    this.musicTimer = window.setTimeout(() => this.scheduleMusicLoop(), 7050)
  }

  startMusic() {
    if (this.musicPlaying || !this.userActivated || document.visibilityState !== 'visible' || !this.settings?.soundEnabled || !this.settings?.musicEnabled) return
    if (!this.ensureContext()) return
    this.musicPlaying = true
    this.scheduleMusicLoop()
  }

  stopMusic() {
    this.musicPlaying = false
    clearTimeout(this.musicTimer)
    this.musicTimer = null
    this.musicSources.forEach((source) => { try { source.stop() } catch {} })
    this.musicSources.clear()
  }

  stopEffects() {
    this.effectSources.forEach((source) => { try { source.stop() } catch {} })
    this.effectSources.clear()
  }

  playEffect(name) {
    if (!this.settings?.soundEnabled || !this.settings?.effectsEnabled) return
    const nowMs = performance.now()
    const minimumGap = name === 'select' ? 100 : 180
    if (nowMs - (this.lastEffects.get(name) || 0) < minimumGap) return
    this.lastEffects.set(name, nowMs)
    const context = this.ensureContext()
    if (!context) return
    const start = context.currentTime + 0.01
    const volume = 0.11 * this.settings.effectsVolume
    const tone = (frequency, offset, duration = 0.16, gain = 1, type = 'sine') => this.createTone(frequency, start + offset, duration, volume * gain, this.effectSources, type)
    const effects = {
      select: () => tone(620, 0, 0.08, 0.45, 'triangle'),
      correct: () => { tone(523, 0); tone(659, 0.14); tone(784, 0.28, 0.25) },
      wrong: () => { tone(330, 0, 0.13, 0.45, 'triangle'); tone(294, 0.14, 0.18, 0.35, 'triangle') },
      star: () => { tone(1047, 0, 0.3, 0.55); tone(1568, 0.12, 0.36, 0.4) },
      equip: () => { tone(698, 0, 0.1, 0.45); tone(880, 0.09, 0.16, 0.4) },
      difficulty: () => { [523, 659, 784, 1047].forEach((frequency, index) => tone(frequency, index * 0.16, 0.28, 0.55)) },
      levelUp: () => { [392, 523, 659, 784, 1047, 1319].forEach((frequency, index) => tone(frequency, index * 0.28, 0.48, 0.62)) },
      fanfare: () => { [523, 659, 784, 659, 1047].forEach((frequency, index) => tone(frequency, index * 0.2, 0.38, 0.58)) },
    }
    effects[name]?.()
  }

  handleVisibility(hidden) {
    if (hidden) {
      this.stopMusic()
      this.context?.suspend().catch(() => {})
    } else if (this.userActivated && this.settings?.soundEnabled && this.settings?.musicEnabled) {
      this.startMusic()
    }
  }
}

export const audioEngine = new AudioEngine()
