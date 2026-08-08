const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const learning = fs.readFileSync(path.join(root, "js/learning.js"), "utf8");
const mistakes = fs.readFileSync(path.join(root, "js/learning-mistakes.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "css/styles.css"), "utf8");
const api = fs.readFileSync(path.join(root, "server/api/learning/assignments/[assignmentId]/mistakes.js"), "utf8");

test("parent learning panel contains a dedicated mistake notebook", () => {
  assert.match(html, /id="learningMistakesSection"/);
  assert.match(html, /id="learningMistakesList"/);
  assert.match(learning, /data-learning-mistakes-assignment/);
});

test("mistake cards render escaped prompts and all option text", () => {
  assert.match(mistakes, /escapeHtml\(item\.prompt\)/);
  assert.match(mistakes, /options\.map/);
  assert.match(mistakes, /escapeHtml\(option\.text\)/);
  assert.match(api, /options: publicOptions\(question\.options_snapshot, answer\.selected_option_id\)/);
  assert.doesNotMatch(api, /select=id,attempt_id,display_order,prompt_snapshot,options_snapshot,skill_codes_snapshot,correct_option_id/);
});

test("the original selection has a neutral visible marker", () => {
  assert.match(mistakes, /option\.selected \? "is-selected"/);
  assert.match(mistakes, /내가 고른 답/);
  assert.match(styles, /\.learning-mistake-options li\.is-selected/);
  assert.doesNotMatch(mistakes, /✓ 정답|정답입니다/);
});

test("stage filter is client-side and read from the scoped response", () => {
  assert.match(html, /id="learningMistakesStageFilter"/);
  assert.match(mistakes, /!filters\.stage \|\| item\.stage\?\.id === filters\.stage/);
});

test("skill filter uses immutable skill codes returned by the API", () => {
  assert.match(html, /id="learningMistakesSkillFilter"/);
  assert.match(mistakes, /item\.skills \|\| \[\]/);
  assert.match(mistakes, /skill\.code === filters\.skill/);
});

test("review status filter supports all and unreviewed", () => {
  assert.match(html, /id="learningMistakesStatusFilter"/);
  assert.match(html, /value="unreviewed">미복습/);
  assert.match(mistakes, /item\.status === filters\.status/);
});

test("loading state is explicit and accessible", () => {
  assert.match(mistakes, /오답 데이터를 불러오는 중입니다/);
  assert.match(mistakes, /setAttribute\("aria-busy", String\(loading\)\)/);
});

test("empty and filter-empty states are distinct", () => {
  assert.match(mistakes, /이번 학습에서 틀린 문제가 없습니다/);
  assert.match(mistakes, /선택한 조건에 해당하는 오답이 없습니다/);
});

test("errors are generic and do not render exception details", () => {
  assert.match(mistakes, /오답노트를 불러오지 못했습니다/);
  assert.match(mistakes, /catch \{/);
  assert.doesNotMatch(mistakes, /cause\.message|error\.message|error\.code|service.?role|\/rest\/v1\//i);
});

test("child changes reset all mistake state", () => {
  assert.match(app, /learningMistakesController\?\.reset\(\)/);
  assert.match(mistakes, /generation \+= 1/);
  assert.match(mistakes, /assignmentId = ""/);
  assert.match(mistakes, /mistakes = \[\]/);
});

test("assignment switches clear old rows before loading", () => {
  assert.match(mistakes, /assignmentId = String\(nextAssignmentId\);[\s\S]*mistakes = \[\];[\s\S]*loading = true;[\s\S]*render\(\)/);
});

test("stale child and assignment responses are discarded", () => {
  assert.match(mistakes, /requestGeneration !== generation/);
  assert.match(mistakes, /requestIdentity !== identity\(\)/);
  assert.match(mistakes, /assignmentId !== String\(nextAssignmentId\)/);
});

test("only the D-1 scoped API is used for mistake data", () => {
  assert.match(mistakes, /\/api\/learning\/assignments\/\$\{encodeURIComponent\(assignmentId\)\}\/mistakes\?assignedMemberId=\$\{encodeURIComponent\(assignedMemberId\)\}/);
  assert.doesNotMatch(mistakes, /\/rest\/v1\/|learning_attempt_answers|learning_attempt_questions/);
});

test("the notebook is enabled only for a parent viewer", () => {
  assert.match(mistakes, /currentMember\(\)\?\.role === "parent"/);
  assert.match(mistakes, /section\.hidden = !parent/);
});

test("the list view does not infer solutions or expose identifiers in markup", () => {
  assert.doesNotMatch(mistakes, /correctOption|correct_option|family[_-]?id/i);
  assert.doesNotMatch(mistakes, /data-[^=]*(?:attempt|question)-id/i);
});

test("every server display value is HTML escaped", () => {
  assert.match(mistakes, /escapeHtml\(item\.stage\?\.title/);
  assert.match(mistakes, /escapeHtml\(item\.questionOrder\)/);
  assert.match(mistakes, /escapeHtml\(item\.selectedAnswer\?\.text/);
  assert.match(mistakes, /escapeHtml\(skill\.name \|\| skill\.code\)/);
});

test("mistake notebook is responsive on tablet and mobile", () => {
  assert.match(styles, /\.learning-mistake-list\{[^}]*repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(styles, /@media \(max-width:960px\)[^{]*\{[^}]*\.learning-mistake-list[^}]*grid-template-columns:1fr/);
  assert.match(styles, /@media \(max-width:480px\)[^{]*\{[^}]*\.learning-mistakes-section/);
});
