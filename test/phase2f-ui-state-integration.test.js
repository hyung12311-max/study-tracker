const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const learning = fs.readFileSync(path.join(root, "js/learning.js"), "utf8");
const analysis = fs.readFileSync(path.join(root, "js/learning-analysis.js"), "utf8");
const mistakes = fs.readFileSync(path.join(root, "js/learning-mistakes.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

function section(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(from, -1, `missing section start: ${start}`);
  assert.notEqual(to, -1, `missing section end: ${end}`);
  return source.slice(from, to);
}

test("child switching resets assignment, analysis, mistakes, and review before scoped reload", () => {
  const change = section(app, "async function handlePlanAssigneeChange()", "function applyStickerWalletData");
  assert.match(change, /state = \{[\s\S]*plans: \[\],[\s\S]*bookPlans: \[\],[\s\S]*academySchedules: \[\]/);
  assert.match(change, /learningController\?\.reset\(\)/);
  assert.match(change, /learningAnalysisController\?\.reset\(\)/);
  assert.match(change, /learningMistakesController\?\.reset\(\)/);
  assert.match(change, /learningController\?\.refresh\(\{ force: true \}\)/);
  assert.match(change, /learningAnalysisController\?\.refresh\(\)/);
});

test("every learning controller clears its own result loading and error state", () => {
  const learningReset = section(learning, "reset() {", "render();\n    },");
  const analysisReset = section(analysis, "reset() {", "render();\n    },");
  const mistakeReset = section(mistakes, "reset() {", "render();\n    },");
  assert.match(learningReset, /assignments = \[\]/);
  assert.match(learningReset, /attempt = null/);
  assert.match(learningReset, /loading = false/);
  assert.match(learningReset, /error = ""/);
  assert.match(analysisReset, /scores = \[\]/);
  assert.match(analysisReset, /attemptHistory = \[\]/);
  assert.match(analysisReset, /skills = \[\]/);
  assert.match(analysisReset, /loading = false/);
  assert.match(analysisReset, /error = false/);
  assert.match(mistakeReset, /assignmentId = ""/);
  assert.match(mistakeReset, /mistakes = \[\]/);
  assert.match(mistakeReset, /review = null/);
  assert.match(mistakeReset, /reviewFeedback = null/);
  assert.match(mistakeReset, /loading = false/);
  assert.match(mistakeReset, /failed = false/);
});

test("assignment switching clears prior mistakes and complete review-session state before loading", () => {
  const open = section(mistakes, "async function open(nextAssignmentId, nextTitle)", "async function startReview()");
  assert.match(open, /assignmentId = String\(nextAssignmentId\);[\s\S]*mistakes = \[\]/);
  assert.match(open, /review = null/);
  assert.match(open, /reviewLoading = false/);
  assert.match(open, /reviewFailed = false/);
  assert.match(open, /reviewSubmitting = false/);
  assert.match(open, /selectedReviewOptionId = ""/);
  assert.match(open, /reviewFeedback = null/);
  assert.match(open, /reviewFeedbackItemId = ""/);
  assert.match(open, /loading = true;[\s\S]*render\(\)/);
});

test("late child responses are rejected by generation and member-child identity", () => {
  for (const source of [learning, analysis, mistakes]) {
    assert.match(source, /const requestGeneration = \+\+generation/);
    assert.match(source, /const requestIdentity = identity\(\)/);
    assert.match(source, /requestGeneration !== generation \|\| requestIdentity !== identity\(\)/);
  }
  assert.match(app, /remoteLoadGeneration \+= 1/);
  assert.match(app, /generation !== remoteLoadGeneration \|\| requestCacheKey !== localDataKey\(\)/);
});

test("late assignment responses cannot replace the newly selected mistake notebook", () => {
  const open = section(mistakes, "async function open(nextAssignmentId, nextTitle)", "async function startReview()");
  assert.match(open, /const requestGeneration = \+\+generation/);
  assert.match(open, /assignmentId !== String\(nextAssignmentId\)/);
  assert.match(open, /requestIdentity !== identity\(\)/);
  assert.match(open, /requestGeneration === generation[\s\S]*assignmentId === String\(nextAssignmentId\)/);
});

test("late review start submit and abandon responses are session scoped", () => {
  const start = section(mistakes, "async function startReview()", "async function submitReviewAnswer()");
  const submit = section(mistakes, "async function submitReviewAnswer()", "async function abandonReview()");
  const abandon = section(mistakes, "async function abandonReview()", "async function reveal(item)");
  assert.match(start, /requestAssignmentId !== assignmentId/);
  assert.match(submit, /const requestReviewId = review\.id/);
  assert.match(submit, /requestReviewId !== review\?\.id/);
  assert.match(abandon, /const requestReviewId = review\.id/);
  assert.match(abandon, /requestReviewId !== review\?\.id/);
  assert.match(mistakes, /reviewFeedbackItemId = requestItemId/);
});

test("planning analysis mistakes and review retain independent loading flags", () => {
  assert.match(app, /setConnectionStatus\("선택한 자녀의 학습계획을 불러오는 중입니다/);
  assert.match(analysis, /let loading = false/);
  assert.match(mistakes, /let loading = false/);
  assert.match(mistakes, /let reviewLoading = false/);
  assert.match(mistakes, /let reviewSubmitting = false/);
  assert.doesNotMatch(app, /globalLearningLoading|allLearningLoading/);
});

test("analysis mistakes and review failures render independently and generically", () => {
  assert.match(analysis, /let error = false/);
  assert.match(mistakes, /let failed = false/);
  assert.match(mistakes, /let reviewFailed = false/);
  assert.match(analysis, /성취 분석을 불러오지 못했습니다\. 잠시 후 다시 시도해 주세요/);
  assert.match(mistakes, /오답노트를 불러오지 못했습니다/);
  assert.match(mistakes, /오답 복습을 진행하지 못했습니다/);
});

test("each integrated region preserves its own normal empty state", () => {
  assert.match(learning, /배정된 문제풀이 단원이 없습니다|배정할 수 있는 문제풀이 단원이 없습니다/);
  assert.match(analysis, /아직 완료한 학습이 없습니다/);
  assert.match(analysis, /충분한 학습 기록이 쌓이면 취약 개념을 확인할 수 있습니다/);
  assert.match(mistakes, /이번 학습에서 틀린 문제가 없습니다/);
  assert.match(mistakes, /복습할 오답이 없습니다/);
  assert.match(mistakes, /완료한 단원에서 오답노트를 선택해 주세요/);
});

test("official and review presentation remain separate in markup and client behavior", () => {
  assert.match(html, /id="learningScoreSummary"/);
  assert.match(html, /id="learningSkillSummary"/);
  assert.match(html, /id="learningReviewWorkspace"/);
  assert.match(html, /복습 결과는 공식 점수·진도·보상에 영향을 주지 않습니다/);
  assert.doesNotMatch(mistakes, /finalize_learning|learning_stage_progress|learning_stage_first_passes|sticker_transactions/i);
  assert.doesNotMatch(analysis, /learning_mistake_review|reviewAnswer|resolutionStatus/);
});

test("review feedback cannot alter official score values or client-side grading", () => {
  assert.match(analysis, /summary\.latest/);
  assert.match(analysis, /summary\.best/);
  assert.match(analysis, /summary\.first/);
  assert.doesNotMatch(analysis, /reviewFeedback|review\.items/);
  assert.match(mistakes, /reviewFeedback = data\.feedback/);
  assert.doesNotMatch(mistakes, /scores\s*=|accuracyPercent\s*=|reward\s*=/);
});

test("resolution labels render only the server-provided resolutionStatus", () => {
  for (const [status, label] of [
    ["unreviewed", "미복습"],
    ["retried_wrong", "재오답"],
    ["resolved", "해결"],
    ["repeated_wrong", "반복 오답"],
  ]) assert.match(mistakes, new RegExp(`${status}: "${label}"`));
  assert.match(mistakes, /REVIEW_STATUS_LABELS\[item\.resolutionStatus\]/);
  assert.doesNotMatch(mistakes, /wrongRoundCount|is_correct ===/);
});

test("session and source identifiers are not rendered into the DOM", () => {
  assert.doesNotMatch(mistakes, /data-[^=]*(?:session|family|source|attempt|question)-id/i);
  assert.doesNotMatch(mistakes, /family[_-]?id|source_attempt/i);
  assert.match(mistakes, /data-learning-review-option="\$\{index\}"/);
  assert.doesNotMatch(mistakes, /data-learning-review-option="\$\{(?:option\.id|selectedReviewOptionId)/);
});

test("UI error paths never render exception database or credential details", () => {
  for (const source of [analysis, mistakes]) {
    assert.doesNotMatch(source, /error\.message|error\.code|cause\.message|sqlstate|connection.?string|service.?role|\/rest\/v1\//i);
  }
  assert.match(analysis, /catch \{/);
  assert.match(mistakes, /catch \{/);
});
