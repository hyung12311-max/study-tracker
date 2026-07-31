const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const learning = fs.readFileSync(path.join(root, "js", "learning.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js", "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
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
  assert.match(learning, /start-attempt/);
  assert.match(learning, /resume-attempt/);
  assert.match(learning, /submit-answer/);
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
  assert.match(learning, /attemptCache\.set\(`\$\{requestIdentity\}:\$\{attemptId\}`/);
  assert.match(learning, /requestGeneration !== generation \|\| requestIdentity !== identity\(\)/);
  assert.match(learning, /attempt = null/);
  assert.match(learning, /feedback = null/);
  assert.match(learning, /attemptCache\.clear\(\)/);
});

test("attempt UI shows feedback and results without rewards or local pass calculation", () => {
  assert.match(learning, /correctOptionText/);
  assert.match(learning, /explanation/);
  assert.match(learning, /result\.requiredCorrectAnswers/);
  assert.match(learning, /다음 단계 해금과 보상은 아직 준비 중/);
  assert.doesNotMatch(learning, /0\.8|Math\.ceil|sticker_transactions|first.?pass/i);
  assert.doesNotMatch(learning, /\/rest\/v1\/|\/rpc\/|service.?role/i);
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
