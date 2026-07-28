const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const utils = require("../server/api/rewards/_utils");
const handler = require("../server/api/study/plans");

const FAMILY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PARENT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CHILD_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const OTHER_CHILD_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

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

function validPlan(overrides = {}) {
  return {
    assignedMemberId: CHILD_ID,
    subject: "수학",
    book: "최상위 수학",
    unit: "분수",
    lessonNo: "3차시",
    studyDate: "2026-07-29",
    dayNo: "12일차",
    content: "개념 익히기",
    target: "42~45쪽",
    status: "예정",
    ...overrides,
  };
}

function parentMocks(body, supabaseFetch) {
  return {
    authenticate: (_request, role) => {
      if (role && role !== "parent") throw utils.err("권한이 없습니다.", 403);
      return { sub: PARENT_ID, family: FAMILY_ID, role: "parent" };
    },
    memberInFamily: async () => ({ id: PARENT_ID, family_id: FAMILY_ID, role: "parent", is_active: true }),
    readJson: async () => body,
    supabaseFetch,
  };
}

test("parent create forces session ownership and validates the active child", async () => {
  const calls = [];
  const restore = replaceUtils(parentMocks(validPlan(), async (requestPath, options = {}) => {
    calls.push({ path: requestPath, options });
    if (requestPath.startsWith("family_members?")) return [{ id: CHILD_ID }];
    if (requestPath === "study_plans") return [{ id: 43, ...JSON.parse(options.body) }];
    return [];
  }));
  try {
    const response = responseCapture();
    await handler({ method: "POST", headers: {} }, response);
    assert.equal(response.statusCode, 201);
    const inserted = JSON.parse(calls.find((call) => call.path === "study_plans").options.body);
    assert.equal(inserted.family_id, FAMILY_ID);
    assert.equal(inserted.assigned_member_id, CHILD_ID);
    assert.equal(inserted.created_by_member_id, PARENT_ID);
    assert.equal(inserted.workbook, "최상위 수학");
    assert.ok(calls.some((call) => call.path.includes("role=eq.child&is_active=eq.true")));
  } finally {
    restore();
  }
});

for (const [name, assigneeResult] of [
  ["another-family child", []],
  ["inactive child", []],
  ["parent assignee", []],
]) {
  test(`create rejects ${name} without writing`, async () => {
    let wrote = false;
    const restore = replaceUtils(parentMocks(validPlan({ assignedMemberId: OTHER_CHILD_ID }), async (requestPath) => {
      if (requestPath.startsWith("family_members?")) return assigneeResult;
      wrote = true;
      return [];
    }));
    try {
      const response = responseCapture();
      await handler({ method: "POST", headers: {} }, response);
      assert.equal(response.statusCode, 403);
      assert.equal(response.body.code, "ASSIGNED_MEMBER_NOT_ALLOWED");
      assert.equal(wrote, false);
    } finally {
      restore();
    }
  });
}

test("child cannot call parent CRUD", async () => {
  let readBody = false;
  const restore = replaceUtils({
    authenticate: (_request, role) => {
      if (role === "parent") throw utils.err("Parent permission is required.", 403, "PARENT_REQUIRED");
      return { sub: CHILD_ID, family: FAMILY_ID, role: "child" };
    },
    readJson: async () => { readBody = true; return validPlan(); },
  });
  try {
    const response = responseCapture();
    await handler({ method: "POST", headers: {} }, response);
    assert.equal(response.statusCode, 403);
    assert.equal(readBody, false);
  } finally {
    restore();
  }
});

test("unauthenticated requests return 401 before reading input", async () => {
  let readBody = false;
  const restore = replaceUtils({
    authenticate: () => { throw utils.err("Authentication is required.", 401, "AUTH_REQUIRED"); },
    readJson: async () => { readBody = true; return validPlan(); },
  });
  try {
    const response = responseCapture();
    await handler({ method: "POST", headers: {} }, response);
    assert.equal(response.statusCode, 401);
    assert.equal(response.body.code, "AUTH_REQUIRED");
    assert.equal(readBody, false);
  } finally {
    restore();
  }
});

test("update is family-scoped and never rewrites creator ownership", async () => {
  const calls = [];
  const body = { id: "42", assignedMemberId: CHILD_ID, subject: "새 과목" };
  const restore = replaceUtils(parentMocks(body, async (requestPath, options = {}) => {
    calls.push({ path: requestPath, options });
    if (requestPath.startsWith("family_members?")) return [{ id: CHILD_ID }];
    if (requestPath.startsWith("study_plans?select=")) {
      return [{ id: 42, family_id: FAMILY_ID, assigned_member_id: CHILD_ID, created_by_member_id: null }];
    }
    if (options.method === "PATCH") return [{ id: 42, subject: "새 과목", assigned_member_id: CHILD_ID }];
    return [];
  }));
  try {
    const response = responseCapture();
    await handler({ method: "PATCH", headers: {} }, response);
    assert.equal(response.statusCode, 200);
    const patch = calls.find((call) => call.options.method === "PATCH");
    assert.match(patch.path, /id=eq\.42&family_id=eq\./);
    assert.match(patch.path, new RegExp(`assigned_member_id=eq\\.${CHILD_ID}`));
    const changes = JSON.parse(patch.options.body);
    assert.equal(changes.subject, "새 과목");
    assert.equal("assigned_member_id" in changes, false);
    assert.equal("family_id" in changes, false);
    assert.equal("created_by_member_id" in changes, false);
  } finally {
    restore();
  }
});

test("update and delete hide plans owned by another family", async () => {
  for (const method of ["PATCH", "DELETE"]) {
    let wrote = false;
    const body = method === "PATCH"
      ? { id: "42", assignedMemberId: CHILD_ID, subject: "변경" }
      : { id: "42", assignedMemberId: CHILD_ID };
    const restore = replaceUtils(parentMocks(body, async (requestPath, options = {}) => {
      if (requestPath.startsWith("family_members?")) return [{ id: CHILD_ID }];
      if (requestPath.startsWith("study_plans?select=")) return [];
      if (options.method === method) wrote = true;
      return [];
    }));
    try {
      const response = responseCapture();
      await handler({ method, headers: {} }, response);
      assert.equal(response.statusCode, 404);
      assert.equal(response.body.code, "PLAN_NOT_FOUND");
      assert.equal(wrote, false);
    } finally {
      restore();
    }
  }
});

test("delete preserves the existing single-plan scope", async () => {
  const calls = [];
  const restore = replaceUtils(parentMocks({ id: "42", assignedMemberId: CHILD_ID }, async (requestPath, options = {}) => {
    calls.push({ path: requestPath, options });
    if (requestPath.startsWith("family_members?")) return [{ id: CHILD_ID }];
    if (requestPath.startsWith("study_plans?select=")) return [{ id: 42, family_id: FAMILY_ID, assigned_member_id: CHILD_ID }];
    if (options.method === "DELETE") return [{ id: 42 }];
    return [];
  }));
  try {
    const response = responseCapture();
    await handler({ method: "DELETE", headers: {} }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.deletedPlanId, "42");
    const deletion = calls.find((call) => call.options.method === "DELETE");
    assert.match(deletion.path, /^study_plans\?id=eq\.42&family_id=eq\./);
    assert.match(deletion.path, new RegExp(`assigned_member_id=eq\\.${CHILD_ID}`));
    assert.doesNotMatch(deletion.path, /book_plan_id|reading_plan_id|sequence_no/);
  } finally {
    restore();
  }
});

test("bulk late update checks every plan against the session family and selected child", async () => {
  const calls = [];
  const restore = replaceUtils(parentMocks({ ids: ["40", "41"], status: "지연", assignedMemberId: CHILD_ID }, async (requestPath, options = {}) => {
    calls.push({ path: requestPath, options });
    if (requestPath.startsWith("family_members?")) return [{ id: CHILD_ID }];
    if (requestPath.startsWith("study_plans?select=")) return [{ id: 40 }, { id: 41 }];
    if (options.method === "PATCH") return [{ id: 40, status: "지연" }, { id: 41, status: "지연" }];
    return [];
  }));
  try {
    const response = responseCapture();
    await handler({ method: "PATCH", headers: {} }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.plans.length, 2);
    const patch = calls.find((call) => call.options.method === "PATCH");
    assert.match(patch.path, /^study_plans\?id=in\.\(40,41\)&family_id=eq\./);
    assert.match(patch.path, new RegExp(`assigned_member_id=eq\\.${CHILD_ID}`));
    assert.deepEqual(JSON.parse(patch.options.body), { status: "지연" });
  } finally {
    restore();
  }
});

for (const id of ["", "0", "-1", "1.5", "1e3", "abc", "9223372036854775808", "12345678901234567890"]) {
  test(`malformed bigint plan id is rejected: ${id || "(empty)"}`, async () => {
    let queriedPlan = false;
    const restore = replaceUtils(parentMocks({ id, assignedMemberId: CHILD_ID, subject: "변경" }, async (requestPath) => {
      if (requestPath.startsWith("family_members?")) return [{ id: CHILD_ID }];
      if (requestPath.startsWith("study_plans?")) queriedPlan = true;
      return [];
    }));
    try {
      const response = responseCapture();
      await handler({ method: "PATCH", headers: {} }, response);
      assert.equal(response.statusCode, 400);
      assert.equal(response.body.code, "INVALID_PLAN_ID");
      assert.equal(queriedPlan, false);
    } finally {
      restore();
    }
  });
}

for (const forbidden of [
  { familyId: "attacker-family" },
  { family_id: "attacker-family" },
  { createdByMemberId: OTHER_CHILD_ID },
  { created_by_member_id: OTHER_CHILD_ID },
  { admin: true },
]) {
  test(`create rejects non-allowlisted field ${Object.keys(forbidden)[0]}`, async () => {
    let wrote = false;
    const restore = replaceUtils(parentMocks(validPlan(forbidden), async () => {
      wrote = true;
      return [];
    }));
    try {
      const response = responseCapture();
      await handler({ method: "POST", headers: {} }, response);
      assert.equal(response.statusCode, 400);
      assert.equal(response.body.code, "PLAN_FIELD_NOT_ALLOWED");
      assert.equal(wrote, false);
    } finally {
      restore();
    }
  });
}

test("parent GET requires and validates one active child, preserves filters and bigint strings", async () => {
  const calls = [];
  const restore = replaceUtils(parentMocks({}, async (requestPath) => {
    calls.push(requestPath);
    if (requestPath.startsWith("family_members?")) return [{ id: CHILD_ID }];
    if (requestPath.startsWith("study_plans?select=")) return [{ id: 42, study_date: "2026-07-29" }];
    return [];
  }));
  try {
    const response = responseCapture();
    await handler({
      method: "GET",
      headers: {},
      url: `/api/study/plans?assignedMemberId=${CHILD_ID}&through=2026-08-04&excludeCompleted=true`,
    }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.plans[0].id, "42");
    const query = calls.find((requestPath) => requestPath.startsWith("study_plans?select="));
    assert.match(query, new RegExp(`family_id=eq\\.${FAMILY_ID}`));
    assert.match(query, new RegExp(`assigned_member_id=eq\\.${CHILD_ID}`));
    assert.match(query, /study_date=lte\.2026-08-04/);
    assert.match(query, /status=not\.in\.\(%EC%99%84%EB%A3%8C,done\)/);
    assert.match(query, /order=study_date\.asc$/);
  } finally {
    restore();
  }
});

for (const method of ["PATCH", "DELETE"]) {
  test(`${method} requires an explicit assigned member before reading a plan`, async () => {
    let queriedPlan = false;
    const body = method === "PATCH" ? { id: "42", subject: "변경" } : { id: "42" };
    const restore = replaceUtils(parentMocks(body, async (requestPath) => {
      if (requestPath.startsWith("study_plans?")) queriedPlan = true;
      return [];
    }));
    try {
      const response = responseCapture();
      await handler({ method, headers: {} }, response);
      assert.equal(response.statusCode, 400);
      assert.equal(response.body.code, "INVALID_ASSIGNED_MEMBER");
      assert.equal(queriedPlan, false);
    } finally {
      restore();
    }
  });
}

for (const method of ["PATCH", "DELETE"]) {
  test(`${method} rejects a plan belonging to another child without a partial mutation`, async () => {
    let wrote = false;
    const body = method === "PATCH"
      ? { id: "42", assignedMemberId: CHILD_ID, subject: "변경" }
      : { id: "42", assignedMemberId: CHILD_ID };
    const restore = replaceUtils(parentMocks(body, async (requestPath, options = {}) => {
      if (requestPath.startsWith("family_members?")) return [{ id: CHILD_ID }];
      if (requestPath.startsWith("study_plans?select=")) {
        assert.match(requestPath, new RegExp(`assigned_member_id=eq\\.${CHILD_ID}`));
        return [];
      }
      if (options.method === method) wrote = true;
      return [];
    }));
    try {
      const response = responseCapture();
      await handler({ method, headers: {} }, response);
      assert.equal(response.statusCode, 404);
      assert.equal(response.body.code, "PLAN_NOT_FOUND");
      assert.equal(wrote, false);
    } finally {
      restore();
    }
  });
}

test("bulk late update rejects one foreign-child or stale id before any mutation", async () => {
  let wrote = false;
  const restore = replaceUtils(parentMocks(
    { ids: ["40", "41"], status: "지연", assignedMemberId: CHILD_ID },
    async (requestPath, options = {}) => {
      if (requestPath.startsWith("family_members?")) return [{ id: CHILD_ID }];
      if (requestPath.startsWith("study_plans?select=")) return [{ id: 40 }];
      if (options.method === "PATCH") wrote = true;
      return [];
    }
  ));
  try {
    const response = responseCapture();
    await handler({ method: "PATCH", headers: {} }, response);
    assert.equal(response.statusCode, 404);
    assert.equal(response.body.code, "PLAN_NOT_FOUND");
    assert.equal(wrote, false);
  } finally {
    restore();
  }
});

test("bulk late update never reports success when the final mutation becomes stale", async () => {
  const restore = replaceUtils(parentMocks(
    { ids: ["40", "41"], status: "지연", assignedMemberId: CHILD_ID },
    async (requestPath, options = {}) => {
      if (requestPath.startsWith("family_members?")) return [{ id: CHILD_ID }];
      if (requestPath.startsWith("study_plans?select=")) return [{ id: 40 }, { id: 41 }];
      if (options.method === "PATCH") return [{ id: 40, status: "지연" }];
      return [];
    }
  ));
  try {
    const response = responseCapture();
    await handler({ method: "PATCH", headers: {} }, response);
    assert.equal(response.statusCode, 409);
    assert.equal(response.body.code, "PLAN_MUTATION_STALE");
  } finally {
    restore();
  }
});

test("mutations reject an inactive selected child before reading or writing plans", async () => {
  let touchedPlan = false;
  const restore = replaceUtils(parentMocks(
    { id: "42", assignedMemberId: CHILD_ID, subject: "변경" },
    async (requestPath) => {
      if (requestPath.startsWith("study_plans?")) touchedPlan = true;
      return [];
    }
  ));
  try {
    const response = responseCapture();
    await handler({ method: "PATCH", headers: {} }, response);
    assert.equal(response.statusCode, 403);
    assert.equal(response.body.code, "ASSIGNED_MEMBER_NOT_ALLOWED");
    assert.equal(touchedPlan, false);
  } finally {
    restore();
  }
});

test("parent GET without an assigned child is rejected before querying plans", async () => {
  let queriedPlans = false;
  const restore = replaceUtils(parentMocks({}, async (requestPath) => {
    if (requestPath.startsWith("study_plans?")) queriedPlans = true;
    return [];
  }));
  try {
    const response = responseCapture();
    await handler({ method: "GET", headers: {}, url: "/api/study/plans" }, response);
    assert.equal(response.statusCode, 400);
    assert.equal(response.body.code, "ASSIGNED_MEMBER_REQUIRED");
    assert.equal(queriedPlans, false);
  } finally {
    restore();
  }
});

for (const label of ["another-family child", "inactive child", "parent member"]) {
  test(`parent GET rejects ${label}`, async () => {
    let queriedPlans = false;
    const restore = replaceUtils(parentMocks({}, async (requestPath) => {
      if (requestPath.startsWith("family_members?")) return [];
      if (requestPath.startsWith("study_plans?")) queriedPlans = true;
      return [];
    }));
    try {
      const response = responseCapture();
      await handler({
        method: "GET",
        headers: {},
        url: `/api/study/plans?assignedMemberId=${OTHER_CHILD_ID}`,
      }, response);
      assert.equal(response.statusCode, 403);
      assert.equal(response.body.code, "ASSIGNED_MEMBER_NOT_ALLOWED");
      assert.equal(queriedPlans, false);
    } finally {
      restore();
    }
  });
}

test("child GET is constrained to the session family and own member id while ignoring familyId manipulation", async () => {
  let query = "";
  const restore = replaceUtils({
    authenticate: () => ({ sub: CHILD_ID, family: FAMILY_ID, role: "child" }),
    memberInFamily: async () => ({ id: CHILD_ID, family_id: FAMILY_ID, role: "child", is_active: true }),
    supabaseFetch: async (requestPath) => { query = requestPath; return []; },
  });
  try {
    const response = responseCapture();
    await handler({ method: "GET", headers: {}, url: "/api/study/plans?familyId=attacker-family" }, response);
    assert.equal(response.statusCode, 200);
    assert.match(query, new RegExp(`family_id=eq\\.${FAMILY_ID}`));
    assert.match(query, new RegExp(`assigned_member_id=eq\\.${CHILD_ID}`));
    assert.doesNotMatch(query, /attacker-family/);
  } finally {
    restore();
  }
});

test("child GET rejects an attempted assigned-member override", async () => {
  let queriedPlans = false;
  const restore = replaceUtils({
    authenticate: () => ({ sub: CHILD_ID, family: FAMILY_ID, role: "child" }),
    memberInFamily: async () => ({ id: CHILD_ID, family_id: FAMILY_ID, role: "child", is_active: true }),
    supabaseFetch: async (requestPath) => {
      if (requestPath.startsWith("study_plans?")) queriedPlans = true;
      return [];
    },
  });
  try {
    const response = responseCapture();
    await handler({
      method: "GET",
      headers: {},
      url: `/api/study/plans?assignedMemberId=${OTHER_CHILD_ID}`,
    }, response);
    assert.equal(response.statusCode, 403);
    assert.equal(response.body.code, "CHILD_ASSIGNEE_OVERRIDE_NOT_ALLOWED");
    assert.equal(queriedPlans, false);
  } finally {
    restore();
  }
});

test("general plan client CRUD and reads use the authenticated API with isolated cache and stale-response guards", () => {
  const root = path.join(__dirname, "..");
  const source = fs.readFileSync(path.join(root, "js", "app.js"), "utf8");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const router = fs.readFileSync(path.join(root, "api", "[...path].js"), "utf8");

  assert.match(source, /requestJson\("\/api\/study\/plans"[\s\S]*assignedMemberId/);
  assert.doesNotMatch(source, /from\("study_plans"\)/);
  assert.match(source, /const planUrl = `\/api\/study\/plans/);
  assert.match(source, /if \(assignedMemberId\) planParams\.set\("assignedMemberId", assignedMemberId\)/);
  assert.match(source, /currentMember\?\.role === "parent" \? selectedPlanAssignee\(\) : ""/);
  assert.match(source, /function requireSelectedPlanAssignee\(\)/);
  assert.match(source, /body: JSON\.stringify\(\{ id: String\(id\), assignedMemberId \}\)/);
  assert.match(source, /body: JSON\.stringify\(\{ ids: planIds\.map\(String\), status: "지연", assignedMemberId \}\)/);
  assert.match(source, /async function handlePlanAssigneeChange\(\)[\s\S]*plans: \[\][\s\S]*reloadFromRemote/);
  assert.match(source, /remoteLoadGeneration \+= 1;\s*stickerWalletSnapshot = null;\s*state = emptyLocalData\(\)/);
  assert.match(source, /const generation = \+\+remoteLoadGeneration/);
  assert.match(source, /generation !== remoteLoadGeneration \|\| requestCacheKey !== localDataKey\(\)/);
  assert.match(source, /async function loadRepositoryForCurrentContext[\s\S]*requestCacheKey === localDataKey\(\) \? loadedState : null/);
  assert.match(source, /realtimeUnsubscribe = repository\.subscribe\(\(\) => \{\s*reloadFromRemote\(\)/);
  assert.match(source, /return `\$\{CACHE_PREFIX\}_\$\{familyId\}_\$\{memberId\}_\$\{assignedMemberId\}`/);
  assert.match(source, /await saveAndRender\(message,\s*\(\) => repository\.upsertPlan\(formPlan\)\)/);
  assert.match(source, /async function saveAndRender[\s\S]*handleRepositoryError\(error\)/);
  assert.match(source, /\/api\/rewards\/study-complete/);
  assert.match(source, /\/api\/study\/reading-plans/);
  assert.match(source, /requestJson\("\/api\/study\/book-plans"/);
  assert.match(source, /requestJson\(`\/api\/study\/book-plans\?assignedMemberId=\$\{encodeURIComponent\(assignedMemberId\)\}`/);
  assert.doesNotMatch(source, /client\.from\("book_plans"\)/);
  for (const functionName of [
    "addBookPlanReview",
    "updateBookPlanPages",
    "deleteBookPlanTask",
    "moveBookPlanForward",
  ]) {
    assert.match(
      source,
      new RegExp(`async function ${functionName}\\([\\s\\S]*?const assignedMemberId = requireSelectedPlanAssignee\\(\\)[\\s\\S]*?assignedMemberId`)
    );
  }
  assert.match(source, /state = \{ \.\.\.state, plans: \[\], bookPlans: \[\] \}/);
  assert.doesNotMatch(source, /client\.rpc\("(?:create_book_plan|add_book_plan_review|update_book_plan_pages|delete_book_plan_task|reflow_book_plan)"/);
  assert.match(html, /<section id="planAssigneeControl"[\s\S]*<select id="planAssignedMember" required/);
  assert.doesNotMatch(html, /<form id="planForm"[\s\S]*<label>담당 자녀/);
  assert.doesNotMatch(source, /selected \|\| planAssignees\[0\]\.id/);
  assert.match(router, /"study\/plans": studyPlans/);
  assert.match(router, /"study\/book-plans": studyBookPlans/);
});
