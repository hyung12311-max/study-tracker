const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const helperPath = path.join(root, "js/learning-today.js");
const learningSource = fs.readFileSync(path.join(root, "js/learning.js"), "utf8");
const htmlSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
const stylesSource = fs.readFileSync(path.join(root, "css/styles.css"), "utf8");

async function todayModule() {
  assert.equal(fs.existsSync(helperPath), true, "Child Today helper must exist");
  const source = fs.readFileSync(helperPath, "utf8");
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
}

function assignment(id, targetDate, overrides = {}) {
  return {
    id,
    unitTitle: `단원 ${id}`,
    status: "active",
    target: { state: "active", plannedStartDate: "2026-08-01", unitTargetCompletionDate: "2026-08-31" },
    stages: [{
      id: `stage-${id}`,
      title: `단계 ${id}`,
      difficulty: "seed",
      order: 1,
      status: "unlocked",
      targetDate,
      actionable: true,
      attempt: null,
    }],
    ...overrides,
  };
}

test("A: Today candidates sort overdue today soon upcoming and no target exactly", async () => {
  const { deriveLearningToday } = await todayModule();
  const result = deriveLearningToday([
    assignment("no-target", null),
    assignment("upcoming", "2026-08-20"),
    assignment("soon", "2026-08-17"),
    assignment("today", "2026-08-16"),
    assignment("overdue", "2026-08-15"),
  ], { today: "2026-08-16" });
  assert.deepEqual(result.map((item) => item.dueState), ["overdue", "dueToday", "dueSoon", "upcoming", "noTarget"]);
});

test("B: sequential progression selects only the current unlocked unpassed stage", async () => {
  const { deriveLearningToday } = await todayModule();
  const value = assignment("sequence", "2026-08-16", { stages: [
    { id: "stage-1", title: "1", order: 1, status: "passed", targetDate: "2026-08-15", actionable: false, attempt: null },
    { id: "stage-2", title: "2", order: 2, status: "unlocked", targetDate: "2026-08-16", actionable: true, attempt: null },
    { id: "stage-3", title: "3", order: 3, status: "locked", targetDate: "2026-08-14", actionable: false, attempt: null },
  ] });
  assert.deepEqual(deriveLearningToday([value], { today: "2026-08-16" }).map((item) => item.stageTitle), ["2"]);
});

test("C: paused plan stays visible but cannot start or resume", async () => {
  const { deriveLearningToday } = await todayModule();
  const value = assignment("paused", "2026-08-15");
  value.target.state = "paused";
  value.stages[0].actionable = false;
  const [item] = deriveLearningToday([value], { today: "2026-08-16" });
  assert.equal(item.dueState, "overdue");
  assert.equal(item.actionable, false);
  assert.equal(item.actionType, "paused");
  assert.match(learningSource, /item\.actionType === "paused"/);
});

test("D: plan-less active assignment remains visible and actionable with noTarget", async () => {
  const { deriveLearningToday } = await todayModule();
  const value = assignment("legacy", null, { target: null });
  const [item] = deriveLearningToday([value], { today: "2026-08-16" });
  assert.equal(item.dueState, "noTarget");
  assert.equal(item.actionable, true);
  assert.equal(item.actionType, "start");
});

test("E: in-progress current stage resumes without creating a duplicate attempt", async () => {
  const { deriveLearningToday } = await todayModule();
  const value = assignment("resume", "2026-08-16");
  value.stages[0].attempt = { id: "attempt-1", status: "in_progress" };
  const [item] = deriveLearningToday([value], { today: "2026-08-16" });
  assert.equal(item.actionType, "resume");
  assert.match(learningSource, /data-learning-action="\$\{item\.actionType === "resume" \? "resume-attempt" : "start-attempt"\}"/);
});

test("F: multiple assignments remain isolated and use deterministic tie breaking", async () => {
  const { deriveLearningToday } = await todayModule();
  const result = deriveLearningToday([
    assignment("b-assignment", "2026-08-16"),
    assignment("a-assignment", "2026-08-16"),
  ], { today: "2026-08-16" });
  assert.deepEqual(result.map((item) => item.assignmentKey), ["a-assignment", "b-assignment"]);
  assert.deepEqual(result.map((item) => item.stageKey), ["stage-a-assignment", "stage-b-assignment"]);
});

test("G: Today view model and rendering exclude Parent-only planning metadata", async () => {
  const { deriveLearningToday } = await todayModule();
  const [item] = deriveLearningToday([assignment("safe", "2026-08-16")], { today: "2026-08-16" });
  assert.doesNotMatch(JSON.stringify(item), /planId|revision|configuredBy|timezone|familyId|memberId/i);
  const renderToday = learningSource.match(/function renderToday\([\s\S]*?\n  function renderAssignments/)?.[0] || "";
  assert.doesNotMatch(renderToday, /planId|revision|configuredBy|timezone|familyId|memberId/i);
});

test("H: date-only comparison respects local calendar boundaries", async () => {
  const { dueStateForDate } = await todayModule();
  assert.equal(dueStateForDate("2026-08-15", "2026-08-16"), "overdue");
  assert.equal(dueStateForDate("2026-08-16", "2026-08-16"), "dueToday");
  assert.equal(dueStateForDate("2026-08-17", "2026-08-16"), "dueSoon");
  assert.equal(dueStateForDate("2026-08-20", "2026-08-16"), "upcoming");
  assert.equal(dueStateForDate(null, "2026-08-16"), "noTarget");
});

test("I: completed assignments never become Today candidates", async () => {
  const { deriveLearningToday } = await todayModule();
  const completed = assignment("completed", "2026-08-15", { status: "completed" });
  assert.deepEqual(deriveLearningToday([completed], { today: "2026-08-16" }), []);
});

test("Today UI provides loading empty safe-error mobile and accessible button contracts", () => {
  assert.match(htmlSource, /id="childLearningTodaySection"[^>]*aria-labelledby="childLearningTodayTitle"[^>]*aria-busy="true"/);
  assert.match(htmlSource, /id="childLearningToday"[^>]*aria-live="polite"/);
  assert.match(learningSource, /오늘 할 일을 불러오는 중이에요/);
  assert.match(learningSource, /오늘 해야 할 학습이 없어요/);
  assert.match(learningSource, /오늘 할 일을 불러오지 못했어요/);
  assert.match(learningSource, /<button type="button" class="primary learning-today-cta"/);
  assert.match(learningSource, /<button type="button" class="learning-today-cta" disabled>일시정지된 계획<\/button>/);
  assert.match(learningSource, /aria-label=/);
  assert.match(stylesSource, /\.learning-today-cta\s*\{[^}]*min-height:\s*44px/);
  assert.match(stylesSource, /@media \(max-width: 360px\)[\s\S]*\.learning-today-list\s*\{[^}]*minmax\(0,1fr\)/);
  assert.match(stylesSource, /\.learning-today-card\s*\{[^}]*min-width:\s*0/);
});
