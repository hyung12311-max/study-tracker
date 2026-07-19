import { validateBackupDocument, validateProgress, validateSound } from '../storage/backup.js'

function restore(storage, key, value) {
  if (value === null) storage.removeItem(key)
  else storage.setItem(key, value)
}

function removeImportedServerRewardClaims(progress) {
  const copy = structuredClone(progress)
  const sessions = copy?.learning?.dailySessions
  if (!sessions || typeof sessions !== 'object') return copy
  for (const session of Object.values(sessions)) {
    if (!session || typeof session !== 'object') continue
    session.serverRewardStatus = 'idle'
    session.serverRewardGrantedAt = null
    session.serverCompletionId = null
    session.serverRewardErrorCode = null
    session.serverRewardLastAttemptAt = null
  }
  return copy
}

export function applyValidatedBackup({ storage = localStorage, progressKey, soundKey, markerKey, backup, onApplied = () => {} }) {
  const validation = validateBackupDocument(backup)
  if (!validation.valid) throw new Error(validation.errors.join(' '))
  if (storage.getItem(markerKey)) throw new Error('기존 기록 가져오기를 이미 완료했습니다.')
  const previous = { progress: storage.getItem(progressKey), sound: storage.getItem(soundKey), marker: storage.getItem(markerKey) }
  try {
    const safeProgress = removeImportedServerRewardClaims(backup.progress)
    storage.setItem(progressKey, JSON.stringify(safeProgress))
    storage.setItem(soundKey, JSON.stringify(backup.sound))
    const savedProgress = JSON.parse(storage.getItem(progressKey))
    const savedSound = JSON.parse(storage.getItem(soundKey))
    if (!validateProgress(savedProgress).valid || !validateSound(savedSound).valid) throw new Error('가져온 데이터를 저장한 뒤 검증하지 못했습니다.')
    storage.setItem(markerKey, JSON.stringify({ version: 1, importedAt: new Date().toISOString(), sourceExportedAt: backup.exportedAt }))
    onApplied(structuredClone(savedProgress), structuredClone(savedSound))
    return previous
  } catch (error) {
    restore(storage, progressKey, previous.progress)
    restore(storage, soundKey, previous.sound)
    restore(storage, markerKey, previous.marker)
    throw error
  }
}
