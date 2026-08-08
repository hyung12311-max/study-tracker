const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const ui = fs.readFileSync(path.join(root, "js/learning-analysis.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");

test("parent analysis contains a read-only remediation recommendation region", () => {
  assert.match(html, /<h5>보완 학습 추천<\/h5>/);
  assert.match(html, /id="learningRecommendationSummary"/);
  assert.doesNotMatch(html, /data-learning-(?:action|assign)[^>]*recommend/i);
});

test("recommendation UI renders skill, accuracy, unit, reason, and priority from the API", () => {
  assert.match(ui, /item\.skillName/);
  assert.match(ui, /item\.accuracy/);
  assert.match(ui, /item\.recommendedUnit\?\.title/);
  assert.match(ui, /item\.reason/);
  assert.match(ui, /item\.priority/);
  assert.doesNotMatch(ui, /weak\s*=|accuracy\s*[<>]=?|Math\.(?:round|ceil|floor).*recommend/i);
});

test("recommendation loading and every normal empty state are explicit", () => {
  assert.match(ui, /보완 학습 추천을 찾는 중입니다/);
  assert.match(ui, /현재 확인된 취약 개념이 없습니다/);
  assert.match(ui, /학습 기록이 더 쌓이면 보완 학습을 추천해 드립니다/);
  assert.match(ui, /현재 연결된 보완 학습 콘텐츠가 없습니다/);
});

test("recommendation errors are generic and isolated from analysis errors", () => {
  assert.match(ui, /let recommendationError = false/);
  assert.match(ui, /보완 학습 추천을 불러오지 못했습니다\. 잠시 후 다시 시도해 주세요/);
  assert.match(ui, /recommendationResult\.status === "fulfilled"/);
  assert.doesNotMatch(ui, /cause\.message|error\.message|error\.code|service.?role|\/rest\/v1\//i);
});

test("child scope changes reset recommendations and discard stale responses", () => {
  assert.match(ui, /\/api\/learning\/recommendations\$\{query\}/);
  assert.match(ui, /recommendations = \[\]/);
  assert.match(ui, /requestGeneration !== generation \|\| requestIdentity !== identity\(\)/);
  assert.match(app, /learningAnalysisController\?\.reset\(\)/);
  assert.match(app, /learningAnalysisController\?\.refresh\(\)/);
});

test("recommendation UI performs no mutations and exposes no raw or internal data", () => {
  assert.doesNotMatch(ui, /method:\s*["'](?:POST|PUT|PATCH|DELETE)/);
  assert.doesNotMatch(ui, /family[_-]?id|question_id|content_version_id|selected_option|correct_option|raw_answer|answer_text/i);
  assert.match(ui, /escapeHtml\(item\.skillName\)/);
  assert.match(ui, /escapeHtml\(item\.recommendedUnit\?\.title/);
  assert.match(ui, /escapeHtml\(item\.reason\)/);
});
