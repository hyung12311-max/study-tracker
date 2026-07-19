import { getLetterLevel } from '../data/letterLevels.js'
import { getWordsForLevel } from '../data/words.js'
import { getActiveTypeWeights, getQuestionCandidateIds, getQuestionDescriptor } from './questionEngine.js'

export const DAILY_TARGET_OPTIONS = [10, 15, 20, 25, 30]
export const DEFAULT_DAILY_TARGET = 20
export const DAILY_COMPLETION_REWARD = 3

function createSessionId(dateKey) {
  const randomId = globalThis.crypto?.randomUUID?.() || `${Date.now()}.${Math.random().toString(36).slice(2)}`
  return `hangul.${dateKey}.${randomId}`
}

export function getKoreanDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}`
}

export function shiftDate(dateKey, days) {
  const [year, month, day] = dateKey.split('-').map(Number)
  const noonUtc = new Date(Date.UTC(year, month - 1, day, 3))
  noonUtc.setUTCDate(noonUtc.getUTCDate() + days)
  return getKoreanDate(noonUtc)
}

function shuffle(items) {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1))
    ;[result[index], result[target]] = [result[target], result[index]]
  }
  return result
}

function takeCandidates(source, count, used, allowRepeats = false) {
  const unique = shuffle(source.filter((id) => !used.has(id)))
  const selected = unique.slice(0, count)
  selected.forEach((id) => used.add(id))
  if (selected.length < count && allowRepeats && source.length) {
    const fallback = shuffle(source)
    while (selected.length < count) selected.push(fallback[selected.length % fallback.length])
  }
  return selected
}

function arrangeWithoutPatterns(entries) {
  const remaining = shuffle(entries)
  const arranged = []
  while (remaining.length) {
    const previous = arranged.at(-1)
    const lastTwo = arranged.slice(-2).map((item) => getQuestionDescriptor(item.id)?.answer)
    const repeatedAnswer = lastTwo.length === 2 && lastTwo[0] === lastTwo[1] ? lastTwo[0] : null
    let index = remaining.findIndex((item) => {
      const descriptor = getQuestionDescriptor(item.id)
      return descriptor?.wordId !== getQuestionDescriptor(previous?.id || '')?.wordId && (!repeatedAnswer || descriptor?.answer !== repeatedAnswer)
    })
    if (index < 0) index = 0
    arranged.push(remaining.splice(index, 1)[0])
  }
  return arranged
}

export function createDailySession(progress, dateKey = getKoreanDate()) {
  const targetCount = DAILY_TARGET_OPTIONS.includes(progress.learning.dailyTargetPreference) ? progress.learning.dailyTargetPreference : DEFAULT_DAILY_TARGET
  const currentLevel = progress.learning.currentLetterLevel
  const difficulty = progress.learning.difficultyMode === 'manual' ? progress.learning.selectedDifficultyLevel : progress.learning.autoDifficultyLevel
  const activeTypes = Object.keys(getActiveTypeWeights(difficulty, progress.learning.enabledQuestionTypes))
  const unlockedPlayableLevels = progress.learning.unlockedLetterLevels.filter((level) => getWordsForLevel(level).length)
  const currentIds = getQuestionCandidateIds(currentLevel, activeTypes)
  const allUnlockedIds = unlockedPlayableLevels.flatMap((level) => getQuestionCandidateIds(level, activeTypes))
  const maintenanceLevels = unlockedPlayableLevels.filter((level) => level < currentLevel)
  const maintenanceIds = maintenanceLevels.flatMap((level) => getQuestionCandidateIds(level, activeTypes))
  const statsByLevel = progress.learning.levelStats
  const weakIds = allUnlockedIds.sort((left, right) => {
    const leftItem = getQuestionDescriptor(left)
    const rightItem = getQuestionDescriptor(right)
    const leftWrong = statsByLevel[leftItem.letterLevel]?.letterWrong?.[leftItem.learningLetter] || 0
    const rightWrong = statsByLevel[rightItem.letterLevel]?.letterWrong?.[rightItem.learningLetter] || 0
    return rightWrong - leftWrong
  })
  const newCount = Math.round(targetCount * 0.4)
  const weakCount = Math.round(targetCount * 0.3)
  const maintenanceCount = targetCount - newCount - weakCount
  const used = new Set()
  const entries = [
    ...takeCandidates(currentIds, newCount, used).map((id) => ({ id, category: 'current' })),
    ...takeCandidates(weakIds, weakCount, used, true).map((id) => ({ id, category: 'review' })),
    ...takeCandidates(maintenanceIds.length ? maintenanceIds : currentIds, maintenanceCount, used, true).map((id) => ({ id, category: maintenanceIds.length ? 'maintenance' : 'current-fill' })),
  ]
  if (entries.length < targetCount) {
    const fallback = takeCandidates(currentIds.length ? currentIds : allUnlockedIds, targetCount - entries.length, used, true)
    entries.push(...fallback.map((id) => ({ id, category: 'current-fill' })))
  }
  const arranged = arrangeWithoutPatterns(entries).slice(0, targetCount)
  return {
    date: dateKey,
    sessionId: createSessionId(dateKey),
    targetCount,
    halfwayAt: Math.ceil(targetCount / 2),
    completedCount: 0,
    questionIds: arranged.map((item) => item.id),
    questionCategories: arranged.map((item) => item.category),
    completedQuestionIds: [],
    results: [],
    learnedLetters: [],
    reviewLetters: [],
    startedAt: new Date().toISOString(),
    completedAt: null,
    halfwayCelebrated: false,
    paused: false,
    currentWrongAttempts: 0,
    completionRewardGranted: false,
    serverRewardStatus: 'idle',
    serverRewardGrantedAt: null,
    serverCompletionId: null,
    serverRewardErrorCode: null,
    serverRewardLastAttemptAt: null,
    status: 'in-progress',
  }
}

export function getYesterdayReviewLetters(progress, today = getKoreanDate()) {
  const yesterday = progress.learning.dailySessions?.[shiftDate(today, -1)]
  return yesterday?.reviewLetters?.length ? yesterday.reviewLetters : []
}

export function calculateStreak(dailySessions, today = getKoreanDate()) {
  let cursor = dailySessions?.[today]?.status === 'completed' ? today : shiftDate(today, -1)
  let streak = 0
  while (dailySessions?.[cursor]?.status === 'completed') {
    streak += 1
    cursor = shiftDate(cursor, -1)
  }
  return streak
}

export function summarizeDailySession(session) {
  const correct = session?.results?.filter((result) => result.correct).length || 0
  const wrong = session?.results?.reduce((sum, result) => sum + (result.wrongAttempts || 0), 0) || 0
  return { correct, wrong, learnedLetters: session?.learnedLetters || [], reviewLetters: session?.reviewLetters || [] }
}

export function finishDailyQuestion(progress, dateKey, question) {
  const session = progress.learning.dailySessions?.[dateKey]
  if (!session || session.status === 'completed') return { progress, session, rewardGranted: false, duplicate: true }
  const index = session.completedCount
  const completionKey = `${index}:${question.id}`
  if (session.completedQuestionIds.includes(completionKey)) return { progress, session, rewardGranted: false, duplicate: true }
  const completedCount = Math.min(session.targetCount, index + 1)
  const wrongAttempts = Number(session.currentWrongAttempts) || 0
  const finished = completedCount >= session.targetCount
  const rewardGranted = finished && !session.completionRewardGranted
  const updatedSession = {
    ...session,
    completedCount,
    completedQuestionIds: [...session.completedQuestionIds, completionKey],
    results: [...session.results, { id: question.id, wordId: question.wordId, learningLetter: question.learningLetter, questionType: question.questionType, correct: true, wrongAttempts, completedAt: new Date().toISOString() }],
    learnedLetters: [...new Set([...session.learnedLetters, question.learningLetter])],
    reviewLetters: wrongAttempts > 0 ? [...new Set([...session.reviewLetters, question.learningLetter])] : session.reviewLetters,
    currentWrongAttempts: 0,
    status: finished ? 'completed' : 'in-progress',
    completedAt: finished ? new Date().toISOString() : null,
    completionRewardGranted: session.completionRewardGranted || rewardGranted,
  }
  return {
    progress: { ...progress, stars: progress.stars + (rewardGranted ? DAILY_COMPLETION_REWARD : 0), learning: { ...progress.learning, dailySessions: { ...progress.learning.dailySessions, [dateKey]: updatedSession } } },
    session: updatedSession,
    rewardGranted,
    duplicate: false,
  }
}

// localStorage 기반이므로 사용자가 기기 날짜나 저장값을 직접 바꾸는 조작을 완벽히 막을 수는 없다.
// 대신 날짜별 세션과 completionRewardGranted를 영구 보존해 정상적인 새로고침/시간 변경에서 중복 지급을 방지한다.
