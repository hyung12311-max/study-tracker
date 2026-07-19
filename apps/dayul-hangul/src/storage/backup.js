export const BACKUP_FORMAT = 'dayul-hangul-backup'
export const BACKUP_VERSION = 1
export const LEGACY_PROGRESS_KEY = 'dayul-hangul-progress'
export const LEGACY_SOUND_KEY = 'dayul-hangul-sound'

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function finiteNonNegative(value) {
  return Number.isFinite(Number(value)) && Number(value) >= 0
}

export function validateProgress(progress) {
  const errors = []
  if (!isObject(progress)) return { valid: false, errors: ['진행 기록이 객체 형식이 아닙니다.'] }
  if (!finiteNonNegative(progress.stars)) errors.push('별 개수가 올바르지 않습니다.')
  for (const key of ['stickers', 'equipped', 'solved']) {
    if (!Array.isArray(progress[key])) errors.push(`${key} 기록이 배열 형식이 아닙니다.`)
  }
  if (!isObject(progress.learning)) {
    errors.push('학습 기록이 없습니다.')
  } else {
    if (!finiteNonNegative(progress.learning.currentLetterLevel)) errors.push('현재 글자 단계가 올바르지 않습니다.')
    if (!Array.isArray(progress.learning.unlockedLetterLevels)) errors.push('해금 단계 기록이 올바르지 않습니다.')
    if (!isObject(progress.learning.dailySessions)) errors.push('날짜별 학습 기록이 올바르지 않습니다.')
    if (!isObject(progress.learning.levelStats)) errors.push('단계별 통계가 올바르지 않습니다.')
    if (isObject(progress.learning.dailySessions)) {
      for (const [date, session] of Object.entries(progress.learning.dailySessions)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !isObject(session)) {
          errors.push('날짜별 학습 세션 형식이 올바르지 않습니다.')
          break
        }
        if (!finiteNonNegative(session.targetCount) || !finiteNonNegative(session.completedCount)) {
          errors.push(`${date} 학습 문제 수가 올바르지 않습니다.`)
          break
        }
      }
    }
  }
  return { valid: errors.length === 0, errors }
}

export function validateSound(sound) {
  const errors = []
  if (!isObject(sound)) return { valid: false, errors: ['소리 설정이 객체 형식이 아닙니다.'] }
  for (const key of ['soundEnabled', 'musicEnabled', 'effectsEnabled']) {
    if (typeof sound[key] !== 'boolean') errors.push(`${key} 설정이 올바르지 않습니다.`)
  }
  for (const key of ['musicVolume', 'effectsVolume']) {
    const value = Number(sound[key])
    if (!Number.isFinite(value) || value < 0 || value > 1) errors.push(`${key} 설정이 올바르지 않습니다.`)
  }
  return { valid: errors.length === 0, errors }
}

function parseStoredValue(raw, label) {
  if (!raw) throw new Error(`${label}이 없습니다. 앱을 한 번 사용한 뒤 다시 시도해 주세요.`)
  try {
    return JSON.parse(raw)
  } catch {
    throw new Error(`${label}이 손상되어 JSON으로 읽을 수 없습니다.`)
  }
}

export function createBackupFromStorage({ progressKey = LEGACY_PROGRESS_KEY, soundKey = LEGACY_SOUND_KEY, storage = localStorage } = {}) {
  const progress = parseStoredValue(storage.getItem(progressKey), '학습 진행 기록')
  const sound = parseStoredValue(storage.getItem(soundKey), '소리 설정')
  const errors = [...validateProgress(progress).errors, ...validateSound(sound).errors]
  if (errors.length) throw new Error(`백업할 데이터 구조를 확인해 주세요. ${errors.join(' ')}`)
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    progress: structuredClone(progress),
    sound: structuredClone(sound),
  }
}

export function validateBackupDocument(value) {
  const errors = []
  if (!isObject(value)) return { valid: false, errors: ['백업 파일이 객체 형식이 아닙니다.'] }
  if (value.format !== BACKUP_FORMAT) errors.push('지원하지 않는 백업 형식입니다.')
  if (value.version !== BACKUP_VERSION) errors.push(`지원하지 않는 백업 버전입니다. (지원 버전: ${BACKUP_VERSION})`)
  if (!value.exportedAt || Number.isNaN(Date.parse(value.exportedAt))) errors.push('내보낸 날짜가 올바르지 않습니다.')
  errors.push(...validateProgress(value.progress).errors, ...validateSound(value.sound).errors)
  return { valid: errors.length === 0, errors }
}

export function parseBackupText(text) {
  let value
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error('선택한 파일이 올바른 JSON 파일이 아닙니다.')
  }
  const result = validateBackupDocument(value)
  if (!result.valid) throw new Error(result.errors.join(' '))
  return { ...value, progress: structuredClone(value.progress), sound: structuredClone(value.sound) }
}

export function backupSummary(progress) {
  const sessions = isObject(progress?.learning?.dailySessions) ? progress.learning.dailySessions : {}
  return {
    stars: Number(progress?.stars) || 0,
    currentLevel: Number(progress?.learning?.currentLetterLevel) || 1,
    completedDates: Object.entries(sessions).filter(([, session]) => session?.status === 'completed').map(([date]) => date).sort(),
  }
}

export function downloadBackup(backup, { prefix = 'dayul-hangul-backup' } = {}) {
  const validation = validateBackupDocument(backup)
  if (!validation.valid) throw new Error(validation.errors.join(' '))
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const blob = new Blob([`${JSON.stringify(backup, null, 2)}\n`], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${prefix}-${date}.json`
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
  return anchor.download
}
