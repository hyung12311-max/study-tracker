const assert = require('node:assert/strict')
const test = require('node:test')

const utils = require('../server/api/rewards/_utils')
const handler = require('../server/api/hangul/daily-complete')

function seoulDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

function validPayload(overrides = {}) {
  const descriptors = Array.from({ length: 20 }, (_, index) => `word-${index % 12}:first-letter`)
  return {
    mode: 'daily',
    studyDate: seoulDate(),
    targetCount: 20,
    completedCount: 20,
    sessionId: `hangul.${seoulDate()}.1234567890`,
    questionIds: descriptors.map((id, index) => `${index}:${id}`),
    completedQuestionIds: descriptors.map((id, index) => `${index}:${id}`),
    results: descriptors.map((id, index) => ({
      id,
      wordId: `word-${index % 12}`,
      questionType: 'first-letter',
      correct: true,
      wrongAttempts: 0,
      completedAt: new Date().toISOString(),
    })),
    ...overrides,
  }
}

function responseCapture() {
  return {
    statusCode: 0,
    headers: {},
    setHeader(name, value) { this.headers[name] = value },
    end(value) { this.body = JSON.parse(value) },
  }
}

function replaceUtils(overrides) {
  const originals = {}
  for (const [key, value] of Object.entries(overrides)) {
    originals[key] = utils[key]
    utils[key] = value
  }
  return () => Object.assign(utils, originals)
}

async function callWith({ claims = { sub: 'dayul-id', family: 'family-id', key: 'dayul', role: 'child' }, member = { id: 'dayul-id', family_id: 'family-id', member_key: 'dayul', role: 'child', is_active: true }, payload = validPayload(), rpc } = {}) {
  const restore = replaceUtils({
    authenticate: () => claims,
    memberInFamily: async () => member,
    readJson: async () => payload,
    supabaseFetch: rpc || (async () => [{ success: true, already_completed: false, completion_id: 'completion-id', sticker_awarded: 2, study_date: payload.studyDate }]),
  })
  try {
    const response = responseCapture()
    await handler({ method: 'POST', headers: {} }, response)
    return response
  } finally {
    restore()
  }
}

test('authentication is required and expired authentication is rejected', async () => {
  for (const code of ['AUTH_REQUIRED', 'TOKEN_EXPIRED']) {
    const restore = replaceUtils({ authenticate: () => { throw utils.err('private auth detail', 401, code) } })
    try {
      const response = responseCapture()
      await handler({ method: 'POST', headers: {} }, response)
      assert.equal(response.statusCode, 401)
      assert.equal(response.body.ok, false)
      assert.doesNotMatch(JSON.stringify(response.body), /private auth detail/)
    } finally { restore() }
  }
})

test('only the active Dayul child member is allowed', async () => {
  const cases = [
    { name: 'parent', claims: { sub: 'parent-id', family: 'family-id', key: 'mom', role: 'parent' }, member: { role: 'parent', member_key: 'mom', is_active: true } },
    { name: 'Hagyeom', claims: { sub: 'hagyeom-id', family: 'family-id', key: 'hagyeom', role: 'child' }, member: { role: 'child', member_key: 'hagyeom', is_active: true } },
    { name: 'inactive Dayul', claims: { sub: 'dayul-id', family: 'family-id', key: 'dayul', role: 'child' }, member: { role: 'child', member_key: 'dayul', is_active: false } },
  ]
  for (const item of cases) {
    const response = await callWith(item)
    assert.equal(response.statusCode, 403, item.name)
    assert.equal(response.body.code, 'DAYUL_PERMISSION_REQUIRED')
  }
})

test('active Dayul receives two stickers through the atomic RPC', async () => {
  let rpcBody
  const response = await callWith({ rpc: async (path, options) => {
    assert.equal(path, 'rpc/complete_hangul_daily_with_reward')
    rpcBody = JSON.parse(options.body)
    return [{ success: true, already_completed: false, completion_id: 'completion-id', sticker_awarded: 2, study_date: seoulDate() }]
  } })
  assert.equal(response.statusCode, 200)
  assert.equal(response.body.completion.stickerAwarded, 2)
  assert.equal(rpcBody.p_member_id, 'dayul-id')
  assert.equal(rpcBody.p_family_id, 'family-id')
  assert.equal(rpcBody.p_result_summary.questionCount, 20)
})

test('targets other than 20 are rejected', async () => {
  for (const targetCount of [10, 15, 25, 30]) {
    const response = await callWith({ payload: validPayload({ targetCount }) })
    assert.equal(response.statusCode, 400)
    assert.equal(response.body.code, 'HANGUL_TARGET_NOT_ELIGIBLE')
  }
})

test('incomplete, free-play, and non-today completions are rejected', async () => {
  const incomplete = await callWith({ payload: validPayload({ completedCount: 19 }) })
  assert.equal(incomplete.body.code, 'HANGUL_COMPLETION_INCOMPLETE')
  const free = await callWith({ payload: validPayload({ mode: 'free' }) })
  assert.equal(free.body.code, 'HANGUL_DAILY_MODE_REQUIRED')
  const yesterday = new Date(Date.now() - 86400000)
  const wrongDate = await callWith({ payload: validPayload({ studyDate: seoulDate(yesterday) }) })
  assert.equal(wrongDate.statusCode, 409)
  assert.equal(wrongDate.body.code, 'HANGUL_STUDY_DATE_NOT_TODAY')
})

test('tampered question lists and short results are rejected', async () => {
  const duplicateQuestions = validPayload()
  duplicateQuestions.questionIds[1] = duplicateQuestions.questionIds[0]
  assert.equal((await callWith({ payload: duplicateQuestions })).body.code, 'HANGUL_QUESTION_DUPLICATE')

  const duplicateCompleted = validPayload()
  duplicateCompleted.completedQuestionIds[1] = duplicateCompleted.completedQuestionIds[0]
  assert.equal((await callWith({ payload: duplicateCompleted })).body.code, 'HANGUL_COMPLETED_DUPLICATE')

  const shortResults = validPayload()
  shortResults.results.pop()
  assert.equal((await callWith({ payload: shortResults })).body.code, 'HANGUL_RESULT_COUNT_INVALID')
})

test('same date and same session retries are idempotent', async () => {
  let calls = 0
  const rpc = async () => {
    calls += 1
    return [{ success: true, already_completed: calls > 1, completion_id: 'same-completion', sticker_awarded: calls > 1 ? 0 : 2, study_date: seoulDate() }]
  }
  const first = await callWith({ rpc })
  const retry = await callWith({ rpc })
  assert.equal(first.body.completion.stickerAwarded, 2)
  assert.equal(retry.body.completion.stickerAwarded, 0)
  assert.equal(retry.body.completion.alreadyCompleted, true)
})

test('concurrent requests expose only one two-sticker award', async () => {
  let created = false
  const rpc = async () => {
    await new Promise((resolve) => setImmediate(resolve))
    if (!created) {
      created = true
      return [{ success: true, already_completed: false, completion_id: 'concurrent-completion', sticker_awarded: 2, study_date: seoulDate() }]
    }
    return [{ success: true, already_completed: true, completion_id: 'concurrent-completion', sticker_awarded: 0, study_date: seoulDate() }]
  }
  const payload = validPayload()
  const restore = replaceUtils({
    authenticate: () => ({ sub: 'dayul-id', family: 'family-id', key: 'dayul', role: 'child' }),
    memberInFamily: async () => ({ id: 'dayul-id', family_id: 'family-id', member_key: 'dayul', role: 'child', is_active: true }),
    readJson: async () => payload,
    supabaseFetch: rpc,
  })
  try {
    const responses = [responseCapture(), responseCapture()]
    await Promise.all(responses.map((response) => handler({ method: 'POST', headers: {} }, response)))
    assert.equal(responses.reduce((sum, response) => sum + response.body.completion.stickerAwarded, 0), 2)
  } finally { restore() }
})

test('RPC failures are sanitized and never expose tokens or service keys', async () => {
  const secret = 'service-role-secret-value'
  const response = await callWith({ rpc: async () => {
    const error = new Error(`database failed ${secret}`)
    error.statusCode = 500
    error.supabaseMessage = `internal ${secret}`
    throw error
  } })
  assert.equal(response.statusCode, 500)
  assert.equal(response.body.code, 'HANGUL_COMPLETION_FAILED')
  assert.doesNotMatch(JSON.stringify(response.body), /service-role-secret-value|Bearer/i)
})
