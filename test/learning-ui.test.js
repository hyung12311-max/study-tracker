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

test("Vercel API router exposes catalog, assignments, and scoped cancel only", () => {
  assert.match(router, /"learning\/catalog": learningCatalog/);
  assert.match(router, /"learning\/assignments": learningAssignments/);
  assert.match(router, /\^learning\\\/assignments\\\/\(\[0-9a-f-\]\+\)\\\/cancel\$/);
  assert.match(router, /assignmentId: cancelMatch\[1\]/);
});

test("learning UI isolates cache and stale responses by family actor and selected child", () => {
  assert.match(learning, /`\$\{member\.family_id\}:\$\{member\.id\}:\$\{assignee \|\| "unselected"\}`/);
  assert.match(learning, /const requestGeneration = \+\+generation/);
  assert.match(learning, /requestGeneration !== generation \|\| requestIdentity !== identity\(\)/);
  assert.match(app, /learningController\?\.reset\(\)/);
  assert.match(app, /learningController\?\.refresh\(\{ force: true \}\)/);
});

test("parent and child have separate minimal learning areas", () => {
  assert.match(html, /id="parentPanelLearning"/);
  assert.match(html, /id="learningCatalogList"/);
  assert.match(html, /id="learningAssignmentList"/);
  assert.match(html, /id="childLearningSection"/);
  assert.match(html, /id="childLearningAssignmentList"/);
  assert.match(learning, /문제풀이 기능 준비 중/);
});

test("child cards do not render course, grade, or content version metadata", () => {
  const renderAssignments = learning.match(/function renderAssignments\(parent\)[\s\S]*?\n  function render\(\)/)?.[0] || "";
  assert.match(renderAssignments, /parent && assignment\.course/);
  assert.match(renderAssignments, /parentMeta/);
  assert.doesNotMatch(renderAssignments, /grade|contentVersionId|version_no|internal_name/);
  assert.match(renderAssignments, /문제풀이 기능 준비 중/);
});

test("learning mutations use CSRF header, duplicate-click guards, and refresh only current identity", () => {
  assert.equal((learning.match(/"X-Study-CSRF": "1"/g) || []).length, 2);
  assert.match(learning, /if \(pending\.has\(key\)\) return/);
  assert.match(learning, /pending\.add\(key\)/);
  assert.match(learning, /if \(requestIdentity === identity\(\)\)/);
  assert.match(learning, /await refresh\(\{ force: true \}\)/);
});

test("catalog and assignment empty states are explicit", () => {
  assert.match(learning, /현재 배정 가능한 문제풀이 단원이 없습니다/);
  assert.match(learning, /아직 배정된 문제풀이 단원이 없습니다/);
  assert.match(learning, /담당 자녀를 선택하면/);
});
