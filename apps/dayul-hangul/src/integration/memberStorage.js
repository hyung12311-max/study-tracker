import { currentDayulMember } from './authBridge.js'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function memberId() {
  const member = currentDayulMember()
  if (!member || member.role !== 'child' || member.member_key !== 'dayul' || !UUID_PATTERN.test(member.id)) throw new Error('인증된 다율이 계정을 확인할 수 없습니다.')
  return member.id
}

export function progressStorageKey() { return `dayul-hangul-progress:${memberId()}` }
export function soundStorageKey() { return `dayul-hangul-sound:${memberId()}` }
export function importMarkerKey() { return `dayul-hangul-imported:${memberId()}` }
