const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const analysis = fs.readFileSync(path.join(root, "js/learning-analysis.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "css/styles.css"), "utf8");

test("parent learning panel contains the three achievement analysis regions", () => {
  assert.match(html, /id="learningAnalysisSection"/);
  assert.match(html, /id="learningScoreSummary"/);
  assert.match(html, /id="learningAttemptHistory"/);
  assert.match(html, /id="learningSkillSummary"/);
});

test("score summaries render server-owned latest, best, and first results", () => {
  assert.match(analysis, /summary\.latest/);
  assert.match(analysis, /summary\.best/);
  assert.match(analysis, /summary\.first/);
  assert.match(analysis, /point\.correct.*point\.total/);
  assert.doesNotMatch(analysis, /Math\.(?:round|ceil|floor).*accuracy|correct\s*\/\s*total/);
});

test("terminal attempt history renders unit, completion, score, and counts", () => {
  assert.match(analysis, /attempt\.unitTitle/);
  assert.match(analysis, /formatCompletedAt\(attempt\.completedAt\)/);
  assert.match(analysis, /attempt\.accuracyPercent/);
  assert.match(analysis, /attempt\.correct.*attempt\.total/);
});

test("skill summaries render accuracy, attempts, questions, and weak state", () => {
  assert.match(analysis, /skill\.skillName \|\| skill\.skillCode/);
  assert.match(analysis, /skill\.accuracyPercent/);
  assert.match(analysis, /skill\.attemptedQuestions/);
  assert.match(analysis, /skill\.attemptCount/);
  assert.match(analysis, /skill\.weak \? "취약" : "관찰 중"/);
});

test("analysis has explicit loading and empty states", () => {
  assert.match(analysis, /점수 요약을 불러오는 중입니다/);
  assert.match(analysis, /아직 완료한 학습이 없습니다/);
  assert.match(analysis, /아직 분석할 응시 기록이 없습니다/);
  assert.match(analysis, /충분한 학습 기록이 쌓이면 취약 개념을 확인할 수 있습니다/);
  assert.match(analysis, /aria-busy/);
});

test("API failures show one generic error without internal details", () => {
  assert.match(analysis, /catch \{/);
  assert.match(analysis, /성취 분석을 불러오지 못했습니다\. 잠시 후 다시 시도해 주세요/);
  assert.doesNotMatch(analysis, /cause\.message|error\.message|error\.code|service.?role|\/rest\/v1\//i);
});

test("all three read-only endpoints use the selected child scope", () => {
  assert.match(analysis, /const query = `\?assignedMemberId=\$\{encodeURIComponent\(assignedMemberId\)\}`/);
  assert.match(analysis, /\/api\/learning\/scores\$\{query\}/);
  assert.match(analysis, /\/api\/learning\/attempt-history\$\{query\}/);
  assert.match(analysis, /\/api\/learning\/skills\$\{query\}/);
  assert.doesNotMatch(analysis, /method:\s*["'](?:POST|PUT|PATCH|DELETE)/);
});

test("child changes reset and refresh identity-scoped analysis", () => {
  assert.match(app, /learningAnalysisController\?\.reset\(\)/);
  assert.match(app, /learningAnalysisController\?\.refresh\(\)/);
  assert.match(analysis, /requestIdentity !== identity\(\)/);
  assert.match(analysis, /requestGeneration !== generation/);
});

test("analysis output escapes display data and excludes raw answers and family identifiers", () => {
  assert.match(analysis, /escapeHtml\(summary\.unitTitle/);
  assert.match(analysis, /escapeHtml\(attempt\.unitTitle/);
  assert.match(analysis, /escapeHtml\(skill\.skillName \|\| skill\.skillCode\)/);
  assert.doesNotMatch(analysis, /family[_-]?id|selected_option|correct_option|raw_answer|answer_text/i);
});

test("analysis layout remains readable on tablet and mobile widths", () => {
  assert.match(styles, /\.learning-analysis-grid\s*\{[^}]*repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(styles, /@media \(max-width:960px\)[^{]*\{[^}]*\.learning-analysis-grid(?:\s*,[^{]+)?\s*\{[^}]*grid-template-columns:1fr/);
  assert.match(styles, /@media \(max-width:480px\)/);
});
