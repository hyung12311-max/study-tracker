import { getWordsForLevel } from '../data/words.js'

export const DIFFICULTY_MIXES = {
  1: { 'first-letter': 1 },
  2: { 'first-letter': 0.7, 'last-letter': 0.3 },
  3: { 'first-letter': 0.4, 'last-letter': 0.4, 'middle-letter': 0.2 },
  4: { 'first-letter': 0.25, 'last-letter': 0.25, 'middle-letter': 0.25, 'full-word': 0.25 },
}

export const DIFFICULTY_NAMES = {
  1: '첫 글자 탐험',
  2: '처음과 끝',
  3: '가운데까지',
  4: '낱말 박사',
}

function supportsType(word, type) {
  if (word.supportedTypes && !word.supportedTypes.includes(type)) return false
  if (type === 'middle-letter') return word.syllables.length >= 3
  if (type === 'last-letter') return word.syllables.length >= 2
  return ['first-letter', 'full-word'].includes(type)
}

function getBlankIndex(word, type) {
  if (type === 'first-letter') return 0
  if (type === 'last-letter') return word.syllables.length - 1
  if (type === 'middle-letter') return Math.floor(word.syllables.length / 2)
  return null
}

function buildCandidate(word, questionType) {
  const blankIndex = getBlankIndex(word, questionType)
  const answer = questionType === 'full-word' ? word.word : word.syllables[blankIndex]
  return {
    id: `${word.id}:${questionType}`,
    wordId: word.id,
    word: word.word,
    syllables: word.syllables,
    displaySyllables: questionType === 'full-word' ? word.syllables : word.syllables.map((syllable, index) => index === blankIndex ? '□' : syllable),
    blankIndex,
    answer,
    learningLetter: word.syllables[0],
    image: word.image,
    imageAlt: word.imageAlt,
    color: word.color,
    letterLevel: word.letterLevel,
    questionType,
  }
}

export function getQuestionCandidateIds(level, types) {
  return getWordsForLevel(level).flatMap((word) => types.filter((type) => supportsType(word, type)).map((type) => `${word.id}:${type}`))
}

export function getQuestionDescriptor(id) {
  const separator = id.lastIndexOf(':')
  const wordId = id.slice(0, separator)
  const questionType = id.slice(separator + 1)
  const word = [1, 2, 3].flatMap(getWordsForLevel).find((item) => item.id === wordId)
  return word && supportsType(word, questionType) ? buildCandidate(word, questionType) : null
}

function shuffle(items) {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1))
    ;[result[index], result[target]] = [result[target], result[index]]
  }
  return result
}

function buildChoices(candidate, words, previousCorrectIndex) {
  let choicePool
  if (candidate.questionType === 'full-word') {
    choicePool = words.map((word) => word.word)
  } else {
    const samePositionAnswers = words
      .filter((word) => supportsType(word, candidate.questionType))
      .map((word) => buildCandidate(word, candidate.questionType).answer)
    choicePool = [...samePositionAnswers, ...words.flatMap((word) => word.syllables)]
  }
  const distractors = shuffle([...new Set(choicePool.filter((choice) => choice !== candidate.answer))]).slice(0, 3)
  if (distractors.length < 3) throw new Error(`문제 보기 후보가 부족합니다: ${candidate.id}`)
  const allowedPositions = [0, 1, 2, 3].filter((index) => index !== previousCorrectIndex)
  const correctIndex = allowedPositions[Math.floor(Math.random() * allowedPositions.length)]
  const choices = shuffle(distractors)
  choices.splice(correctIndex, 0, candidate.answer)
  return { choices, correctIndex }
}

export function getActiveTypeWeights(difficulty, enabledTypes) {
  const mix = DIFFICULTY_MIXES[difficulty] || DIFFICULTY_MIXES[1]
  const enabled = Object.entries(mix).filter(([type]) => enabledTypes.includes(type))
  if (!enabled.length) return { [enabledTypes[0] || 'first-letter']: 1 }
  const total = enabled.reduce((sum, [, weight]) => sum + weight, 0)
  return Object.fromEntries(enabled.map(([type, weight]) => [type, weight / total]))
}

export function generateQuestion({ progress, level, recentRounds = [], previousCorrectIndex = null }) {
  const words = getWordsForLevel(level)
  const learning = progress.learning
  const difficulty = learning.difficultyMode === 'manual' ? learning.selectedDifficultyLevel : learning.autoDifficultyLevel
  const typeWeights = getActiveTypeWeights(difficulty, learning.enabledQuestionTypes)
  const candidates = words.flatMap((word) => Object.keys(typeWeights).filter((type) => supportsType(word, type)).map((type) => buildCandidate(word, type)))
  const previous = recentRounds.at(-1)
  const recentWords = new Set(recentRounds.slice(-5).map((round) => round.wordId))
  const lastTwo = recentRounds.slice(-2)
  const repeatedAnswer = lastTwo.length === 2 && lastTwo[0].answer === lastTwo[1].answer ? lastTwo[0].answer : null
  const stats = learning.levelStats[level]
  let pool = candidates.filter((candidate) => candidate.id !== previous?.id && candidate.wordId !== previous?.wordId)
  if (repeatedAnswer && pool.some((candidate) => candidate.answer !== repeatedAnswer)) pool = pool.filter((candidate) => candidate.answer !== repeatedAnswer)
  if (!pool.length) pool = candidates
  const weighted = pool.map((candidate) => {
    const wrong = stats.letterWrong[candidate.learningLetter] || 0
    const correct = stats.letterCorrect[candidate.learningLetter] || 0
    const reviewWeight = 1 + wrong * 1.8 + Math.max(0, 2 - correct) * 0.8
    const recentPenalty = recentWords.has(candidate.wordId) ? 0.25 : 1
    return { candidate, weight: typeWeights[candidate.questionType] * reviewWeight * recentPenalty }
  })
  const total = weighted.reduce((sum, item) => sum + item.weight, 0)
  let cursor = Math.random() * total
  const selected = weighted.find((item) => ((cursor -= item.weight) <= 0))?.candidate || weighted[0].candidate
  const { choices, correctIndex } = buildChoices(selected, words, previousCorrectIndex)
  return { ...selected, choices, correctIndex, difficulty }
}

export function createQuestionFromId({ id, previousCorrectIndex = null }) {
  const candidate = getQuestionDescriptor(id)
  if (!candidate) throw new Error(`알 수 없는 일일 문제입니다: ${id}`)
  const words = getWordsForLevel(candidate.letterLevel)
  const { choices, correctIndex } = buildChoices(candidate, words, previousCorrectIndex)
  return { ...candidate, choices, correctIndex }
}

export function getGeneratableTypeCounts(level) {
  const words = getWordsForLevel(level)
  return Object.fromEntries(['first-letter', 'last-letter', 'middle-letter', 'full-word'].map((type) => [type, words.filter((word) => supportsType(word, type)).length]))
}
