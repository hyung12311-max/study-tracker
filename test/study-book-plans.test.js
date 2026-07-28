const assert = require("node:assert/strict");
const test = require("node:test");

const utils = require("../server/api/rewards/_utils");
const handler = require("../server/api/study/book-plans");

const FAMILY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PARENT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CHILD_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const OTHER_CHILD_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const BOOK_PLAN_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

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

function baseMocks(body, supabaseFetch) {
  return {
    authenticate: (_request, role) => {
      assert.equal(role, "parent");
      return { sub: PARENT_ID, family: FAMILY_ID, role: "parent" };
    },
    memberInFamily: async () => ({ id: PARENT_ID, family_id: FAMILY_ID, role: "parent", is_active: true }),
    readJson: async () => body,
    supabaseFetch,
  };
}

function scopedFetch(delegate = async () => []) {
  return async (path, options) => {
    if (path.startsWith("family_members?")) {
      assert.match(path, new RegExp(`id=eq\\.${CHILD_ID}`));
      assert.match(path, new RegExp(`family_id=eq\\.${FAMILY_ID}`));
      assert.match(path, /role=eq\.child/);
      assert.match(path, /is_active=eq\.true/);
      return [{ id: CHILD_ID }];
    }
    if (path.startsWith("book_plans?select=id&")) {
      assert.match(path, new RegExp(`id=eq\\.${BOOK_PLAN_ID}`));
      assert.match(path, new RegExp(`family_id=eq\\.${FAMILY_ID}`));
      assert.match(path, new RegExp(`assigned_member_id=eq\\.${CHILD_ID}`));
      return [{ id: BOOK_PLAN_ID }];
    }
    if (path.startsWith("study_plans?select=id,book_plan_id&")) {
      assert.match(path, /id=eq\.42/);
      assert.match(path, new RegExp(`family_id=eq\\.${FAMILY_ID}`));
      assert.match(path, new RegExp(`assigned_member_id=eq\\.${CHILD_ID}`));
      return [{ id: "42", book_plan_id: BOOK_PLAN_ID }];
    }
    return delegate(path, options);
  };
}

test("GET returns only the explicitly selected active child's book plans", async () => {
  const restore = replaceUtils(baseMocks(null, scopedFetch(async (path) => {
    assert.match(path, /^book_plans\?select=/);
    assert.match(path, new RegExp(`family_id=eq\\.${FAMILY_ID}`));
    assert.match(path, new RegExp(`assigned_member_id=eq\\.${CHILD_ID}`));
    assert.match(path, /order=updated_at\.desc$/);
    return [{ id: BOOK_PLAN_ID, assigned_member_id: CHILD_ID, workbook: "교재" }];
  })));
  try {
    const response = responseCapture();
    await handler({
      method: "GET",
      url: `/api/study/book-plans?assignedMemberId=${CHILD_ID}`,
      headers: {},
    }, response);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body.bookPlans.map((row) => row.id), [BOOK_PLAN_ID]);
    assert.deepEqual(response.body.bookPlans.map((row) => row.assigned_member_id), [CHILD_ID]);
  } finally {
    restore();
  }
});

test("GET rejects a missing, other-family, or inactive selected child before listing", async () => {
  for (const assignedMemberId of ["", OTHER_CHILD_ID]) {
    let listed = false;
    const restore = replaceUtils(baseMocks(null, async (path) => {
      if (path.startsWith("family_members?")) return [];
      if (path.startsWith("book_plans?")) listed = true;
      return [];
    }));
    try {
      const response = responseCapture();
      await handler({
        method: "GET",
        url: `/api/study/book-plans${assignedMemberId ? `?assignedMemberId=${assignedMemberId}` : ""}`,
        headers: {},
      }, response);
      assert.equal(response.statusCode, assignedMemberId ? 403 : 400);
      assert.equal(listed, false);
    } finally {
      restore();
    }
  }
});

test("book creation uses the family-validating service RPC and session ownership", async () => {
  let rpcBody;
  const body = {
    action: "create",
    assignedMemberId: CHILD_ID,
    subject: "수학",
    book: "교재",
    unit: "1단원",
    lessonNo: "1차시",
    content: "",
    startDate: "2026-07-29",
    startPage: 1,
    endPage: 10,
    pagesPerDay: 2,
    weekdays: [1, 3, 5],
    target: "",
    memo: "",
  };
  const restore = replaceUtils(baseMocks(body, scopedFetch(async (path, options) => {
    assert.equal(path, "rpc/create_book_plan_for_member");
    rpcBody = JSON.parse(options.body);
    return [{
      generated_count: 5,
      first_study_date: "2026-07-29",
      last_study_date: "2026-08-07",
      generated_rows: [{ id: 43 }],
    }];
  })));
  try {
    const response = responseCapture();
    await handler({ method: "POST", headers: {} }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.generatedCount, 5);
    assert.equal(rpcBody.p_family_id, FAMILY_ID);
    assert.equal(rpcBody.p_assigned_member_id, CHILD_ID);
    assert.equal(rpcBody.p_created_by_member_id, PARENT_ID);
  } finally {
    restore();
  }
});

test("book mutations preflight family and assignee then call v2 wrappers", async () => {
  const cases = [
    [{ action: "addReview", assignedMemberId: CHILD_ID, bookPlanId: BOOK_PLAN_ID, afterSequence: 2, content: "복습" }, "rpc/add_book_plan_review_for_assignee"],
    [{ action: "updatePages", assignedMemberId: CHILD_ID, bookPlanId: BOOK_PLAN_ID, pagesPerDay: 3 }, "rpc/update_book_plan_pages_for_assignee"],
    [{ action: "deleteTask", assignedMemberId: CHILD_ID, studyPlanId: "42" }, "rpc/delete_book_plan_task_for_assignee"],
    [{ action: "reflow", assignedMemberId: CHILD_ID, bookPlanId: BOOK_PLAN_ID, fromDate: "2026-07-29" }, "rpc/reflow_book_plan_for_assignee"],
  ];
  for (const [body, expectedPath] of cases) {
    let rpcBody;
    const restore = replaceUtils(baseMocks(body, scopedFetch(async (path, options) => {
      assert.equal(path, expectedPath);
      rpcBody = JSON.parse(options.body);
      return [];
    })));
    try {
      const response = responseCapture();
      await handler({ method: "POST", headers: {} }, response);
      assert.equal(response.statusCode, 200);
      assert.equal(rpcBody.p_family_id, FAMILY_ID);
      assert.equal(rpcBody.p_actor_member_id, PARENT_ID);
      assert.equal(rpcBody.p_assigned_member_id, CHILD_ID);
    } finally {
      restore();
    }
  }
});

test("other-child and other-family book targets are hidden before v2 mutation", async () => {
  for (const body of [
    { action: "addReview", assignedMemberId: CHILD_ID, bookPlanId: BOOK_PLAN_ID, afterSequence: 1, content: "복습" },
    { action: "deleteTask", assignedMemberId: CHILD_ID, studyPlanId: "42" },
  ]) {
    let rpcCalled = false;
    const restore = replaceUtils(baseMocks(body, async (path) => {
      if (path.startsWith("family_members?")) return [{ id: CHILD_ID }];
      if (path.startsWith("rpc/")) rpcCalled = true;
      return [];
    }));
    try {
      const response = responseCapture();
      await handler({ method: "POST", headers: {} }, response);
      assert.equal(response.statusCode, 404);
      assert.equal(rpcCalled, false);
    } finally {
      restore();
    }
  }
});

test("missing or inactive assignee blocks every book mutation before ownership lookup", async () => {
  for (const assignedMemberId of ["", CHILD_ID]) {
    let targetRead = false;
    const body = {
      action: "reflow",
      assignedMemberId,
      bookPlanId: BOOK_PLAN_ID,
      fromDate: "2026-07-29",
    };
    const restore = replaceUtils(baseMocks(body, async (path) => {
      if (path.startsWith("family_members?")) return [];
      targetRead = true;
      return [];
    }));
    try {
      const response = responseCapture();
      await handler({ method: "POST", headers: {} }, response);
      assert.equal(response.statusCode, assignedMemberId ? 403 : 400);
      assert.equal(targetRead, false);
    } finally {
      restore();
    }
  }
});

test("child and inactive-parent requests are rejected before an RPC call", async () => {
  for (const member of [
    { id: CHILD_ID, role: "child", is_active: true },
    { id: PARENT_ID, role: "parent", is_active: false },
  ]) {
    let called = false;
    const restore = replaceUtils({
      authenticate: () => ({ sub: member.id, family: FAMILY_ID, role: member.role }),
      memberInFamily: async () => member,
      supabaseFetch: async () => { called = true; return []; },
    });
    try {
      const response = responseCapture();
      await handler({ method: "POST", headers: {} }, response);
      assert.equal(response.statusCode, 403);
      assert.equal(called, false);
    } finally {
      restore();
    }
  }
});

test("unknown fields and invalid cross-scope identifiers are rejected", async () => {
  let called = false;
  const body = {
    action: "reflow",
    assignedMemberId: CHILD_ID,
    bookPlanId: "not-a-uuid",
    fromDate: "2026-07-29",
    familyId: "attacker",
  };
  const restore = replaceUtils(baseMocks(body, async () => { called = true; return []; }));
  try {
    const response = responseCapture();
    await handler({ method: "POST", headers: {} }, response);
    assert.equal(response.statusCode, 400);
    assert.equal(response.body.code, "BOOK_PLAN_FIELD_NOT_ALLOWED");
    assert.equal(called, false);
  } finally {
    restore();
  }
});

test("database assignee mismatch is returned as a sanitized not-found", async () => {
  const body = {
    action: "reflow",
    assignedMemberId: CHILD_ID,
    bookPlanId: BOOK_PLAN_ID,
    fromDate: "2026-07-29",
  };
  const restore = replaceUtils(baseMocks(body, scopedFetch(async () => {
    const error = new Error("internal ownership detail");
    error.supabaseCode = "P0002";
    throw error;
  })));
  try {
    const response = responseCapture();
    await handler({ method: "POST", headers: {} }, response);
    assert.equal(response.statusCode, 404);
    assert.equal(response.body.error, "교재 계획을 찾을 수 없습니다.");
    assert.doesNotMatch(JSON.stringify(response.body), /internal ownership detail/);
  } finally {
    restore();
  }
});
