import { currentFamilyApiToken } from './authBridge.js'

export class HangulRewardError extends Error {
  constructor(message, { code = 'HANGUL_COMPLETION_FAILED', retryable = false } = {}) {
    super(message)
    this.name = 'HangulRewardError'
    this.code = code
    this.retryable = retryable
  }
}

export async function onDailyLearningCompleted(payload, { fetchImpl = window.fetch.bind(window) } = {}) {
  const token = currentFamilyApiToken()
  if (!token) throw new HangulRewardError('로그인을 다시 확인해 주세요.', { code: 'AUTH_REQUIRED' })
  if (payload?.mode !== 'daily' || payload?.targetCount !== 20 || payload?.completedCount !== 20) {
    throw new HangulRewardError('20문제 오늘 학습을 모두 완료해야 합니다.', { code: 'HANGUL_NOT_ELIGIBLE' })
  }

  let response
  try {
    response = await fetchImpl('/api/hangul/daily-complete', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify(payload),
    })
  } catch {
    throw new HangulRewardError('네트워크가 연결되면 자동으로 다시 시도할게요.', { code: 'NETWORK_ERROR', retryable: true })
  }

  const data = await response.json().catch(() => null)
  if (!response.ok || !data?.ok) {
    const retryable = response.status >= 500 || response.status === 429
    throw new HangulRewardError(data?.error || '학습 스티커 처리를 완료하지 못했어요.', { code: data?.code, retryable })
  }

  const completion = data.completion
  if (!completion?.completionId || ![0, 2].includes(Number(completion.stickerAwarded))) {
    throw new HangulRewardError('서버 응답을 확인하지 못했어요.', { code: 'INVALID_SERVER_RESPONSE', retryable: true })
  }
  return {
    status: completion.alreadyCompleted ? 'already-granted' : 'granted',
    completionId: completion.completionId,
    stickerAwarded: Number(completion.stickerAwarded),
  }
}
