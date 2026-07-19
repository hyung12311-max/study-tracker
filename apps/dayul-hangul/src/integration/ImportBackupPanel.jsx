import { useMemo, useState } from 'react'
import { backupSummary, createBackupFromStorage, downloadBackup, parseBackupText } from '../storage/backup.js'
import { currentDayulMember } from './authBridge.js'
import { applyValidatedBackup } from './importBackup.js'
import { importMarkerKey, progressStorageKey, soundStorageKey } from './memberStorage.js'

function readCurrentProgress() { try { return JSON.parse(localStorage.getItem(progressStorageKey()) || 'null') } catch { return null } }
function Summary({ title, value }) { return <div className="import-summary"><b>{title}</b><span>별 {value.stars}개</span><span>글자 {value.currentLevel}단계</span><span>완료 {value.completedDates.length}일</span><small>{value.completedDates.slice(-3).join(' · ') || '완료 기록 없음'}</small></div> }

export default function ImportBackupPanel({ onImported }) {
  const [candidate, setCandidate] = useState(null)
  const [notice, setNotice] = useState('')
  const [imported, setImported] = useState(() => Boolean(localStorage.getItem(importMarkerKey())))
  const currentSummary = useMemo(() => backupSummary(readCurrentProgress()), [candidate, imported])

  async function selectFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (imported) { setNotice('이 계정은 기존 기록 가져오기를 이미 완료했습니다.'); return }
    if (!currentDayulMember()) { setNotice('다율이 인증을 다시 확인해 주세요.'); return }
    try {
      const backup = parseBackupText(await file.text())
      setCandidate(backup)
      setNotice('백업 내용을 확인한 뒤 유지하거나 가져오기를 선택해 주세요.')
    } catch (error) {
      setCandidate(null)
      setNotice(error.message || '백업 파일을 읽지 못했습니다.')
    }
  }

  function keepCurrent() { setCandidate(null); setNotice('현재 통합 앱 기록을 그대로 유지합니다.') }

  function importBackup() {
    if (!candidate || imported || !currentDayulMember()) return
    const progressKey = progressStorageKey(), soundKey = soundStorageKey(), markerKey = importMarkerKey()
    try {
      const hasProgress = Boolean(localStorage.getItem(progressKey)), hasSound = Boolean(localStorage.getItem(soundKey))
      if (hasProgress !== hasSound) throw new Error('현재 통합 기록이 불완전하여 자동 백업할 수 없습니다. 먼저 현재 기록을 내보내 주세요.')
      if (hasProgress) downloadBackup(createBackupFromStorage({ progressKey, soundKey }), { prefix: 'dayul-hangul-pre-import-backup' })
      applyValidatedBackup({ progressKey, soundKey, markerKey, backup: candidate, onApplied: onImported })
      setImported(true); setCandidate(null); setNotice('기존 기록을 가져왔습니다. 새로고침해도 이 기록이 유지됩니다.')
    } catch (error) {
      setNotice(`${error.message || '기록 가져오기에 실패했습니다.'} 기존 통합 기록은 복원했습니다.`)
    }
  }

  return <section className="settings-card backup-card"><div className="section-title"><div><small>기록 이전</small><h2>기존 한글 놀이터 기록 가져오기</h2></div></div>{imported ? <p>이 다율이 계정은 기록 가져오기를 이미 완료했습니다.</p> : <><p>Study_D에서 내보낸 JSON 파일만 사용할 수 있습니다. 현재 기록을 자동으로 덮어쓰지 않습니다.</p><label className="backup-action file-action">백업 JSON 선택<input type="file" accept="application/json,.json" onChange={selectFile} /></label></>}{candidate && <div className="import-compare"><Summary title="현재 통합 기록" value={currentSummary} /><Summary title="가져올 백업 기록" value={backupSummary(candidate.progress)} /><div className="import-actions"><button type="button" onClick={keepCurrent}>기존 데이터 유지</button><button type="button" className="backup-action" onClick={importBackup}>백업 데이터 가져오기</button></div></div>}{notice && <p className="backup-notice" role="status">{notice}</p>}</section>
}
