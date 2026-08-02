const assert = require("node:assert/strict");
const test = require("node:test");

const utils = require("../server/api/rewards/_utils");
const handler = require("../server/api/learning/plans");

const FAMILY = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PARENT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CHILD = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const ASSIGNMENT = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const PLAN = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const UNIT = "11111111-1111-4111-8111-111111111111";
const VERSION = "22222222-2222-4222-8222-222222222222";
const REQUEST = "33333333-3333-4333-8333-333333333333";
const STAGES = [
  "44444444-4444-4444-8444-444444444441",
  "44444444-4444-4444-8444-444444444442",
  "44444444-4444-4444-8444-444444444443",
  "44444444-4444-4444-8444-444444444444",
];

function response() {
  return { statusCode: 0, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(v) { this.body = JSON.parse(v); } };
}

function request(method, url, body = {}) {
  return {
    method, url, query: {}, testBody: body,
    headers: { host: "study.example", origin: "https://study.example", "x-forwarded-proto": "https", "content-type": "application/json", "x-study-csrf": "1" },
  };
}

function replace(overrides) {
  const original = {};
  for (const [key, value] of Object.entries(overrides)) { original[key] = utils[key]; utils[key] = value; }
  return () => Object.assign(utils, original);
}

function targets() {
  return STAGES.map((stageId, index) => ({ stageId, displayOrder: index + 1, targetDate: `2026-08-${String(3 + index).padStart(2, "0")}` }));
}

function body(extra = {}) {
  return { assignedMemberId: CHILD, assignmentId: ASSIGNMENT, plannedStartDate: "2026-08-01", unitTargetCompletionDate: "2026-08-10", timezone: "Asia/Seoul", stageTargets: targets(), requestId: REQUEST, ...extra };
}

function base(supabaseFetch, requestBody = body()) {
  return {
    authenticate: (_request, role) => { assert.equal(role, "parent"); return { sub: PARENT, family: FAMILY, role: "parent" }; },
    memberInFamily: async () => ({ id: PARENT, family_id: FAMILY, role: "parent", is_active: true }),
    readJson: async () => requestBody,
    supabaseFetch,
  };
}

function child(path) {
  if (!path.startsWith("family_members?")) return null;
  return [{ id: CHILD, family_id: FAMILY, role: "child", is_active: true }];
}

test("parent planning list returns legacy and planned assignments with first-pass actual dates", async () => {
  const restore = replace(base(async (path) => {
    if (child(path)) return child(path);
    if (path.startsWith("learning_assignments?")) return [
      { id: ASSIGNMENT, unit_id: UNIT, content_version_id: VERSION, status: "active", completed_at: null },
      { id: "99999999-9999-4999-8999-999999999999", unit_id: UNIT, content_version_id: VERSION, status: "cancelled", completed_at: null },
    ];
    if (path.startsWith("learning_assignment_plans?")) return [{ id: PLAN, assignment_id: ASSIGNMENT, planned_start_date: "2026-08-01", target_completion_date: "2026-08-10", timezone_name: "Asia/Seoul", plan_state: "paused", paused_at: "2026-08-02T00:00:00Z", revision: 2 }];
    if (path.startsWith("learning_assignment_stage_targets?")) return STAGES.map((stage_id, i) => ({ plan_id: PLAN, assignment_id: ASSIGNMENT, stage_id, display_order: i + 1, target_date: `2026-08-0${i + 3}` }));
    if (path.startsWith("learning_stage_first_passes?")) return [{ assignment_id: ASSIGNMENT, stage_id: STAGES[0], passed_at: "2026-08-03T01:00:00Z" }];
    if (path.startsWith("learning_stage_progress?")) return [{ assignment_id: ASSIGNMENT, stage_id: STAGES[1], passed_at: "2026-08-04T01:00:00Z" }];
    throw new Error(path);
  }));
  try {
    const res = response();
    await handler(request("GET", `/api/learning/plans?assignedMemberId=${CHILD}`), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.planning[0].plan.state, "paused");
    assert.equal(res.body.planning[0].plan.currentRevision, 2);
    assert.equal(res.body.planning[0].plan.stageTargets[0].actualPassedAt, "2026-08-03T01:00:00Z");
    assert.equal(res.body.planning[0].plan.stageTargets[1].actualPassedAt, "2026-08-04T01:00:00Z");
    assert.equal(res.body.planning[1].legacyAssignment, true);
    assert.equal(res.body.planning[1].plan, null);
    assert.doesNotMatch(JSON.stringify(res.body), /changed_by|previous_snapshot|family_id/);
  } finally { restore(); }
});

test("parent creates a plan through the scoped canonical wrapper", async () => {
  let payload;
  const restore = replace(base(async (path, options = {}) => {
    if (child(path)) return child(path);
    if (path.startsWith("learning_assignments?")) return [{ id: ASSIGNMENT, status: "active", completed_at: null }];
    if (path === "rpc/create_learning_assignment_plan") {
      payload = JSON.parse(options.body);
      return [{ plan_id: PLAN, assignment_id: ASSIGNMENT, plan_revision: 1, plan_state: "active", planned_start_date: "2026-08-01", target_completion_date: "2026-08-10", timezone_name: "Asia/Seoul", paused_at: null, stage_targets: payload.p_stage_targets }];
    }
    throw new Error(path);
  }));
  try {
    const res = response();
    await handler(request("POST", "/api/learning/plans", body()), res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.plan.id, PLAN);
    assert.equal(payload.p_family_id, FAMILY);
    assert.equal(payload.p_actor_member_id, PARENT);
    assert.equal(payload.p_assigned_member_id, CHILD);
    assert.equal(payload.p_stage_targets.length, 4);
  } finally { restore(); }
});

test("strict date timezone revision and target validation reject before RPC", () => {
  assert.throws(() => handler.planPayload(body({ plannedStartDate: "2026-02-30" })), /날짜/);
  assert.throws(() => handler.planPayload(body({ timezone: "Not/AZone" })), /시간대/);
  assert.throws(() => handler.planPayload(body({ stageTargets: targets().slice(0, 3).map((target, i) => ({ ...target, displayOrder: i + 2 })) })), /순서/);
});

test("planning mutations require CSRF and parent authentication", async () => {
  let queried = false;
  const restore = replace(base(async () => { queried = true; return []; }));
  try {
    const req = request("POST", "/api/learning/plans", body());
    req.headers["x-study-csrf"] = "";
    const res = response();
    await handler(req, res);
    assert.equal(res.statusCode, 403);
    assert.equal(queried, false);
  } finally { restore(); }
});

test("update pause and resume send optimistic revision and scoped request ids", async () => {
  const updateBody = body({ expectedRevision: 2 });
  delete updateBody.assignmentId;
  const operations = [
    [handler.item, "PUT", "rpc/update_learning_assignment_plan", updateBody],
    [handler.pause, "POST", "rpc/pause_learning_assignment_plan", { assignedMemberId: CHILD, expectedRevision: 2, requestId: REQUEST }],
    [handler.resume, "POST", "rpc/resume_learning_assignment_plan", { assignedMemberId: CHILD, expectedRevision: 3, requestId: REQUEST }],
  ];
  for (const [operation, method, rpc, requestBody] of operations) {
    let rpcPayload;
    const restore = replace(base(async (path, options = {}) => {
      if (child(path)) return child(path);
      if (path.startsWith("learning_assignment_plans?")) return [{ id: PLAN, assignment_id: ASSIGNMENT, family_id: FAMILY, assigned_member_id: CHILD }];
      if (path === rpc) {
        rpcPayload = JSON.parse(options.body);
        return [{ plan_id: PLAN, assignment_id: ASSIGNMENT, plan_revision: rpc.includes("resume") ? 4 : 3, plan_state: rpc.includes("pause") ? "paused" : "active", planned_start_date: "2026-08-01", target_completion_date: "2026-08-10", timezone_name: "Asia/Seoul", paused_at: rpc.includes("pause") ? "2026-08-02T00:00:00Z" : null, stage_targets: targets().map((target) => ({ stage_id: target.stageId, display_order: target.displayOrder, target_date: target.targetDate })) }];
      }
      throw new Error(path);
    }, requestBody));
    try {
      const req = request(method, `/api/learning/plans/${PLAN}`, requestBody);
      req.query.planId = PLAN;
      const res = response();
      await operation(req, res);
      assert.equal(res.statusCode, 200);
      assert.equal(rpcPayload.p_family_id, FAMILY);
      assert.equal(rpcPayload.p_assigned_member_id, CHILD);
      assert.equal(rpcPayload.p_plan_id, PLAN);
      assert.equal(rpcPayload.p_expected_revision, requestBody.expectedRevision);
      assert.equal(rpcPayload.p_request_id, REQUEST);
    } finally { restore(); }
  }
});

test("named concurrency and completion errors use stable safe envelopes", async () => {
  for (const [message, code] of [["PLAN_REVISION_CONFLICT", "PLAN_REVISION_CONFLICT"], ["PLAN_LOCKED_AFTER_COMPLETION", "PLAN_LOCKED_AFTER_COMPLETION"], ["IDEMPOTENCY_CONFLICT", "IDEMPOTENCY_CONFLICT"]]) {
    const restore = replace(base(async (path) => {
      if (child(path)) return child(path);
      if (path.startsWith("learning_assignments?")) return [{ id: ASSIGNMENT, status: "active" }];
      if (path === "rpc/create_learning_assignment_plan") { const e = new Error("db"); e.supabaseCode = "55000"; e.supabaseMessage = message; throw e; }
      throw new Error(path);
    }));
    try {
      const res = response();
      await handler(request("POST", "/api/learning/plans", body()), res);
      assert.equal(res.statusCode, 409);
      assert.equal(res.body.code, code);
      assert.doesNotMatch(JSON.stringify(res.body), /P000|SQL|55000/);
    } finally { restore(); }
  }
});
