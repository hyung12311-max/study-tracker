import { useEffect, useMemo, useRef, useState } from 'react'
import { LETTER_LEVELS, QUESTION_TYPES, getLetterLevel } from './data/letterLevels.js'
import { getWordsForLevel } from './data/words.js'
import { DIFFICULTY_MIXES, DIFFICULTY_NAMES, createQuestionFromId, generateQuestion, getActiveTypeWeights } from './learning/questionEngine.js'
import { DAILY_COMPLETION_REWARD, DAILY_TARGET_OPTIONS, DEFAULT_DAILY_TARGET, calculateStreak, createDailySession, finishDailyQuestion, getKoreanDate, getYesterdayReviewLetters, summarizeDailySession } from './learning/dailyLearning.js'
import { useGameAudio } from './hooks/useGameAudio.js'
import { createBackupFromStorage, downloadBackup } from './storage/backup.js'
import ImportBackupPanel from './integration/ImportBackupPanel.jsx'
import { onDailyLearningCompleted } from './integration/completionBridge.js'
import { progressStorageKey, soundStorageKey } from './integration/memberStorage.js'

const REWARDS = [
  { id: 'ribbon', name: '딸기 리본', icon: '🎀', need: 2 },
  { id: 'crown', name: '반짝 왕관', icon: '♛', need: 5 },
  { id: 'cape', name: '별빛 망토', icon: '◆', need: 8 },
]
const ROOMS = [
  { id: 'sunny', name: '햇살 방', icon: '☀️', need: 0 },
  { id: 'garden', name: '꽃밭 방', icon: '🌷', need: 4 },
  { id: 'night', name: '별밤 방', icon: '🌙', need: 7 },
]
const INITIAL = { stars: 0, stickers: [], equipped: [], room: 'sunny', solved: [] }
const LEARNING_KEY = progressStorageKey()
const LEVEL_UP_BONUS = 3
const PLAYABLE_TYPES = QUESTION_TYPES.filter((type) => type.available).map((type) => type.id)

function emptyLevelStats(level, saved = {}) {
  const letters = getLetterLevel(level).letters
  const correct = Number(saved.correct) || 0
  const wrong = Number(saved.wrong) || 0
  const history = Array.isArray(saved.history) ? saved.history.slice(-15) : []
  return {
    correct,
    wrong,
    accuracy: Number(saved.accuracy) || Math.round((correct / Math.max(1, correct + wrong)) * 100),
    recentAccuracy: Number(saved.recentAccuracy) || 0,
    letterCorrect: Object.fromEntries(letters.map((letter) => [letter, Number(saved.letterCorrect?.[letter]) || 0])),
    letterWrong: Object.fromEntries(letters.map((letter) => [letter, Number(saved.letterWrong?.[letter]) || 0])),
    typeCorrect: Object.fromEntries(PLAYABLE_TYPES.map((type) => [type, Number(saved.typeCorrect?.[type]) || 0])),
    history,
  }
}

function migrateDailySessions(savedSessions) {
  if (!savedSessions || typeof savedSessions !== 'object') return {}
  return Object.fromEntries(Object.entries(savedSessions).map(([date, sessionValue]) => {
    const session = sessionValue && typeof sessionValue === 'object' ? sessionValue : {}
    const targetCount = DAILY_TARGET_OPTIONS.includes(Number(session.targetCount)) ? Number(session.targetCount) : DEFAULT_DAILY_TARGET
    const allowedRewardStatuses = ['idle', 'pending', 'granted', 'already-granted', 'retry-needed']
    const savedRewardStatus = allowedRewardStatuses.includes(session.serverRewardStatus) ? session.serverRewardStatus : 'idle'
    return [date, {
      date,
      sessionId: session.sessionId || `hangul.${date}.${Math.max(0, Date.parse(session.startedAt) || 0)}`,
      targetCount,
      halfwayAt: Number(session.halfwayAt) || Math.ceil(targetCount / 2),
      completedCount: Math.min(targetCount, Math.max(0, Number(session.completedCount) || 0)),
      questionIds: Array.isArray(session.questionIds) ? session.questionIds : [],
      questionCategories: Array.isArray(session.questionCategories) ? session.questionCategories : [],
      completedQuestionIds: Array.isArray(session.completedQuestionIds) ? session.completedQuestionIds : [],
      results: Array.isArray(session.results) ? session.results : [],
      learnedLetters: Array.isArray(session.learnedLetters) ? session.learnedLetters : [],
      reviewLetters: Array.isArray(session.reviewLetters) ? session.reviewLetters : [],
      startedAt: session.startedAt || null,
      completedAt: session.completedAt || null,
      halfwayCelebrated: Boolean(session.halfwayCelebrated),
      paused: Boolean(session.paused),
      currentWrongAttempts: Number(session.currentWrongAttempts) || 0,
      completionRewardGranted: Boolean(session.completionRewardGranted),
      serverRewardStatus: savedRewardStatus === 'pending' ? 'retry-needed' : savedRewardStatus,
      serverRewardGrantedAt: session.serverRewardGrantedAt || null,
      serverCompletionId: session.serverCompletionId || null,
      serverRewardErrorCode: session.serverRewardErrorCode || null,
      serverRewardLastAttemptAt: session.serverRewardLastAttemptAt || null,
      status: session.status === 'completed' ? 'completed' : 'in-progress',
    }]
  }))
}

function migrateProgress(raw) {
  const source = raw && typeof raw === 'object' ? raw : {}
  const learning = source.learning && typeof source.learning === 'object' ? source.learning : {}
  const unlocked = [...new Set([1, ...(Array.isArray(learning.unlockedLetterLevels) ? learning.unlockedLetterLevels : [])])].map(Number).filter((level) => level >= 1 && level <= LETTER_LEVELS.length)
  const requestedLevel = Number(learning.currentLetterLevel) || 1
  const currentLetterLevel = unlocked.includes(requestedLevel) && getWordsForLevel(requestedLevel).length ? requestedLevel : 1
  const enabledQuestionTypes = Array.isArray(learning.enabledQuestionTypes)
    ? learning.enabledQuestionTypes.filter((type) => PLAYABLE_TYPES.includes(type))
    : [...PLAYABLE_TYPES]
  return {
    ...INITIAL,
    ...source,
    stars: Number(source.stars) || 0,
    room: typeof source.room === 'string' ? source.room : 'sunny',
    stickers: Array.isArray(source.stickers) ? source.stickers : [],
    equipped: Array.isArray(source.equipped) ? source.equipped : [],
    solved: Array.isArray(source.solved) ? source.solved : [],
    learning: {
      schemaVersion: 3,
      currentLetterLevel,
      unlockedLetterLevels: unlocked,
      manuallyUnlockedLevels: Array.isArray(learning.manuallyUnlockedLevels) ? learning.manuallyUnlockedLevels.map(Number) : [],
      difficultyMode: learning.difficultyMode === 'manual' ? 'manual' : 'auto',
      autoDifficultyLevel: Math.min(4, Math.max(1, Number(learning.autoDifficultyLevel) || 1)),
      selectedDifficultyLevel: Math.min(4, Math.max(1, Number(learning.selectedDifficultyLevel) || 1)),
      enabledQuestionTypes: enabledQuestionTypes.length ? enabledQuestionTypes : ['first-letter'],
      dailyTargetPreference: DAILY_TARGET_OPTIONS.includes(Number(learning.dailyTargetPreference)) ? Number(learning.dailyTargetPreference) : DEFAULT_DAILY_TARGET,
      dailySessions: migrateDailySessions(learning.dailySessions),
      levelStats: Object.fromEntries(LETTER_LEVELS.map(({ level }) => [level, emptyLevelStats(level, learning.levelStats?.[level])])),
    },
  }
}

function readProgress() {
  try { return migrateProgress(JSON.parse(localStorage.getItem(LEARNING_KEY))) } catch { return migrateProgress({}) }
}

function recordAttempt(progress, question, isCorrect) {
  const level = question.letterLevel
  const oldStats = progress.learning.levelStats[level] || emptyLevelStats(level)
  const correct = oldStats.correct + (isCorrect ? 1 : 0)
  const wrong = oldStats.wrong + (isCorrect ? 0 : 1)
  const history = [...oldStats.history, { correct: isCorrect, learningLetter: question.learningLetter, questionType: question.questionType, at: Date.now() }].slice(-15)
  const recentCorrect = history.filter((item) => item.correct).length
  const nextStats = {
    ...oldStats,
    correct,
    wrong,
    accuracy: Math.round((correct / Math.max(1, correct + wrong)) * 100),
    recentAccuracy: Math.round((recentCorrect / Math.max(1, history.length)) * 100),
    history,
    letterCorrect: { ...oldStats.letterCorrect, [question.learningLetter]: (oldStats.letterCorrect[question.learningLetter] || 0) + (isCorrect ? 1 : 0) },
    letterWrong: { ...oldStats.letterWrong, [question.learningLetter]: (oldStats.letterWrong[question.learningLetter] || 0) + (isCorrect ? 0 : 1) },
    typeCorrect: { ...oldStats.typeCorrect, [question.questionType]: (oldStats.typeCorrect[question.questionType] || 0) + (isCorrect ? 1 : 0) },
  }
  const lastTen = history.slice(-10)
  const levelReady = lastTen.length === 10
    && lastTen.filter((item) => item.correct).length >= 8
    && getLetterLevel(level).letters.every((letter) => (nextStats.letterCorrect[letter] || 0) >= 2)
  const nextLevel = level + 1
  const unlockedLevel = isCorrect && levelReady && nextLevel <= LETTER_LEVELS.length && !progress.learning.unlockedLetterLevels.includes(nextLevel) ? nextLevel : null
  const difficulty = progress.learning.autoDifficultyLevel
  const activeTypes = Object.keys(getActiveTypeWeights(difficulty, progress.learning.enabledQuestionTypes))
  const difficultyReady = progress.learning.difficultyMode === 'auto'
    && difficulty < 4
    && history.length >= 15
    && nextStats.recentAccuracy >= 80
    && activeTypes.every((type) => (nextStats.typeCorrect[type] || 0) >= 3)
  const unlockedDifficulty = isCorrect && difficultyReady ? difficulty + 1 : null
  const firstSolve = isCorrect && !progress.solved.some((entry) => entry?.id === question.id)
  return {
    progress: {
      ...progress,
      stars: progress.stars + (firstSolve ? 1 : 0) + (unlockedLevel ? LEVEL_UP_BONUS : 0),
      stickers: isCorrect && !progress.stickers.includes(question.learningLetter) ? [...progress.stickers, question.learningLetter] : progress.stickers,
      solved: firstSolve ? [...progress.solved, { id: question.id, letter: question.learningLetter, at: Date.now() }].slice(-200) : progress.solved,
      learning: {
        ...progress.learning,
        autoDifficultyLevel: unlockedDifficulty || progress.learning.autoDifficultyLevel,
        unlockedLetterLevels: unlockedLevel ? [...progress.learning.unlockedLetterLevels, unlockedLevel] : progress.learning.unlockedLetterLevels,
        levelStats: { ...progress.learning.levelStats, [level]: nextStats },
      },
    },
    firstSolve,
    unlockedLevel,
    unlockedDifficulty,
  }
}

function Bunny({ celebrating, equipped = [], room = 'sunny', small = false }) {
  return <div className={`bunny-stage room-${room} ${celebrating ? 'celebrating' : ''} ${small ? 'small' : ''}`} aria-label="웃고 있는 하얀 토끼 다롱이"><span className="cloud cloud-one" /><span className="cloud cloud-two" /><div className="bunny-shadow" /><div className="bunny"><div className="ear ear-left"><span /></div><div className="ear ear-right"><span /></div>{equipped.includes('crown') && <div className="crown"><i /><i /><i /></div>}{equipped.includes('ribbon') && <div className="ribbon"><i /><i /><b /></div>}{equipped.includes('cape') && <div className="cape" />}<div className="body"><span className="belly" /></div><div className="arm arm-left" /><div className="arm arm-right" /><div className="head"><span className="brow brow-left" /><span className="brow brow-right" /><span className="eye eye-left" /><span className="eye eye-right" /><span className="cheek cheek-left" /><span className="cheek cheek-right" /><span className="nose" /><span className="mouth" /></div><div className="foot foot-left" /><div className="foot foot-right" /></div></div>
}
function Confetti() { return <div className="confetti" aria-hidden="true">{Array.from({ length: 22 }, (_, index) => <i key={index} style={{ '--i': index }} />)}</div> }

function WordDisplay({ question, complete }) {
  if (question.questionType === 'full-word') return <div className={`word-display full-word-display ${complete ? 'complete' : ''}`} aria-label={complete ? question.word : '그림에 맞는 낱말 고르기'}>{complete ? question.syllables.map((syllable, index) => <span className="completed-syllable" key={`${syllable}-${index}`} style={{ '--accent': question.color }}>{syllable}</span>) : <span className="word-question">어떤 낱말일까요?</span>}</div>
  return <div className={`word-display ${complete ? 'complete' : ''}`} aria-label={complete ? question.word : question.displaySyllables.join('').replace('□', '빈칸')}>{question.displaySyllables.map((syllable, index) => syllable === '□' ? <span className="word-blank" key={`blank-${index}`} style={{ '--accent': question.color }}>{complete ? question.answer : '?'}</span> : <span key={`${syllable}-${index}`}>{syllable}</span>)}</div>
}

function App() {
  const [progress, setProgress] = useState(readProgress)
  const [today, setToday] = useState(getKoreanDate)
  const initialDailySession = progress.learning.dailySessions[today]
  const [playMode, setPlayMode] = useState(initialDailySession?.status === 'in-progress' ? 'daily' : 'daily')
  const [screen, setScreen] = useState(() => {
    if (!initialDailySession) return 'daily-start'
    if (initialDailySession.status === 'completed') return 'daily-complete'
    if (initialDailySession.completedCount >= initialDailySession.halfwayAt && !initialDailySession.halfwayCelebrated) return 'halfway'
    if (initialDailySession.paused) return 'daily-start'
    return 'play'
  })
  const recentRounds = useRef([])
  const [question, setQuestion] = useState(() => {
    const dailyId = initialDailySession?.questionIds?.[initialDailySession.completedCount]
    return dailyId ? createQuestionFromId({ id: dailyId }) : generateQuestion({ progress, level: progress.learning.currentLetterLevel })
  })
  const [status, setStatus] = useState('ready')
  const [wrongChoice, setWrongChoice] = useState(null)
  const [imageFailed, setImageFailed] = useState(false)
  const [notice, setNotice] = useState('그림을 보고 알맞은 답을 찾아보자!')
  const [celebration, setCelebration] = useState(null)
  const [soundPanelOpen, setSoundPanelOpen] = useState(false)
  const [backupNotice, setBackupNotice] = useState('')
  const nextTimer = useRef(null)
  const unlockTimer = useRef(null)
  const effectTimers = useRef([])
  const answeringRef = useRef(false)
  const sessionStartRef = useRef(false)
  const progressRef = useRef(progress)
  const rewardRequestsRef = useRef(new Set())
  const rewardRetryTimerRef = useRef(null)
  const { soundSettings, updateSound, playEffect } = useGameAudio()
  const currentLevel = progress.learning.currentLetterLevel
  const levelInfo = getLetterLevel(currentLevel)
  const nextLevelInfo = LETTER_LEVELS[currentLevel] || null
  const levelStats = progress.learning.levelStats[currentLevel]
  const activeDifficulty = progress.learning.difficultyMode === 'manual' ? progress.learning.selectedDifficultyLevel : progress.learning.autoDifficultyLevel
  const todaySession = progress.learning.dailySessions[today]
  const yesterdayReviewLetters = getYesterdayReviewLetters(progress, today)
  const streak = calculateStreak(progress.learning.dailySessions, today)
  const dailySummary = summarizeDailySession(todaySession)
  const dailyProgressPercent = todaySession ? Math.round((todaySession.completedCount / todaySession.targetCount) * 100) : 0

  useEffect(() => {
    progressRef.current = progress
    localStorage.setItem(LEARNING_KEY, JSON.stringify(progress))
  }, [progress])
  useEffect(() => () => { clearTimeout(nextTimer.current); clearTimeout(unlockTimer.current); clearTimeout(rewardRetryTimerRef.current); effectTimers.current.forEach(clearTimeout) }, [])
  useEffect(() => { if (screen !== 'play') { clearTimeout(nextTimer.current); clearTimeout(unlockTimer.current); answeringRef.current = false } }, [screen])
  useEffect(() => {
    const timer = window.setInterval(() => {
      const nextDate = getKoreanDate()
      if (nextDate !== today) {
        clearTimeout(nextTimer.current)
        clearTimeout(unlockTimer.current)
        setToday(nextDate)
        sessionStartRef.current = false
        setPlayMode('daily')
        setScreen('daily-start')
        answeringRef.current = false
      }
    }, 60000)
    return () => clearInterval(timer)
  }, [today])
  useEffect(() => {
    const retry = () => {
      const session = progressRef.current.learning.dailySessions[getKoreanDate()]
      if (session?.serverRewardStatus === 'retry-needed') void requestStudySticker(session)
    }
    retry()
    window.addEventListener('online', retry)
    return () => window.removeEventListener('online', retry)
  }, [])
  useEffect(() => {
    function handleKeyDown(event) { const number = Number(event.key); if (screen === 'play' && status === 'ready' && number >= 1 && number <= 4) choose(question.choices[number - 1]) }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })
  const unlockedRewards = useMemo(() => REWARDS.filter((item) => progress.stars >= item.need), [progress.stars])

  function nextQuestion(nextProgress, previous = question) {
    recentRounds.current = [...recentRounds.current, { id: previous.id, wordId: previous.wordId, answer: previous.answer, correctIndex: previous.correctIndex }].slice(-8)
    setQuestion(generateQuestion({ progress: nextProgress, level: nextProgress.learning.currentLetterLevel, recentRounds: recentRounds.current, previousCorrectIndex: previous.correctIndex }))
    setStatus('ready'); setWrongChoice(null); setImageFailed(false); setNotice('새 그림이야! 알맞은 답을 골라 보자!'); answeringRef.current = false
  }

  function loadDailyQuestion(nextProgress, session, previousCorrectIndex = question.correctIndex) {
    const id = session.questionIds[session.completedCount]
    if (!id) return
    setQuestion(createQuestionFromId({ id, previousCorrectIndex }))
    setStatus('ready'); setWrongChoice(null); setImageFailed(false); setNotice('오늘의 다음 그림이야! 알맞은 답을 골라 보자!'); answeringRef.current = false
  }

  function startDailyLearning() {
    let session = progress.learning.dailySessions[today]
    let nextProgress = progress
    if (!session) {
      if (sessionStartRef.current) return
      sessionStartRef.current = true
      session = createDailySession(progress, today)
      nextProgress = { ...progress, learning: { ...progress.learning, dailySessions: { ...progress.learning.dailySessions, [today]: session } } }
      setProgress(nextProgress)
    }
    if (session.status === 'completed') { setScreen('daily-complete'); return }
    if (session.completedCount >= session.halfwayAt && !session.halfwayCelebrated) { setScreen('halfway'); return }
    const resumed = { ...session, paused: false }
    if (session.paused) {
      nextProgress = { ...nextProgress, learning: { ...nextProgress.learning, dailySessions: { ...nextProgress.learning.dailySessions, [today]: resumed } } }
      setProgress(nextProgress)
      session = resumed
    }
    setPlayMode('daily')
    loadDailyQuestion(nextProgress, session, null)
    setScreen('play')
  }

  function continueAfterHalfway() {
    const session = progress.learning.dailySessions[today]
    if (!session) return
    const resumed = { ...session, halfwayCelebrated: true, paused: false }
    const nextProgress = { ...progress, learning: { ...progress.learning, dailySessions: { ...progress.learning.dailySessions, [today]: resumed } } }
    setProgress(nextProgress)
    setPlayMode('daily')
    loadDailyQuestion(nextProgress, resumed, question.correctIndex)
    setScreen('play')
  }

  function pauseAtHalfway() {
    const session = progress.learning.dailySessions[today]
    if (!session) return
    const paused = { ...session, halfwayCelebrated: true, paused: true }
    setProgress((old) => ({ ...old, learning: { ...old.learning, dailySessions: { ...old.learning.dailySessions, [today]: paused } } }))
    setScreen('daily-start')
  }

  function startFreePlay() {
    setPlayMode('free')
    setQuestion(generateQuestion({ progress, level: progress.learning.currentLetterLevel, recentRounds: recentRounds.current }))
    setStatus('ready'); setWrongChoice(null); setImageFailed(false); setNotice('이제 자유롭게 더 놀아 보자!'); answeringRef.current = false
    setScreen('play')
  }

  function completeDailyQuestion(baseProgress, result) {
    const completion = finishDailyQuestion(baseProgress, today, question)
    const milestone = completion.session.status === 'completed' ? 'complete' : completion.session.completedCount === completion.session.halfwayAt && !completion.session.halfwayCelebrated ? 'halfway' : result.unlockedLevel || result.unlockedDifficulty ? 'achievement' : null
    return { ...completion, milestone }
  }

  function updateSessionReward(studyDate, sessionId, updates) {
    setProgress((old) => {
      const session = old.learning.dailySessions[studyDate]
      if (!session || session.sessionId !== sessionId) return old
      return { ...old, learning: { ...old.learning, dailySessions: { ...old.learning.dailySessions, [studyDate]: { ...session, ...updates } } } }
    })
  }

  async function requestStudySticker(session) {
    const studyDate = session?.date
    const storedSession = progressRef.current.learning.dailySessions[studyDate]
    if (storedSession?.sessionId === session?.sessionId && storedSession.status === 'completed') session = storedSession
    if (studyDate !== getKoreanDate() || session?.status !== 'completed' || session?.targetCount !== 20 || session?.completedCount !== 20) return
    if (['granted', 'already-granted'].includes(session.serverRewardStatus) || rewardRequestsRef.current.has(session.sessionId)) return
    const elapsed = Date.now() - Date.parse(session.serverRewardLastAttemptAt || 0)
    if (Number.isFinite(elapsed) && elapsed >= 0 && elapsed < 30000) {
      clearTimeout(rewardRetryTimerRef.current)
      rewardRetryTimerRef.current = window.setTimeout(() => requestStudySticker(session), 30000 - elapsed)
      return
    }
    rewardRequestsRef.current.add(session.sessionId)
    updateSessionReward(studyDate, session.sessionId, { serverRewardStatus: 'pending', serverRewardErrorCode: null, serverRewardLastAttemptAt: new Date().toISOString() })
    try {
      const result = await onDailyLearningCompleted({
        mode: 'daily',
        studyDate,
        targetCount: session.targetCount,
        completedCount: session.completedCount,
        sessionId: session.sessionId,
        questionIds: session.questionIds.map((id, index) => `${index}:${id}`),
        completedQuestionIds: session.completedQuestionIds,
        results: session.results,
      })
      updateSessionReward(studyDate, session.sessionId, {
        serverRewardStatus: result.status,
        serverRewardGrantedAt: result.status === 'granted' ? new Date().toISOString() : session.serverRewardGrantedAt,
        serverCompletionId: result.completionId,
        serverRewardErrorCode: null,
      })
    } catch (error) {
      updateSessionReward(studyDate, session.sessionId, { serverRewardStatus: 'retry-needed', serverRewardErrorCode: error.code || 'HANGUL_COMPLETION_FAILED' })
    } finally {
      rewardRequestsRef.current.delete(session.sessionId)
    }
  }

  function choose(choice) {
    if (answeringRef.current || status !== 'ready') return
    answeringRef.current = true
    playEffect('select')
    const isCorrect = choice === question.answer
    const result = recordAttempt(progress, question, isCorrect)
    if (isCorrect) {
      const dailyResult = playMode === 'daily' ? completeDailyQuestion(result.progress, result) : null
      let nextProgress = dailyResult?.progress || result.progress
      if (dailyResult?.rewardGranted) {
        const rewardReadySession = dailyResult.session.targetCount === 20
          ? { ...dailyResult.session, serverRewardStatus: 'retry-needed' }
          : dailyResult.session
        nextProgress = { ...nextProgress, learning: { ...nextProgress.learning, dailySessions: { ...nextProgress.learning.dailySessions, [today]: rewardReadySession } } }
        dailyResult.session = rewardReadySession
        if (rewardReadySession.targetCount === 20) void requestStudySticker(rewardReadySession)
      }
      setProgress(nextProgress)
      setStatus('correct'); setWrongChoice(null); setNotice(`딩동댕! 그림 속 낱말은 ‘${question.word}’예요!`)
      effectTimers.current.push(window.setTimeout(() => playEffect('correct'), 70))
      if (result.firstSolve) effectTimers.current.push(window.setTimeout(() => playEffect('star'), 420))
      nextTimer.current = window.setTimeout(() => {
        if (dailyResult?.milestone === 'complete') {
          playEffect('fanfare')
          setScreen('daily-complete')
        } else if (dailyResult?.milestone === 'halfway') {
          playEffect('difficulty')
          setScreen('halfway')
        } else if (result.unlockedLevel || result.unlockedDifficulty) {
          setCelebration({ level: result.unlockedLevel, difficulty: result.unlockedDifficulty })
          playEffect(result.unlockedLevel ? 'levelUp' : 'difficulty')
          setScreen('achievement')
        } else if (playMode === 'daily') {
          loadDailyQuestion(nextProgress, dailyResult.session, question.correctIndex)
        } else nextQuestion(nextProgress)
      }, 2250)
    } else {
      let nextProgress = result.progress
      if (playMode === 'daily') {
        const session = nextProgress.learning.dailySessions[today]
        const updatedSession = { ...session, currentWrongAttempts: (Number(session?.currentWrongAttempts) || 0) + 1 }
        nextProgress = { ...nextProgress, learning: { ...nextProgress.learning, dailySessions: { ...nextProgress.learning.dailySessions, [today]: updatedSession } } }
      }
      setProgress(nextProgress)
      setStatus('wrong'); setWrongChoice(choice); setNotice('괜찮아! 그림을 다시 잘 살펴보자.'); effectTimers.current.push(window.setTimeout(() => playEffect('wrong'), 70))
      unlockTimer.current = window.setTimeout(() => { setStatus('ready'); setWrongChoice(null); answeringRef.current = false }, 500)
    }
  }

  function startLevel(level) {
    const info = getLetterLevel(level)
    if (!progress.learning.unlockedLetterLevels.includes(level) || !info.available || !getWordsForLevel(level).length) return
    const nextProgress = { ...progress, learning: { ...progress.learning, currentLetterLevel: level } }
    recentRounds.current = []
    setProgress(nextProgress); setPlayMode('free'); setQuestion(generateQuestion({ progress: nextProgress, level })); setStatus('ready'); setWrongChoice(null); setImageFailed(false); setNotice(`${level}단계 글자를 자유롭게 연습해 보자!`); answeringRef.current = false; setScreen('play')
  }
  function goDailyHome() {
    const session = progress.learning.dailySessions[today]
    if (!session) setScreen('daily-start')
    else if (session.status === 'completed') setScreen('daily-complete')
    else if (session.completedCount >= session.halfwayAt && !session.halfwayCelebrated) setScreen('halfway')
    else setScreen('daily-start')
  }
  function resumeAfterAchievement() {
    const session = progress.learning.dailySessions[today]
    if (playMode === 'daily' && session?.status === 'in-progress') {
      loadDailyQuestion(progress, session, question.correctIndex)
      setScreen('play')
    } else {
      setScreen('play')
      nextQuestion(progress)
    }
  }
  function manuallyUnlock(level) { if (!progress.learning.unlockedLetterLevels.includes(level)) setProgress((old) => ({ ...old, learning: { ...old.learning, unlockedLetterLevels: [...old.learning.unlockedLetterLevels, level].sort((a, b) => a - b), manuallyUnlockedLevels: [...new Set([...old.learning.manuallyUnlockedLevels, level])] } })) }
  function updateLearning(patch) {
    const nextProgress = { ...progress, learning: { ...progress.learning, ...patch } }
    setProgress(nextProgress)
    const level = nextProgress.learning.currentLetterLevel
    setQuestion(generateQuestion({ progress: nextProgress, level, recentRounds: recentRounds.current }))
    setStatus('ready'); answeringRef.current = false
  }
  function toggleQuestionType(type) {
    const enabled = progress.learning.enabledQuestionTypes
    if (enabled.includes(type) && enabled.length === 1) return
    updateLearning({ enabledQuestionTypes: enabled.includes(type) ? enabled.filter((item) => item !== type) : [...enabled, type] })
  }
  function toggleReward(id) { const reward = REWARDS.find((item) => item.id === id); if (progress.stars < reward.need) return; playEffect('equip'); setProgress((old) => ({ ...old, equipped: old.equipped.includes(id) ? old.equipped.filter((item) => item !== id) : [...old.equipped, id] })) }
  function chooseRoom(id) { playEffect('equip'); setProgress((old) => ({ ...old, room: id })) }
  function exportLearningBackup() {
    try {
      const filename = downloadBackup(createBackupFromStorage({ progressKey: LEARNING_KEY, soundKey: soundStorageKey() }))
      setBackupNotice(`${filename} 파일로 안전하게 내보냈어요.`)
    } catch (error) {
      setBackupNotice(error.message || '학습 기록을 내보내지 못했습니다.')
    }
  }

  return <main className="app-shell">
    <header className="topbar"><button className="brand" onClick={goDailyHome} aria-label="오늘의 한글 놀이로 가기"><span className="brand-mark">ㄱ</span><span><b>다율이의</b><strong>한글 놀이터</strong></span></button><div className="header-actions"><a className="tracker-return" href="/?tab=today">학습 스티커로 돌아가기</a><div className="star-pill" aria-label={`별 ${progress.stars}개`}><span>★</span><b>{progress.stars}</b></div><button className="sound-button" onClick={() => setSoundPanelOpen((open) => !open)} aria-expanded={soundPanelOpen}><span>{soundSettings.soundEnabled ? '🔊' : '🔇'}</span><b>{soundSettings.soundEnabled ? '소리 켜짐' : '소리 꺼짐'}</b></button><button className="settings-button" onClick={() => setScreen('settings')}><span>⚙</span><b>학습 설정</b></button><button className={`wardrobe-button ${screen === 'wardrobe' ? 'active' : ''}`} onClick={() => screen === 'wardrobe' ? goDailyHome() : setScreen('wardrobe')}><span>{screen === 'wardrobe' ? '한글' : '옷장'}</span><b>{screen === 'wardrobe' ? '돌아가기' : '꾸미기'}</b></button></div></header>
    {soundPanelOpen && <aside className="sound-panel" aria-label="소리 상세 설정"><div className="sound-panel-title"><b>소리 설정</b><button onClick={() => setSoundPanelOpen(false)} aria-label="소리 설정 닫기">×</button></div><label className="sound-toggle"><span>전체 소리</span><input type="checkbox" checked={soundSettings.soundEnabled} onChange={(event) => updateSound({ soundEnabled: event.target.checked })} /></label><label className="sound-toggle"><span>배경음악</span><input type="checkbox" checked={soundSettings.musicEnabled} disabled={!soundSettings.soundEnabled} onChange={(event) => updateSound({ musicEnabled: event.target.checked })} /></label><label><span>배경음악 음량</span><input type="range" min="0" max="1" step="0.05" value={soundSettings.musicVolume} disabled={!soundSettings.soundEnabled || !soundSettings.musicEnabled} onChange={(event) => updateSound({ musicVolume: Number(event.target.value) })} /></label><label className="sound-toggle"><span>게임 효과음</span><input type="checkbox" checked={soundSettings.effectsEnabled} disabled={!soundSettings.soundEnabled} onChange={(event) => updateSound({ effectsEnabled: event.target.checked })} /></label><label><span>효과음 음량</span><input type="range" min="0" max="1" step="0.05" value={soundSettings.effectsVolume} disabled={!soundSettings.soundEnabled || !soundSettings.effectsEnabled} onChange={(event) => updateSound({ effectsVolume: Number(event.target.value) })} /></label><small>음악은 화면을 벗어나면 자동으로 쉬어요.</small></aside>}

    {screen === 'daily-start' && <section className="daily-start-screen"><div className="daily-welcome"><span className="daily-date">{today}</span><Bunny equipped={progress.equipped} room={progress.room} small /><div><span className="eyebrow">오늘의 한글 여행</span><h1>오늘도 다롱이와<br />한글 여행을 떠나볼까?</h1><p>조금씩 꾸준히 만나면 한글이 더 친해져요.</p></div></div><div className="daily-plan-card"><div className="daily-goal"><span>오늘의 목표</span><strong>{todaySession?.targetCount || progress.learning.dailyTargetPreference}문제</strong><small>약 10~15분</small></div>{todaySession?.status === 'in-progress' && <div className="resume-progress"><div><span>오늘 {todaySession.completedCount} / {todaySession.targetCount}문제</span><b>{dailyProgressPercent}%</b></div><i><span style={{ width: `${dailyProgressPercent}%` }} /></i></div>}<div className="daily-preview"><div><small>오늘 배울 글자</small><strong>{levelInfo.letters.join(' · ')}</strong></div><div><small>어제 어려웠던 글자</small><strong>{yesterdayReviewLetters.length ? yesterdayReviewLetters.join(' · ') : '오늘 새롭게 만나 봐요'}</strong></div></div><div className="daily-mix"><span>새 학습 40%</span><span>복습 30%</span><span>유지 30%</span></div><button className="daily-start-button" onClick={startDailyLearning}>{todaySession?.status === 'in-progress' ? `${todaySession.completedCount + 1}번째 문제부터 이어하기` : '오늘의 한글 놀이 시작'}</button>{streak > 0 && <p className="streak-note">🌱 {streak}일째 즐겁게 이어가고 있어요!</p>}</div></section>}

    {screen === 'halfway' && <section className="complete-screen halfway-screen"><Confetti /><span className="level-medal">1차 학습 완료</span><Bunny celebrating equipped={progress.equipped} room={progress.room} small /><span className="complete-stars">★ 절반 도착! ★</span><p>벌써 절반이나 했어!</p><h1>{todaySession?.completedCount}문제를<br />멋지게 끝냈어요</h1><div className="break-message">물도 한 모금 마시고, 몸도 쭉 펴 봐요.</div><div className="complete-actions"><button onClick={pauseAtHalfway}>잠깐 쉬기</button><button onClick={continueAfterHalfway}>계속하기</button></div></section>}

    {screen === 'daily-complete' && <section className="complete-screen daily-complete-screen"><Confetti /><span className="level-medal">TODAY COMPLETE</span><Bunny celebrating equipped={progress.equipped} room={progress.room} small /><span className="complete-stars">★ +{DAILY_COMPLETION_REWARD}</span><p>한글 별 +{DAILY_COMPLETION_REWARD} · 토끼 꾸미기 전용</p><h1>다율이가 오늘의<br />한글 여행을 완료했어요!</h1><div className="daily-result-grid"><div><small>완료한 문제</small><strong>{todaySession?.completedCount || 0}개</strong></div><div><small>오늘 배운 글자</small><strong>{dailySummary.learnedLetters.join(' · ') || levelInfo.letters.join(' · ')}</strong></div><div><small>다음에 한 번 더 만나볼 글자</small><strong>{dailySummary.reviewLetters.join(' · ') || '모두 반가웠어요!'}</strong></div></div>{todaySession?.targetCount === 20 ? <div className={`study-sticker-status ${todaySession.serverRewardStatus || 'idle'}`} role="status"><b>학습 스티커 +2 · 기존 보상상점</b><span>{todaySession.serverRewardStatus === 'pending' ? '학습 스티커를 적립하고 있어요.' : todaySession.serverRewardStatus === 'granted' ? '학습 스티커 2개를 받았어요!' : todaySession.serverRewardStatus === 'already-granted' ? '오늘의 학습 스티커는 이미 받았어요.' : todaySession.serverRewardStatus === 'retry-needed' ? '인터넷에 연결되면 학습 스티커를 적립할게요.' : '가져온 기록과 기존 완료 기록에는 소급 지급하지 않아요.'}</span><a href="/?tab=rewards">학습 스티커 확인하기</a></div> : <div className="study-sticker-status idle"><b>학습 스티커는 20문제 목표에서만 지급돼요</b><span>한글 별은 목표 수와 관계없이 토끼 꾸미기에만 사용해요.</span></div>}<div className="complete-actions daily-complete-actions"><button onClick={() => setScreen('today-done')}>오늘은 여기까지</button><button onClick={startFreePlay}>자유롭게 더 놀기</button><button onClick={() => setScreen('wardrobe')}>토끼 옷장 구경하기</button></div></section>}

    {screen === 'today-done' && <section className="today-done-screen"><Bunny equipped={progress.equipped} room={progress.room} small /><span>오늘도 정말 즐거웠어!</span><h1>다롱이와 내일 또 만나요</h1><p>쉬는 시간도 한글 여행의 소중한 부분이에요.</p><div><button onClick={startFreePlay}>조금 더 놀기</button><button onClick={() => setScreen('wardrobe')}>옷장 구경하기</button></div></section>}

    {screen === 'play' && <section className="play-layout picture-quiz" style={{ '--accent': question.color }}><div className="story-panel"><div className="progress-row"><span>{playMode === 'daily' ? `${todaySession?.completedCount || 0} / ${todaySession?.targetCount || progress.learning.dailyTargetPreference} · ${todaySession && todaySession.completedCount < todaySession.halfwayAt ? '1차 학습' : '2차 학습'}` : `자유 놀이 · 글자 ${currentLevel}단계`}</span><div className="progress-dots">{levelInfo.letters.map((letter) => <i key={letter} className={(levelStats.letterCorrect[letter] || 0) >= 2 ? 'mastered' : ''} />)}</div></div><Bunny celebrating={status === 'correct'} equipped={progress.equipped} room={progress.room} /><div className={`speech-card ${status}`} role="status" aria-live="polite"><span className="speech-name">다롱이</span><strong>{notice}</strong></div></div><div className="game-panel quiz-panel">{playMode === 'daily' && todaySession && <div className="daily-play-progress"><div><strong>오늘 {Math.min(todaySession.completedCount + (status === 'correct' ? 0 : 1), todaySession.targetCount)} / {todaySession.targetCount}문제</strong><span>{todaySession.completedCount < todaySession.halfwayAt ? '1차 학습' : '2차 학습'}</span></div><i><span style={{ width: `${dailyProgressPercent}%` }} /></i></div>}<div className="learning-strip"><div><small>지금 배우는 글자</small><strong>{levelInfo.letters.join(' · ')}</strong></div><span>→</span><div className={!nextLevelInfo || !progress.learning.unlockedLetterLevels.includes(nextLevelInfo.level) ? 'locked' : ''}><small>다음 글자</small><strong>{nextLevelInfo ? nextLevelInfo.letters.join(' · ') : '모두 완료!'}</strong></div></div><div className="quiz-heading"><span className="eyebrow">{QUESTION_TYPES.find((item) => item.id === question.questionType)?.name} · 난이도 {activeDifficulty}</span><h1>{question.questionType === 'full-word' ? '그림의 이름은 뭘까?' : '빈칸을 채워 볼까?'}</h1></div><div className={`picture-card ${status === 'correct' ? 'correct' : ''}`}>{imageFailed ? <div className="image-fallback" role="img" aria-label={`${question.imageAlt} 그림을 불러오지 못함`}><span>{question.word.slice(0, 1)}</span><b>그림을 준비하고 있어요</b><small>낱말을 보고 맞혀도 괜찮아요!</small></div> : <img src={question.image} alt={question.imageAlt} onError={() => setImageFailed(true)} />}</div><WordDisplay question={question} complete={status === 'correct'} /><div className={`choices ${question.questionType === 'full-word' ? 'word-choices' : ''}`} aria-label="정답 보기">{question.choices.map((choice, index) => <button key={choice} type="button" onClick={() => choose(choice)} disabled={status !== 'ready'} className={`${status === 'correct' && choice === question.answer ? 'answer' : ''} ${wrongChoice === choice ? 'wrong-choice' : ''}`} style={{ '--choice': question.color }} aria-label={`${index + 1}번 ${choice}`}><small>{index + 1}</small><b>{choice}</b><i>●</i></button>)}</div><p className="kind-note">{playMode === 'daily' ? '정답을 찾으면 오늘의 한 문제가 완성돼요' : '자유 놀이는 오늘의 문제 수에 포함되지 않아요'}</p></div>{status === 'correct' && <Confetti />}</section>}

    {screen === 'achievement' && <section className="complete-screen level-up-screen"><Confetti /><span className="level-medal">{celebration?.level ? `LETTER LEVEL ${celebration.level}` : `QUIZ LEVEL ${celebration?.difficulty}`}</span><Bunny celebrating equipped={progress.equipped} room={progress.room} small /><span className="complete-stars">{celebration?.level ? `★ +${LEVEL_UP_BONUS}` : '✦ 새로운 문제 ✦'}</span><p>{celebration?.level ? '새 글자 단계가 열렸어요!' : '새 문제 난이도가 열렸어요!'}</p><h1>{celebration?.level ? getLetterLevel(celebration.level).letters.join(' · ') : DIFFICULTY_NAMES[celebration?.difficulty]}</h1><div className="unlock-rules"><b>정확하게 차근차근 연습해서 열었어요</b>{celebration?.level ? <><span>최근 10문제 정확도 80% 이상</span><span>모든 글자를 2번 이상 정답</span></> : <><span>최근 15문제 정확도 80% 이상</span><span>활성 문제 유형을 각각 3번 이상 성공</span></>}</div><div className="complete-actions">{celebration?.level && getLetterLevel(celebration.level).available && <button onClick={() => startLevel(celebration.level)}>새 글자 만나기</button>}<button onClick={resumeAfterAchievement}>계속 놀이하기</button></div></section>}

    {screen === 'settings' && <section className="settings-layout"><div className="settings-heading"><span className="eyebrow">보호자 학습 설정</span><h1>다율이에게 맞춰 주세요</h1><p>배우는 글자와 문제 방식은 서로 따로 조절할 수 있어요.</p></div><section className="settings-card"><div className="section-title"><div><small>글자 레벨</small><h2>어떤 글자를 배울까요?</h2></div><span>현재 {currentLevel}단계</span></div><div className="level-grid">{LETTER_LEVELS.map((item) => { const unlocked = progress.learning.unlockedLetterLevels.includes(item.level); const stats = progress.learning.levelStats[item.level]; return <article key={item.level} className={`${unlocked ? 'unlocked' : 'locked'} ${currentLevel === item.level ? 'current' : ''}`}><div className="level-number">{item.level}</div><div className="level-info"><b>{item.title}</b><strong>{item.letters.join(' · ')}</strong><small>{item.available ? `단어 ${getWordsForLevel(item.level).length}개 · 정확도 ${stats.accuracy}%` : '문제 콘텐츠 준비 중'}</small></div><div className="level-actions">{unlocked ? <button disabled={!item.available || currentLevel === item.level} onClick={() => startLevel(item.level)}>{currentLevel === item.level ? '학습 중' : item.available ? '선택' : '준비 중'}</button> : <button className="parent-unlock" onClick={() => manuallyUnlock(item.level)}>부모 해금</button>}</div></article> })}</div></section>
      <section className="settings-card"><div className="section-title"><div><small>문제 난이도</small><h2>문제 방식을 골라 주세요</h2></div><span>{progress.learning.difficultyMode === 'auto' ? `자동 ${progress.learning.autoDifficultyLevel}단계` : `직접 ${progress.learning.selectedDifficultyLevel}단계`}</span></div><div className="mode-switch"><button className={progress.learning.difficultyMode === 'auto' ? 'selected' : ''} onClick={() => updateLearning({ difficultyMode: 'auto' })}>자동 난이도</button><button className={progress.learning.difficultyMode === 'manual' ? 'selected' : ''} onClick={() => updateLearning({ difficultyMode: 'manual' })}>직접 선택</button></div><div className="difficulty-levels">{Object.keys(DIFFICULTY_MIXES).map(Number).map((level) => <button key={level} disabled={progress.learning.difficultyMode === 'auto'} className={activeDifficulty === level ? 'selected' : ''} onClick={() => updateLearning({ selectedDifficultyLevel: level })}><b>{level}단계</b><small>{DIFFICULTY_NAMES[level]}</small><span>{Object.entries(DIFFICULTY_MIXES[level]).map(([type, ratio]) => `${QUESTION_TYPES.find((item) => item.id === type)?.name} ${Math.round(ratio * 100)}%`).join(' · ')}</span></button>)}</div><h3 className="type-heading">사용할 문제 유형</h3><div className="difficulty-grid">{QUESTION_TYPES.map((type) => { const active = progress.learning.enabledQuestionTypes.includes(type.id); return <button key={type.id} disabled={!type.available} className={active ? 'selected' : ''} onClick={() => toggleQuestionType(type.id)}><span>{type.available ? active ? '✓' : '○' : '🔒'}</span><b>{type.name}</b><small>{type.description}</small><em>{type.available ? active ? '사용 중' : '사용 안 함' : '확장 예정'}</em></button> })}</div><p className="auto-rule">자동 상승: 최근 15문제 정확도 80% 이상 + 활성 유형마다 3회 이상 성공</p></section>
      <section className="settings-card daily-settings-card"><div className="section-title"><div><small>일일 학습</small><h2>하루에 몇 문제를 만날까요?</h2></div><span>다음 학습부터 적용</span></div><div className="target-options">{DAILY_TARGET_OPTIONS.map((target) => <button key={target} className={progress.learning.dailyTargetPreference === target ? 'selected' : ''} onClick={() => updateLearning({ dailyTargetPreference: target })}><b>{target}</b><small>문제</small></button>)}</div><p>기본 목표는 20문제예요. 이미 시작한 오늘의 목표는 바뀌지 않고, 다음 날 새 학습부터 적용돼요.</p></section>
      <section className="settings-card history-card"><div className="section-title"><div><small>학습 기록</small><h2>날짜별 한글 여행</h2></div><span>연속 학습 {streak}일</span></div>{Object.keys(progress.learning.dailySessions).length ? <div className="history-list">{Object.entries(progress.learning.dailySessions).sort(([left], [right]) => right.localeCompare(left)).slice(0, 14).map(([date, session]) => { const summary = summarizeDailySession(session); return <article key={date}><div className={`history-status ${session.status}`}><b>{date}</b><span>{session.status === 'completed' ? '완료' : '진행 중'}</span></div><div className="history-numbers"><span>{session.completedCount} / {session.targetCount}문제</span><span>정답 {summary.correct}</span><span>다시 고른 횟수 {summary.wrong}</span></div><div className="history-letters"><small>학습 글자</small><b>{summary.learnedLetters.join(' · ') || '-'}</b><small>다음에 또 만날 글자</small><b>{summary.reviewLetters.join(' · ') || '-'}</b></div><time>{session.startedAt ? new Date(session.startedAt).toLocaleString('ko-KR') : '-'} → {session.completedAt ? new Date(session.completedAt).toLocaleString('ko-KR') : '학습 중'}</time></article> })}</div> : <div className="empty-history">첫 번째 오늘의 한글 여행을 기다리고 있어요.</div>}<p className="streak-help">완료한 날만 차곡차곡 이어져요. 쉬어 간 날이 있어도 다시 오늘부터 시작하면 돼요.</p></section>
      <section className="settings-card backup-card"><div className="section-title"><div><small>기록 보관</small><h2>학습 기록 내보내기</h2></div></div><p>현재 기기의 한글 학습 기록과 소리 설정만 JSON 파일로 저장합니다. 가족 로그인 정보나 PIN은 포함하지 않습니다.</p><button type="button" className="backup-action" onClick={exportLearningBackup}>학습 기록 내보내기</button>{backupNotice && <p className="backup-notice" role="status">{backupNotice}</p>}</section>
      <ImportBackupPanel onImported={(importedProgress, importedSound) => { setProgress(migrateProgress(importedProgress)); updateSound(importedSound) }} />
    </section>}

    {screen === 'wardrobe' && <section className="wardrobe-layout"><div className="wardrobe-intro"><span className="eyebrow">다롱이의 비밀 옷장</span><h1>별을 모아 예쁘게 꾸며요</h1><p>해금한 아이템을 눌러 입히고, 마음에 드는 방도 골라 보세요.</p></div><div className="dress-preview"><Bunny equipped={progress.equipped} room={progress.room} small /><div className="sticker-book"><span>내 한글 스티커</span><div>{LETTER_LEVELS.slice(0, 3).flatMap((item) => item.letters).map((letter) => <i key={letter} className={progress.stickers.includes(letter) ? 'owned' : ''}>{progress.stickers.includes(letter) ? letter : '?'}</i>)}</div></div></div><div className="closet-sections"><section><h2>토끼 옷</h2><div className="item-grid">{REWARDS.map((item) => { const locked = progress.stars < item.need; return <button key={item.id} className={progress.equipped.includes(item.id) ? 'selected' : ''} disabled={locked} onClick={() => toggleReward(item.id)}><span>{locked ? '🔒' : item.icon}</span><b>{item.name}</b><small>{locked ? `별 ${item.need}개에 열려요` : progress.equipped.includes(item.id) ? '입는 중' : '입혀 보기'}</small></button> })}</div></section><section><h2>토끼 방</h2><div className="item-grid rooms">{ROOMS.map((item) => { const locked = progress.stars < item.need; return <button key={item.id} className={progress.room === item.id ? 'selected' : ''} disabled={locked} onClick={() => chooseRoom(item.id)}><span>{locked ? '🔒' : item.icon}</span><b>{item.name}</b><small>{locked ? `별 ${item.need}개에 열려요` : progress.room === item.id ? '사용 중' : '이 방 고르기'}</small></button> })}</div></section></div><div className="unlock-note">지금까지 <b>{unlockedRewards.length}개</b>의 옷을 열었어요!</div></section>}
  </main>
}
export default App
