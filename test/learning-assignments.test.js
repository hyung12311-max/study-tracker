const assert = require("node:assert/strict");
const test = require("node:test");

const utils = require("../server/api/rewards/_utils");
const catalogHandler = require("../server/api/learning/catalog");
const assignmentHandler = require("../server/api/learning/assignments");
const cancelHandler = require("../server/api/learning/assignments/[assignmentId]/cancel");

const FAMILY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PARENT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CHILD_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const OTHER_CHILD_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const COURSE_ID = "11111111-1111-4111-8111-111111111111";
const UNIT_ID = "22222222-2222-4222-8222-222222222222";
const VERSION_ID = "33333333-3333-4333-8333-333333333333";
const ASSIGNMENT_ID = "44444444-4444-4444-8444-444444444444";
const STAGE_ONE = "55555555-5555-4555-8555-555555555555";
const STAGE_TWO = "66666666-6666-4666-8666-666666666666";
const ATTEMPT_ID = "77777777-7777-4777-8777-777777777777";

function responseCapture() {
  return {
    statusCode: 0,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    end(value) { this.body = JSON.parse(value); },
  };
}

function replaceUtils(overrides) {
  const originals = {};
  for (const [key, value] of Object.entries(overrides)) {
    originals[key] = utils[key];
    utils[key] = value;
  }
  return () => Object.assign(utils, originals);
}

function request(method, url, body, extraHeaders = {}) {
  return {
    method,
    url,
    query: { assignmentId: ASSIGNMENT_ID },
    headers: {
      host: "study.example",
      origin: "https://study.example",
      "x-forwarded-proto": "https",
      "content-type": "application/json",
      "x-study-csrf": "1",
      ...extraHeaders,
    },
    testBody: body,
  };
}

function member(role = "parent", active = true, id = role === "parent" ? PARENT_ID : CHILD_ID) {
  return { id, family_id: FAMILY_ID, role, is_active: active };
}

function baseMocks({ role = "parent", active = true, body = {}, supabaseFetch }) {
  const id = role === "parent" ? PARENT_ID : CHILD_ID;
  return {
    authenticate: (_request, requiredRole) => {
      if (requiredRole && requiredRole !== role) {
        const error = utils.err("Parent permission is required.", 403);
        throw error;
      }
      return { sub: id, family: FAMILY_ID, role };
    },
    memberInFamily: async () => member(role, active, id),
    readJson: async () => body,
    supabaseFetch,
  };
}

function childScope(path) {
  if (!path.startsWith("family_members?")) return null;
  assert.match(path, new RegExp(`family_id=eq\\.${FAMILY_ID}`));
  assert.match(path, new RegExp(`id=eq\\.${CHILD_ID}`));
  assert.match(path, /role=eq\.child/);
  assert.match(path, /is_active=eq\.true/);
  return [{ id: CHILD_ID, family_id: FAMILY_ID, role: "child", is_active: true }];
}

function assignmentRows() {
  return {
    assignment: [{
      id: ASSIGNMENT_ID,
      unit_id: UNIT_ID,
      content_version_id: VERSION_ID,
      status: "active",
      assigned_at: "2026-07-31T00:00:00Z",
      completed_at: null,
      cancelled_at: null,
    }],
    unit: [{ id: UNIT_ID, course_id: COURSE_ID, display_title: "분수의 덧셈" }],
    course: [{ id: COURSE_ID, internal_name: "초등 수학 5", subject_name: "수학" }],
    stages: [
      { id: STAGE_ONE, content_version_id: VERSION_ID, display_order: 1, display_title: "기초", difficulty: "seed" },
      { id: STAGE_TWO, content_version_id: VERSION_ID, display_order: 2, display_title: "응용", difficulty: "leaf" },
    ],
    progress: [
      { assignment_id: ASSIGNMENT_ID, stage_id: STAGE_ONE, status: "unlocked", unlocked_at: "2026-07-31T00:00:00Z", passed_at: null },
      { assignment_id: ASSIGNMENT_ID, stage_id: STAGE_TWO, status: "locked", unlocked_at: null, passed_at: null },
    ],
    attempts: [{
      id: ATTEMPT_ID,
      assignment_id: ASSIGNMENT_ID,
      stage_id: STAGE_ONE,
      status: "in_progress",
      total_questions: 5,
      started_at: "2026-07-31T00:01:00Z",
    }],
  };
}

function scopedListFetch(path) {
  const rows = assignmentRows();
  assert.doesNotMatch(path, /learning_questions|learning_question_options/);
  if (path.startsWith("learning_assignments?")) {
    assert.match(path, new RegExp(`family_id=eq\\.${FAMILY_ID}`));
    assert.match(path, new RegExp(`assigned_member_id=eq\\.${CHILD_ID}`));
    return rows.assignment;
  }
  if (path.startsWith("learning_units?")) return rows.unit;
  if (path.startsWith("learning_courses?")) return rows.course;
  if (path.startsWith("learning_stages?")) return rows.stages;
  if (path.startsWith("learning_stage_progress?")) {
    assert.match(path, new RegExp(`family_id=eq\\.${FAMILY_ID}`));
    assert.match(path, new RegExp(`assigned_member_id=eq\\.${CHILD_ID}`));
    return rows.progress;
  }
  if (path.startsWith("learning_attempts?")) {
    assert.match(path, new RegExp(`family_id=eq\\.${FAMILY_ID}`));
    assert.match(path, new RegExp(`assigned_member_id=eq\\.${CHILD_ID}`));
    assert.match(path, /status=eq\.in_progress/);
    return rows.attempts;
  }
  return [];
}

test("unauthenticated learning requests return 401 before database access", async () => {
  let queried = false;
  const restore = replaceUtils({
    authenticate: () => { throw utils.err("Authentication is required.", 401, "AUTH_REQUIRED"); },
    supabaseFetch: async () => { queried = true; return []; },
  });
  try {
    const response = responseCapture();
    await assignmentHandler(request("GET", "/api/learning/assignments"), response);
    assert.equal(response.statusCode, 401);
    assert.equal(queried, false);
  } finally {
    restore();
  }
});

test("inactive parent and inactive child are blocked", async () => {
  for (const role of ["parent", "child"]) {
    let queried = false;
    const restore = replaceUtils(baseMocks({
      role,
      active: false,
      supabaseFetch: async () => { queried = true; return []; },
    }));
    try {
      const url = role === "parent"
        ? `/api/learning/assignments?assignedMemberId=${CHILD_ID}`
        : "/api/learning/assignments";
      const response = responseCapture();
      await assignmentHandler(request("GET", url), response);
      assert.equal(response.statusCode, 403);
      assert.equal(queried, false);
    } finally {
      restore();
    }
  }
});

test("parent catalog returns only published metadata and selected-child assignment state", async () => {
  const restore = replaceUtils(baseMocks({
    supabaseFetch: async (path) => {
      const child = childScope(path);
      if (child) return child;
      if (path.startsWith("learning_content_versions?")) {
        assert.match(path, /status=eq\.published/);
        return [{ id: VERSION_ID, unit_id: UNIT_ID }];
      }
      if (path.startsWith("learning_units?")) return [{ id: UNIT_ID, course_id: COURSE_ID, display_title: "분수의 덧셈", sort_order: 1 }];
      if (path.startsWith("learning_stages?")) return assignmentRows().stages;
      if (path.startsWith("learning_courses?")) {
        assert.match(path, /status=eq\.published/);
        return assignmentRows().course;
      }
      if (path.startsWith("learning_assignments?")) {
        assert.match(path, new RegExp(`assigned_member_id=eq\\.${CHILD_ID}`));
        return [{ unit_id: UNIT_ID, content_version_id: VERSION_ID }];
      }
      throw new Error(`Unexpected path: ${path}`);
    },
  }));
  try {
    const response = responseCapture();
    await catalogHandler(request("GET", `/api/learning/catalog?assignedMemberId=${CHILD_ID}`), response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.catalog.length, 1);
    assert.equal(response.body.catalog[0].alreadyAssigned, true);
    assert.equal(response.body.catalog[0].stageCount, 2);
    assert.doesNotMatch(JSON.stringify(response.body), /prompt|option_text|is_correct|explanation|content_hash/);
    assert.equal(response.headers["Cache-Control"], "no-store");
  } finally {
    restore();
  }
});

test("child cannot use the parent catalog", async () => {
  const restore = replaceUtils(baseMocks({ role: "child", supabaseFetch: async () => [] }));
  try {
    const response = responseCapture();
    await catalogHandler(request("GET", "/api/learning/catalog"), response);
    assert.equal(response.statusCode, 403);
  } finally {
    restore();
  }
});

test("parent creates assignments with session family and actor after published unit validation", async () => {
  const calls = [];
  const restore = replaceUtils(baseMocks({
    body: { assignedMemberId: CHILD_ID, unitId: UNIT_ID, contentVersionId: VERSION_ID },
    supabaseFetch: async (path, options = {}) => {
      calls.push({ path, options });
      const child = childScope(path);
      if (child) return child;
      if (path.startsWith("learning_content_versions?")) {
        assert.match(path, new RegExp(`unit_id=eq\\.${UNIT_ID}`));
        assert.match(path, /status=eq\.published/);
        return [{ id: VERSION_ID, unit_id: UNIT_ID, status: "published" }];
      }
      if (path === "rpc/create_learning_assignment") {
        const payload = JSON.parse(options.body);
        assert.deepEqual(payload, {
          p_family_id: FAMILY_ID,
          p_actor_member_id: PARENT_ID,
          p_assigned_member_id: CHILD_ID,
          p_content_version_id: VERSION_ID,
        });
        return [{ assignment_id: ASSIGNMENT_ID }];
      }
      return scopedListFetch(path);
    },
  }));
  try {
    const response = responseCapture();
    await assignmentHandler(request("POST", "/api/learning/assignments"), response);
    assert.equal(response.statusCode, 201);
    assert.equal(response.body.assignment.id, ASSIGNMENT_ID);
    assert.equal(typeof response.body.assignment.id, "string");
    assert.equal(response.body.assignment.stages[0].status, "unlocked");
    assert.equal(response.body.assignment.stages[1].status, "locked");
    assert.equal(calls.some((call) => call.path === "rpc/create_learning_assignment"), true);
  } finally {
    restore();
  }
});

test("assignment mutations require JSON, CSRF, and matching Origin before body or RPC", async () => {
  for (const headers of [
    { "x-study-csrf": "" },
    { origin: "https://evil.example" },
    { "content-type": "text/plain" },
  ]) {
    let bodyRead = false;
    let queried = false;
    const restore = replaceUtils(baseMocks({
      body: {},
      supabaseFetch: async () => { queried = true; return []; },
    }));
    const originalRead = utils.readJson;
    utils.readJson = async () => { bodyRead = true; return {}; };
    try {
      const response = responseCapture();
      await assignmentHandler(request("POST", "/api/learning/assignments", {}, headers), response);
      assert.ok([403, 415].includes(response.statusCode));
      assert.equal(bodyRead, false);
      assert.equal(queried, false);
    } finally {
      utils.readJson = originalRead;
      restore();
    }
  }
});

test("other-family or non-child targets are hidden behind the same 404", async () => {
  const restore = replaceUtils(baseMocks({
    body: { assignedMemberId: OTHER_CHILD_ID, unitId: UNIT_ID, contentVersionId: VERSION_ID },
    supabaseFetch: async (path) => path.startsWith("family_members?") ? [] : assert.fail("content query must not run"),
  }));
  try {
    const response = responseCapture();
    await assignmentHandler(request("POST", "/api/learning/assignments"), response);
    assert.equal(response.statusCode, 404);
    assert.equal(response.body.code, "LEARNING_TARGET_NOT_FOUND");
  } finally {
    restore();
  }
});

test("duplicate active logical-unit assignment maps to safe 409", async () => {
  const restore = replaceUtils(baseMocks({
    body: { assignedMemberId: CHILD_ID, unitId: UNIT_ID, contentVersionId: VERSION_ID },
    supabaseFetch: async (path) => {
      const child = childScope(path);
      if (child) return child;
      if (path.startsWith("learning_content_versions?")) return [{ id: VERSION_ID, unit_id: UNIT_ID, status: "published" }];
      if (path === "rpc/create_learning_assignment") {
        const error = new Error("Supabase rejected");
        error.supabaseCode = "23505";
        throw error;
      }
      return [];
    },
  }));
  try {
    const response = responseCapture();
    await assignmentHandler(request("POST", "/api/learning/assignments"), response);
    assert.equal(response.statusCode, 409);
    assert.equal(response.body.code, "ASSIGNMENT_EXISTS");
  } finally {
    restore();
  }
});

test("draft, retired, or mismatched unit versions return the same 404 without RPC", async () => {
  let rpcCalled = false;
  const restore = replaceUtils(baseMocks({
    body: { assignedMemberId: CHILD_ID, unitId: UNIT_ID, contentVersionId: VERSION_ID },
    supabaseFetch: async (path) => {
      const child = childScope(path);
      if (child) return child;
      if (path.startsWith("learning_content_versions?")) return [];
      if (path.startsWith("rpc/")) rpcCalled = true;
      return [];
    },
  }));
  try {
    const response = responseCapture();
    await assignmentHandler(request("POST", "/api/learning/assignments"), response);
    assert.equal(response.statusCode, 404);
    assert.equal(response.body.code, "LEARNING_CONTENT_NOT_FOUND");
    assert.equal(rpcCalled, false);
  } finally {
    restore();
  }
});

test("child reads only self assignments and cannot override the member id", async () => {
  for (const override of ["", OTHER_CHILD_ID]) {
    const restore = replaceUtils(baseMocks({
      role: "child",
      supabaseFetch: async (path) => {
        if (override) assert.fail("override must fail before list query");
        return scopedListFetch(path);
      },
    }));
    try {
      const response = responseCapture();
      await assignmentHandler(
        request("GET", `/api/learning/assignments${override ? `?assignedMemberId=${override}` : ""}`),
        response
      );
      assert.equal(response.statusCode, override ? 403 : 200);
      if (!override) {
        assert.equal(response.body.assignments[0].unitTitle, "분수의 덧셈");
        assert.equal(response.body.assignments[0].course, undefined);
        assert.equal(response.body.assignments[0].contentVersionId, undefined);
        assert.doesNotMatch(JSON.stringify(response.body), /초등 수학 5|prompt|explanation|is_correct/);
      }
    } finally {
      restore();
    }
  }
});

test("parent assignment list is scoped to the selected active child", async () => {
  const restore = replaceUtils(baseMocks({
    supabaseFetch: async (path) => {
      const child = childScope(path);
      if (child) return child;
      return scopedListFetch(path);
    },
  }));
  try {
    const response = responseCapture();
    await assignmentHandler(request("GET", `/api/learning/assignments?assignedMemberId=${CHILD_ID}`), response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.assignments[0].course.internalName, "초등 수학 5");
    assert.deepEqual(response.body.assignments[0].stages[0].attempt, {
      id: ATTEMPT_ID,
      status: "in_progress",
      totalQuestions: 5,
      startedAt: "2026-07-31T00:01:00Z",
    });
    assert.equal(response.body.assignments[0].stages[1].attempt, null);
  } finally {
    restore();
  }
});

test("parent cancels an active scoped assignment without deleting stage progress", async () => {
  const calls = [];
  const restore = replaceUtils(baseMocks({
    body: { assignedMemberId: CHILD_ID },
    supabaseFetch: async (path, options = {}) => {
      calls.push({ path, options });
      const child = childScope(path);
      if (child) return child;
      if (path.startsWith("learning_assignments?select=id,status")) {
        assert.match(path, new RegExp(`family_id=eq\\.${FAMILY_ID}`));
        assert.match(path, new RegExp(`assigned_member_id=eq\\.${CHILD_ID}`));
        return [{ id: ASSIGNMENT_ID, status: "active" }];
      }
      if (path === "rpc/cancel_learning_assignment") {
        assert.deepEqual(JSON.parse(options.body), {
          p_family_id: FAMILY_ID,
          p_actor_member_id: PARENT_ID,
          p_assigned_member_id: CHILD_ID,
          p_assignment_id: ASSIGNMENT_ID,
        });
        return { id: ASSIGNMENT_ID, status: "cancelled", cancelled_at: "2026-07-31T01:00:00Z" };
      }
      throw new Error(`Unexpected path: ${path}`);
    },
  }));
  try {
    const response = responseCapture();
    await cancelHandler(request(
      "POST",
      `/api/learning/assignments/${ASSIGNMENT_ID}/cancel`,
      { assignedMemberId: CHILD_ID }
    ), response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.assignment.status, "cancelled");
    assert.equal(calls.some(({ path }) => /learning_stage_progress/.test(path)), false);
    assert.equal(calls.some(({ path, options }) => options.method === "DELETE" || /^learning_stage_progress/.test(path)), false);
  } finally {
    restore();
  }
});

test("completed or cancelled assignments cannot be cancelled again", async () => {
  for (const status of ["completed", "cancelled"]) {
    let rpcCalled = false;
    const restore = replaceUtils(baseMocks({
      body: { assignedMemberId: CHILD_ID },
      supabaseFetch: async (path) => {
        const child = childScope(path);
        if (child) return child;
        if (path.startsWith("learning_assignments?select=id,status")) return [{ id: ASSIGNMENT_ID, status }];
        if (path.startsWith("rpc/")) rpcCalled = true;
        return [];
      },
    }));
    try {
      const response = responseCapture();
      await cancelHandler(request("POST", `/api/learning/assignments/${ASSIGNMENT_ID}/cancel`), response);
      assert.equal(response.statusCode, 409);
      assert.equal(response.body.code, "ASSIGNMENT_NOT_ACTIVE");
      assert.equal(rpcCalled, false);
    } finally {
      restore();
    }
  }
});
