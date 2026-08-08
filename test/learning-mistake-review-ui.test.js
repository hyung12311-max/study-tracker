const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const ui = fs.readFileSync(path.join(root, "js/learning-mistakes.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "css/styles.css"), "utf8");
const readModel = fs.readFileSync(path.join(root, "server/api/learning/_mistake-reviews.js"), "utf8");

test("mistake notebook exposes an explicit review entry and full-screen workspace", () => {
  assert.match(html, /id="learningReviewStart">오답 다시 풀기/);
  assert.match(html, /id="learningReviewWorkspace"/);
  assert.match(styles, /\.learning-review-workspace\{position:fixed;inset:0/);
});

test("review start uses the scoped E-1 mutation contract", () => {
  assert.match(ui, /\/assignments\/\$\{encodeURIComponent\(requestAssignmentId\)\}\/mistake-reviews/);
  assert.match(ui, /assignedMemberId,[\s\S]*status:[\s\S]*stageId:[\s\S]*skillCode:[\s\S]*requestId: crypto\.randomUUID\(\)/);
  assert.match(ui, /method: "POST"/);
  assert.match(ui, /"X-Study-CSRF": "1"/);
});

test("an active review renders progress prompt and snapshot options", () => {
  assert.match(ui, /activeReviewItem\(\)/);
  assert.match(ui, /review\.items\.filter\(\(entry\) => entry\.reviewAnswer\)\.length/);
  assert.match(ui, /escapeHtml\(item\.prompt\)/);
  assert.match(ui, /options\.map/);
  assert.match(ui, /escapeHtml\(option\.text\)/);
});

test("option UUIDs stay in memory while markup receives only an option index", () => {
  assert.match(ui, /data-learning-review-option="\$\{index\}"/);
  assert.match(ui, /selectedReviewOptionId = item\?\.options\?\.\[Number\(reviewOption\.dataset\.learningReviewOption\)\]\?\.id/);
  assert.doesNotMatch(ui, /data-learning-review-option="\$\{(?:option\.id|selectedReviewOptionId)/);
});

test("answer submission uses only the E-2 lifecycle API and a fresh request key", () => {
  assert.match(ui, /\/mistake-reviews\/\$\{encodeURIComponent\(requestReviewId\)\}\/items\/\$\{encodeURIComponent\(requestItemId\)\}\/answers/);
  assert.match(ui, /JSON\.stringify\(\{ optionId: selectedReviewOptionId, requestId: crypto\.randomUUID\(\) \}\)/);
  assert.doesNotMatch(ui, /finalize_learning|stage_progress|sticker_transactions|reward/i);
});

test("submitted feedback is followed by a scoped server refresh", () => {
  assert.match(ui, /const refreshed = await requestJson\([\s\S]*\/mistake-reviews\/\$\{encodeURIComponent\(requestReviewId\)\}`/);
  assert.match(ui, /review = refreshed\.review/);
  assert.match(ui, /reviewFeedback = data\.feedback/);
});

test("correct and incorrect results are escaped and visually distinct", () => {
  assert.match(ui, /reviewFeedback\.isCorrect \? "정답입니다\." : "다시 확인해 보세요\."/);
  assert.match(ui, /escapeHtml\(reviewFeedback\.correctAnswer\)/);
  assert.match(ui, /escapeHtml\(reviewFeedback\.explanation\)/);
  assert.match(styles, /\.learning-review-result\.is-wrong/);
});

test("next-item action clears only transient feedback and selection", () => {
  assert.match(ui, /data-learning-review-next/);
  assert.match(ui, /reviewFeedback = null;[\s\S]*reviewFeedbackItemId = "";[\s\S]*selectedReviewOptionId = "";[\s\S]*render\(\)/);
});

test("completed and abandoned sessions have explicit terminal views", () => {
  assert.match(ui, /review\.status === "completed" \|\| review\.status === "abandoned"/);
  assert.match(ui, /오답 복습을 마쳤습니다/);
  assert.match(ui, /오답 복습을 중단했습니다/);
});

test("abandon requires confirmation and uses the E-2 endpoint", () => {
  assert.match(ui, /window\.confirm\("진행 중인 오답 복습을 중단할까요\?"\)/);
  assert.match(ui, /\/mistake-reviews\/\$\{encodeURIComponent\(requestReviewId\)\}\/abandon/);
  assert.match(ui, /JSON\.stringify\(\{ requestId: crypto\.randomUUID\(\) \}\)/);
});

test("resolution labels exactly follow the server contract", () => {
  for (const [status, label] of [
    ["unreviewed", "미복습"],
    ["retried_wrong", "재오답"],
    ["resolved", "해결"],
    ["repeated_wrong", "반복 오답"],
  ]) assert.match(ui, new RegExp(`${status}: "${label}"`));
  assert.match(ui, /REVIEW_STATUS_LABELS\[item\.resolutionStatus\]/);
});

test("resolution state is calculated by the scoped server read model", () => {
  assert.match(readModel, /const resolutionStatus = !reviewAnswer/);
  assert.match(readModel, /reviewAnswer\.is_correct === true[\s\S]*"resolved"/);
  assert.match(readModel, /wrongRoundCount >= 2 \? "repeated_wrong" : "retried_wrong"/);
  assert.match(readModel, /wrongRoundsByQuestion\.get\(questionId\)\.add\(String\(item\.session_id \|\| reviewId\)\)/);
  assert.doesNotMatch(ui, /wrongRoundCount|is_correct ===|source_attempt_question_id/);
});

test("unanswered item solutions remain absent from the review DTO", () => {
  assert.match(readModel, /solution: reviewAnswer \? \{/);
  assert.match(readModel, /correctAnswer: selectedOptionText\(question\.options_snapshot, question\.correct_option_id\)/);
  assert.match(readModel, /\} : null,[\s\S]*resolutionStatus/);
});

test("review has distinct loading empty and generic error states", () => {
  assert.match(ui, /오답 복습을 준비하는 중입니다/);
  assert.match(ui, /복습할 오답이 없습니다/);
  assert.match(ui, /오답 복습을 진행하지 못했습니다/);
  assert.doesNotMatch(ui, /error\.message|error\.code|cause\.message|service.?role|\/rest\/v1\//i);
});

test("child assignment and review switches discard stale start responses", () => {
  assert.match(ui, /requestGeneration !== generation/);
  assert.match(ui, /requestIdentity !== identity\(\)/);
  assert.match(ui, /requestAssignmentId !== assignmentId/);
});

test("session switches discard stale submit and abandon responses", () => {
  assert.match(ui, /requestReviewId !== review\?\.id/);
  assert.ok((ui.match(/requestReviewId !== review\?\.id/g) || []).length >= 2);
});

test("reset clears every review lifecycle state", () => {
  assert.match(ui, /review = null;[\s\S]*reviewLoading = false;[\s\S]*reviewFailed = false;[\s\S]*reviewSubmitting = false/);
  assert.match(ui, /reviewFeedbackItemId = ""/);
});

test("review output escapes all server display values", () => {
  assert.match(ui, /escapeHtml\(item\.stage\?\.title/);
  assert.match(ui, /escapeHtml\(item\.order\)/);
  assert.match(ui, /escapeHtml\(item\.prompt\)/);
  assert.match(ui, /escapeHtml\(item\.solution\.correctAnswer\)/);
  assert.match(ui, /escapeHtml\(item\.solution\.explanation\)/);
});

test("review UI never renders family source-attempt or question identifiers", () => {
  assert.doesNotMatch(ui, /data-[^=]*(?:family|source|attempt|question)-id/i);
  assert.doesNotMatch(ui, /family[_-]?id|source_attempt/i);
});

test("official score progress and reward separation is visible to the user", () => {
  assert.match(html, /복습 결과는 공식 점수·진도·보상에 영향을 주지 않습니다/);
  assert.match(ui, /복습 결과는 공식 점수·진도·보상을 변경하지 않습니다/);
});

test("review workspace remains usable on mobile", () => {
  const mobileRule = styles.split(/\r?\n/).find((line) => line.includes("@media (max-width:480px)")) || "";
  assert.match(mobileRule, /\.learning-review-actions[^{}]*\{[^}]*flex-direction:column/);
  assert.match(mobileRule, /\.learning-review-workspace\{[^}]*padding:14px/);
  assert.match(mobileRule, /\.learning-review-card footer\{[^}]*flex-direction:column/);
});
