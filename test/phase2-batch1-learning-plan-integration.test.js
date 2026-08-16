const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const utils = require("../server/api/rewards/_utils");
const assignmentsHandler = require("../server/api/learning/assignments");
const roadmapHandler = require("../server/api/learning/roadmap");

const root = path.join(__dirname, "..");
const learningUi = fs.readFileSync(path.join(root, "js/learning.js"), "utf8");
const assignmentApi = fs.readFileSync(path.join(root, "server/api/learning/assignments.js"), "utf8");

const FAMILY = "10000000-0000-4000-8000-000000000001";
const CHILD = "20000000-0000-4000-8000-000000000001";
const ASSIGNMENT = "30000000-0000-4000-8000-000000000001";
const UNIT = "40000000-0000-4000-8000-000000000001";
const VERSION = "50000000-0000-4000-8000-000000000001";
const STAGE = "60000000-0000-4000-8000-000000000001";
const PLAN = "70000000-0000-4000-8000-000000000001";

function replace(overrides) {
  const originals = {};
  for (const [key, value] of Object.entries(overrides)) {
    originals[key] = utils[key];
    utils[key] = value;
  }
  return () => Object.assign(utils, originals);
}

test("A: Parent assignment creation sends one atomic assignment plus Learning Plan request", () => {
  assert.match(assignmentApi, /rpc\/create_learning_assignment_with_plan/);
  assert.match(learningUi, /\/api\/learning\/assignments/);
  assert.match(learningUi, /plan:\s*\{[\s\S]*plannedStartDate[\s\S]*unitTargetCompletionDate[\s\S]*stageTargets/);
  const createJourney = learningUi.match(/async function assign\([\s\S]*?\n  async function savePlan/)?.[0] || "";
  assert.doesNotMatch(createJourney, /POST[\s\S]*\/api\/learning\/plans/);
});

test("B C D: Parent UI uses canonical create revise pause and resume Learning Plan routes", () => {
  assert.match(learningUi, /\/api\/learning\/plans\?assignedMemberId=/);
  assert.match(learningUi, /\/api\/learning\/plans\/\$\{encodeURIComponent\([^)]*\)\}/);
  assert.match(learningUi, /method:\s*"PUT"/);
  assert.match(learningUi, /"\/pause"/);
  assert.match(learningUi, /"\/resume"/);
  assert.match(learningUi, /expectedRevision/);
});

test("E: Child assignment DTO exposes only safe target dates progress and actionable state", async () => {
  let planState = "active";
  const restore = replace({
    supabaseFetch: async (query) => {
      if (query.startsWith("learning_assignments?")) return [{
        id: ASSIGNMENT,
        unit_id: UNIT,
        content_version_id: VERSION,
        status: "active",
        assigned_at: "2026-08-16T00:00:00Z",
        completed_at: null,
        cancelled_at: null,
      }];
      if (query.startsWith("learning_units?")) return [{ id: UNIT, course_id: UNIT, display_title: "세 자리 수" }];
      if (query.startsWith("learning_stages?")) return [{ id: STAGE, content_version_id: VERSION, display_order: 1, display_title: "입문", difficulty: "seed" }];
      if (query.startsWith("learning_stage_progress?")) return [{ assignment_id: ASSIGNMENT, stage_id: STAGE, status: "unlocked", unlocked_at: "2026-08-16T00:00:00Z", passed_at: null }];
      if (query.startsWith("learning_attempts?")) return [];
      if (query.startsWith("learning_courses?")) return [{ id: UNIT, internal_name: "수학", subject_name: "수학" }];
      if (query.startsWith("learning_assignment_plans?")) return [{ id: PLAN, assignment_id: ASSIGNMENT, plan_state: planState, planned_start_date: "2026-08-16", target_completion_date: "2026-08-19", timezone_name: "Asia/Seoul", revision: 4 }];
      if (query.startsWith("learning_assignment_stage_targets?")) return [{ plan_id: PLAN, assignment_id: ASSIGNMENT, stage_id: STAGE, display_order: 1, target_date: "2026-08-16" }];
      throw new Error(`unexpected query: ${query}`);
    },
  });
  try {
    const [assignment] = await assignmentsHandler.listForScope({ family: FAMILY }, CHILD, "child");
    assert.deepEqual(assignment.target, {
      state: "active",
      plannedStartDate: "2026-08-16",
      unitTargetCompletionDate: "2026-08-19",
    });
    assert.equal(assignment.stages[0].targetDate, "2026-08-16");
    assert.equal(assignment.stages[0].actionable, true);
    assert.doesNotMatch(JSON.stringify(assignment), /Asia\/Seoul|revision|planId|configuredBy/i);
    planState = "paused";
    const [pausedAssignment] = await assignmentsHandler.listForScope({ family: FAMILY }, CHILD, "child");
    assert.equal(pausedAssignment.target.state, "paused");
    assert.equal(pausedAssignment.stages[0].actionable, false);
  } finally {
    restore();
  }
});

test("F: a current active assignment takes roadmap precedence over completed history", () => {
  const rows = [
    { id: "completed", unit_id: UNIT, status: "completed" },
    { id: "active", unit_id: UNIT, status: "active" },
  ];
  assert.equal(roadmapHandler.assignmentStates(rows).get(UNIT), "active");
  assert.equal(roadmapHandler.representativeAssignments(rows).get(UNIT).id, "active");
});

test("G and reload: Learning Plan UI is isolated from legacy Study Plan and restores canonical state", () => {
  assert.doesNotMatch(learningUi, /\/api\/study\/plans/);
  assert.match(learningUi, /planning\s*=\s*planningData\.planning/);
  assert.match(learningUi, /currentRevision/);
  assert.match(learningUi, /plannedStartDate/);
  assert.match(learningUi, /unitTargetCompletionDate/);
  assert.match(learningUi, /plan\.state/);
});
