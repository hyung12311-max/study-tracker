const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const learning = fs.readFileSync(path.join(root, "js", "learning.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js", "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const styles = fs.readFileSync(path.join(root, "css", "styles.css"), "utf8");
const router = fs.readFileSync(path.join(root, "api", "[...path].js"), "utf8");

test("learning UI uses only authenticated server APIs and explicit selected assignee", () => {
  assert.match(learning, /\/api\/learning\/catalog/);
  assert.match(learning, /\/api\/learning\/assignments/);
  assert.match(learning, /requireSelectedAssignee\(\)/);
  assert.match(learning, /assignedMemberId/);
  assert.doesNotMatch(learning, /supabase|\/rest\/v1\/|\/rpc\//i);
  assert.doesNotMatch(app, /learning_(courses|units|content_versions|stages|assignments|stage_progress)/);
});

test("Vercel API router exposes assignment and scoped attempt routes", () => {
  assert.match(router, /"learning\/catalog": learningCatalog/);
  assert.match(router, /"learning\/assignments": learningAssignments/);
  assert.match(router, /\^learning\\\/assignments\\\/\(\[0-9a-f-\]\+\)\\\/cancel\$/);
  assert.match(router, /assignmentId: cancelMatch\[1\]/);
  assert.match(router, /start_or_resume_learning_attempt|learningAttemptStart/);
  assert.match(router, /learningAttemptAnswer/);
  assert.match(router, /learningAttemptFinalize/);
  assert.match(router, /learningAttemptAbandon/);
});

test("learning UI isolates cache and stale responses by family actor and selected child", () => {
  assert.match(learning, /`\$\{member\.family_id\}:\$\{member\.id\}:\$\{assignee \|\| "unselected"\}`/);
  assert.match(learning, /const requestGeneration = \+\+generation/);
  assert.match(learning, /requestGeneration !== generation \|\| requestIdentity !== identity\(\)/);
  assert.match(app, /learningController\?\.reset\(\)/);
  assert.match(app, /learningController\?\.refresh\(\{ force: true \}\)/);
});

test("parent and child have separate learning and attempt areas", () => {
  assert.match(html, /id="parentPanelLearning"/);
  assert.match(html, /id="learningCatalogList"/);
  assert.match(html, /id="learningAssignmentList"/);
  assert.match(html, /id="childLearningSection"/);
  assert.match(html, /id="childLearningAssignmentList"/);
  assert.match(html, /id="childLearningAttemptPanel"/);
  assert.match(html, /id="learningAttemptView"/);
  assert.match(html, /id="learningAttemptFullscreenPanel"/);
  assert.match(learning, /start-attempt/);
  assert.match(learning, /resume-attempt/);
  assert.match(learning, /submit-all-answers/);
});

test("child cards do not render course, grade, or content version metadata", () => {
  const renderAssignments = learning.match(/function renderAssignments\(parent\)[\s\S]*?\n  function render\(\)/)?.[0] || "";
  assert.match(renderAssignments, /parent && assignment\.course/);
  assert.match(renderAssignments, /parentMeta/);
  assert.doesNotMatch(renderAssignments, /grade|contentVersionId|version_no|internal_name/);
  assert.match(renderAssignments, /stageList\(assignment\.stages, assignment, parent\)/);
});

test("learning mutations use CSRF, duplicate-click guards, and refresh only current identity", () => {
  assert.ok((learning.match(/"X-Study-CSRF": "1"/g) || []).length >= 6);
  assert.match(learning, /if \(pending\.has\(key\)\) return/);
  assert.match(learning, /pending\.add\(key\)/);
  assert.match(learning, /if \(requestIdentity === identity\(\)\)/);
  assert.match(learning, /await refresh\(\{ force: true \}\)/);
});

test("attempt UI isolates identity cache and discards stale responses", () => {
  assert.match(learning, /attemptCache\.set\(`\$\{requestIdentity\}:\$\{attempt\.id\}`/);
  assert.match(learning, /requestGeneration !== generation \|\| requestIdentity !== identity\(\)/);
  assert.match(learning, /attempt = null/);
  assert.match(learning, /selectedAnswers\.clear\(\)/);
  assert.match(learning, /attemptViewOpen = false/);
  assert.match(learning, /attemptCache\.clear\(\)/);
});

test("attempt view renders all questions, requires every selection, and submits in order", () => {
  assert.match(learning, /learningAttemptFullscreenPanel/);
  assert.match(learning, /questions\.map\(\(question\)/);
  assert.match(learning, /unanswered\.every\(\(question\) => selectedAnswers\.has\(question\.id\)\)/);
  assert.match(learning, /unanswered\.sort\(\(a, b\) => a\.order - b\.order\)/);
  assert.match(learning, /for \(const question of unanswered/);
  assert.match(learning, /저장된 답은 유지됩니다/);
  assert.match(learning, /question\.answer \|\| submitting \? "disabled"/);
  const submitAll = learning.match(/async function submitAllAnswers\(\)[\s\S]*?\n  async function finalizeAttempt/)?.[0] || "";
  assert.doesNotMatch(submitAll, /score\s*:|passed\s*:/);
});

test("difficulty values keep DB keys while child labels use approved Korean names", () => {
  assert.match(learning, /seed: "입문"/);
  assert.match(learning, /leaf: "기초"/);
  assert.match(learning, /tree: "심화"/);
  assert.match(learning, /crown: "최상위 도전!"/);
  assert.match(learning, /seed: 1, leaf: 2, tree: 3, crown: 5/);
});

test("next-stage action depends on refreshed assignment progress, not only finalize output", () => {
  assert.match(learning, /function nextUnlockedStage\(\)/);
  assert.match(learning, /stage\.status === "unlocked"/);
  assert.match(learning, /cache\.delete\(requestIdentity\)/);
  assert.match(learning, /refresh\(\{ force: true \}\)/);
  assert.match(learning, /nextStage \? `[\s\S]*data-learning-action="start-attempt"/);
});

test("wide option cards keep accessible labels and non-color feedback", () => {
  assert.match(learning, /<label class="learning-option/);
  assert.match(learning, /learning-option-indicator/);
  assert.match(learning, /✓ 정답/);
  assert.match(learning, /✕ 오답/);
  assert.match(html, /aria-label="문제풀이에서 뒤로가기"/);
});

test("attempt options use responsive grid columns without horizontal scrolling", () => {
  assert.match(styles, /\.learning-options\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(styles, /@media \(max-width:\s*960px\)\s*\{\s*\.learning-options\s*\{[^}]*grid-template-columns:\s*repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(styles, /@media \(max-width:\s*360px\)\s*\{\s*\.learning-options\s*\{[^}]*grid-template-columns:\s*minmax\(0,1fr\)/);
  assert.match(styles, /\.learning-option\s*\{[^}]*min-height:\s*48px/);
  assert.doesNotMatch(styles, /\.learning-options\s*\{[^}]*(?:overflow-x:\s*(?:auto|scroll)|width:\s*\d+px)/);
});

test("answer cards are borderless by default while preserving accessible states", () => {
  assert.match(styles, /\.learning-option\s*\{[^}]*border:\s*none;/);
  assert.match(styles, /\.learning-option-indicator\s*\{[^}]*border:\s*2px\s+solid/);
  assert.match(styles, /\.learning-option:has\(input:checked\)\s*\{[^}]*background:[^}]*box-shadow:/);
  assert.match(styles, /\.learning-option:has\(input:focus-visible\)\s*\{[^}]*outline:/);
  assert.match(styles, /\.learning-option\.correct\s*\{[^}]*background:/);
  assert.match(styles, /\.learning-option\.incorrect\s*\{[^}]*background:/);
});

test("attempt UI shows server-owned feedback, rewards, unlock, and completion results", () => {
  assert.match(learning, /correctOptionText/);
  assert.match(learning, /explanation/);
  assert.match(learning, /result\.requiredCorrectAnswers/);
  assert.match(learning, /result\.rewardGranted === true && result\.rewardAmount > 0/);
  assert.match(learning, /스티커 \+\$\{result\.rewardAmount\}/);
  assert.match(learning, /최초 통과 보상은 이미 받았어요/);
  assert.match(learning, /result\.unlockedStageId/);
  assert.match(learning, /다음 단계가 열렸어요/);
  assert.match(learning, /result\.assignmentCompleted === true/);
  assert.match(learning, /단원의 모든 단계를 완료했어요/);
  assert.match(learning, /refreshStickerWallet/);
  assert.match(learning, /Promise\.allSettled/);
  assert.match(learning, /announcedRewardAttempts/);
  assert.doesNotMatch(learning, /0\.8|Math\.ceil|sticker_transactions/i);
  assert.doesNotMatch(learning, /\/rest\/v1\/|\/rpc\/|service.?role/i);
});

test("learning reward UI refreshes server state and clears identity-scoped result state", () => {
  assert.match(learning, /cache\.delete\(requestIdentity\)/);
  assert.match(learning, /refresh\(\{ force: true \}\)/);
  assert.match(learning, /attemptIdentity && attemptIdentity !== requestIdentity/);
  assert.match(learning, /announcedRewardAttempts\.clear\(\)/);
  assert.match(app, /refreshStickerWallet: \(\) => rewardStoreController\?\.refresh\(\{ silent: true \}\)/);
  assert.match(learning, /assignmentStatusLabels/);
  assert.match(learning, /completed: "단원 완료"/);
});

test("parent reset is confirmed and scoped to selected child", () => {
  assert.match(learning, /data-learning-action="abandon-attempt"/);
  assert.match(learning, /confirm\("진행 중인 응시를 초기화할까요/);
  assert.match(learning, /assignedMemberId, assignmentId: button\.dataset\.assignmentId/);
  assert.match(learning, /requestGeneration === generation && requestIdentity === identity\(\)/);
});

test("catalog and assignment empty states are explicit", () => {
  assert.match(learning, /현재 배정 가능한 문제풀이 단원이 없습니다/);
  assert.match(learning, /아직 배정된 문제풀이 단원이 없습니다/);
  assert.match(learning, /담당 자녀를 선택하면/);
});
