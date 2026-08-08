const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "js", "app.js"), "utf8");
const queue = fs.readFileSync(path.join(root, "js", "learning-review-queue.js"), "utf8");
const mistakes = fs.readFileSync(path.join(root, "js", "learning-mistakes.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "css", "styles.css"), "utf8");

test("parent and child surfaces expose one scoped review queue each", () => {
  assert.match(html, /id="parentLearningReviewQueueSection"[\s\S]*id="parentLearningReviewQueue"/);
  assert.match(html, /id="childLearningReviewQueueSection"[\s\S]*id="childLearningReviewQueue"/);
  assert.equal((html.match(/id="learningReviewWorkspace"/g) || []).length, 1);
});

test("the queue controller follows authenticated startup child changes and reset", () => {
  assert.match(app, /initLearningReviewQueue\(\{/);
  assert.match(app, /learningReviewQueueController\?\.refresh\(\)/);
  assert.match(app, /learningReviewQueueController\?\.reset\(\)/);
  assert.match(app, /Promise\.all\(\[learningTask, learningAnalysisTask, learningReviewQueueTask\]\)/);
});

test("queue reads use no-store and the selected child only for a parent", () => {
  assert.match(queue, /member\?\.role === "parent" \? selectedAssignee\(\) : ""/);
  assert.match(queue, /\/api\/learning\/review-queue\$\{query\}/);
  assert.match(queue, /cache: "no-store"/);
});

test("today and upcoming groups are derived from server due and resume state", () => {
  assert.match(queue, /item\.due \|\| item\.action\?\.type === "resume"/);
  assert.match(queue, /!item\.due && item\.action\?\.type !== "resume"/);
  assert.match(queue, /group\("오늘 복습", today\)/);
  assert.match(queue, /group\("예정 복습", upcoming\)/);
});

test("cards render server priority skill due and question counts", () => {
  assert.match(queue, /PRIORITY_LABELS\[item\.priorityStatus\]/);
  assert.match(queue, /item\.skill\?\.name \|\| item\.skill\?\.code/);
  assert.match(queue, /dueLabel\(item\)/);
  assert.match(queue, /item\.dueQuestionCount[\s\S]*item\.questionCount/);
});

test("start and resume actions delegate to the existing review lifecycle", () => {
  assert.match(queue, /action === "resume"[\s\S]*복습 이어서 하기/);
  assert.match(queue, /action === "start"[\s\S]*복습 시작/);
  assert.match(queue, /openReview\(item\)/);
  assert.match(app, /learningMistakesController\?\.openQueueItem\(item\)/);
});

test("queue review start uses the immutable skill filter and resume uses the server review id", () => {
  assert.match(mistakes, /requestReviewId = item\.action\?\.type === "resume"/);
  assert.match(mistakes, /skillCode: item\.skill\?\.code \|\| null/);
  assert.match(mistakes, /status: "all"/);
  assert.match(mistakes, /requestReviewId && requestReviewId !== String\(data\.review\?\.id \|\| ""\)/);
});

test("parent scheduling offers only one three and seven day snooze", () => {
  assert.match(queue, /\[1, 3, 7\]\.map/);
  assert.match(queue, /data-review-queue-snooze/);
  assert.match(queue, /member\?\.role === "parent"/);
});

test("override clear is shown only for a server override", () => {
  assert.match(queue, /item\.scheduleSource === "override"/);
  assert.match(queue, /data-review-queue-clear/);
  assert.match(queue, /changeSchedule\([^\n]+"clear", null\)/);
});

test("schedule mutations use PUT JSON CSRF and fresh request id", () => {
  assert.match(queue, /method: "PUT"/);
  assert.match(queue, /"X-Study-CSRF": "1"/);
  assert.match(queue, /"Content-Type": "application\/json"/);
  assert.match(queue, /requestId: crypto\.randomUUID\(\)/);
});

test("loading empty and generalized error states are explicit", () => {
  assert.match(queue, /복습 일정을 불러오는 중입니다/);
  assert.match(queue, /현재 복습할 문제가 없습니다/);
  assert.match(queue, /복습 일정을 불러오지 못했습니다/);
  assert.doesNotMatch(queue, /error\.message|error\.stack|supabaseMessage/);
});

test("child assignment and mutation responses are identity and generation scoped", () => {
  assert.match(queue, /requestGeneration !== generation \|\| requestIdentity !== identity\(\)/);
  assert.match(queue, /requestKey !== busyKey/);
  assert.match(mistakes, /requestAssignmentId !== assignmentId/);
  assert.match(mistakes, /requestReviewId && requestReviewId !== String/);
});

test("all queue display values are escaped and no answer data is rendered", () => {
  assert.match(queue, /escapeHtml\(item\.unit\?\.title/);
  assert.match(queue, /escapeHtml\(item\.skill\?\.name/);
  assert.doesNotMatch(queue, /correctAnswer|correct_answer|explanation|optionId/);
});

test("review queue becomes a single column and keeps compact mobile padding", () => {
  assert.match(styles, /@media \(max-width:960px\)\{[^}]*\.learning-review-queue-list\{grid-template-columns:1fr\}/);
  assert.match(styles, /@media \(max-width:480px\)\{[^}]*\.learning-review-queue-section\{padding:14px\}/);
});
