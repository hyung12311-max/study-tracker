const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const ui = fs.readFileSync(path.join(root, "js/learning-mistakes.js"), "utf8");

test("solution reveal is a separate explicit confirmed action", () => {
  assert.match(ui, /정답과 해설 보기/);
  assert.match(ui, /window\.confirm\("이 오답의 정답과 해설을 확인할까요\?"\)/);
  assert.match(ui, /data-learning-mistake-reveal="\$\{index\}"/);
});

test("reveal uses POST with CSRF JSON and a fresh idempotency key", () => {
  assert.match(ui, /\/mistakes\/\$\{encodeURIComponent\(item\.attemptQuestionId\)\}\/reveal/);
  assert.match(ui, /method: "POST"/);
  assert.match(ui, /"X-Study-CSRF": "1"/);
  assert.match(ui, /JSON\.stringify\(\{ requestId: crypto\.randomUUID\(\) \}\)/);
});

test("solution text is rendered only from the reveal response and escaped", () => {
  assert.match(ui, /item\.solution = data\.solution/);
  assert.match(ui, /escapeHtml\(item\.solution\.correctAnswer\)/);
  assert.match(ui, /escapeHtml\(item\.solution\.explanation\)/);
  assert.doesNotMatch(ui, /find\([^)]*selected|correct_option/i);
});

test("successful reveal changes the persisted display state to reviewed", () => {
  assert.match(ui, /item\.status = "reviewed"/);
  assert.match(html, /value="reviewed">확인함/);
});

test("reveal never places question or attempt UUIDs in DOM attributes", () => {
  assert.match(ui, /data-learning-mistake-reveal="\$\{index\}"/);
  assert.doesNotMatch(ui, /data-[^=]*(?:attempt|question)-id/i);
});

test("reveal response is discarded after child or assignment changes", () => {
  assert.match(ui, /requestGeneration !== generation/);
  assert.match(ui, /requestIdentity !== identity\(\)/);
  assert.match(ui, /requestAssignmentId !== assignmentId/);
});

test("reveal failures are generic and do not expose server details", () => {
  assert.match(ui, /정답과 해설을 불러오지 못했습니다/);
  assert.match(ui, /catch \{/);
  assert.doesNotMatch(ui, /cause\.message|error\.message|error\.code|service.?role|database host/i);
});
