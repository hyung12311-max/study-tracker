const assert = require("node:assert/strict");
const test = require("node:test");

const utils = require("../server/api/rewards/_utils");
const handler = require("../server/api/study/academy-schedules");
const completionHandler = require("../server/api/rewards/academy-complete");

const FAMILY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PARENT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CHILD_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const OTHER_CHILD_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const SCHEDULE_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const COMPLETION_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff";

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

function parentMocks(body, supabaseFetch) {
  return {
    authenticate: (_request, role) => {
      if (role) assert.equal(role, "parent");
      return { sub: PARENT_ID, family: FAMILY_ID, role: "parent" };
    },
    memberInFamily: async () => ({
      id: PARENT_ID,
      family_id: FAMILY_ID,
      role: "parent",
      is_active: true,
    }),
    readJson: async () => body,
    supabaseFetch,
  };
}

async function activeChildFetch(path) {
  if (path.startsWith("family_members?")) {
    assert.match(path, new RegExp(`family_id=eq\\.${FAMILY_ID}`));
    assert.match(path, new RegExp(`id=eq\\.${CHILD_ID}`));
    assert.match(path, /role=eq\.child/);
    assert.match(path, /is_active=eq\.true/);
    return [{ id: CHILD_ID }];
  }
  return null;
}

test("parent GET returns only the selected active child's schedules and completions", async () => {
  const restore = replaceUtils(parentMocks(null, async (path) => {
    const child = await activeChildFetch(path);
    if (child) return child;
    if (path.startsWith("academy_schedules?")) {
      assert.match(path, new RegExp(`family_id=eq\\.${FAMILY_ID}`));
      assert.match(path, new RegExp(`assigned_member_id=eq\\.${CHILD_ID}`));
      assert.match(path, /order=day_of_week\.asc,start_time\.asc,academy_name\.asc$/);
      return [{
        id: SCHEDULE_ID,
        academy_name: "태권도",
        day_of_week: 2,
        start_time: "17:00:00",
        memo: "",
        star_count: 1,
      }];
    }
    if (path.startsWith("academy_completion_history?")) {
      assert.match(path, new RegExp(`family_id=eq\\.${FAMILY_ID}`));
      assert.match(path, new RegExp(`member_id=eq\\.${CHILD_ID}`));
      return [{
        id: COMPLETION_ID,
        academy_schedule_id: SCHEDULE_ID,
        completed_date: "2026-07-29",
        star_count: 1,
        created_at: "2026-07-29T10:00:00Z",
      }];
    }
    return [];
  }));
  try {
    const response = responseCapture();
    await handler({
      method: "GET",
      url: `/api/study/academy-schedules?assignedMemberId=${CHILD_ID}`,
      headers: {},
    }, response);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body.schedules.map((row) => row.id), [SCHEDULE_ID]);
    assert.deepEqual(response.body.completions.map((row) => row.id), [COMPLETION_ID]);
  } finally {
    restore();
  }
});

test("child GET forces the session child and rejects an assignee override", async () => {
  for (const override of ["", OTHER_CHILD_ID]) {
    let listed = false;
    const restore = replaceUtils({
      authenticate: () => ({ sub: CHILD_ID, family: FAMILY_ID, role: "child" }),
      memberInFamily: async () => ({
        id: CHILD_ID,
        family_id: FAMILY_ID,
        role: "child",
        is_active: true,
      }),
      supabaseFetch: async (path) => {
        listed = true;
        assert.match(path, new RegExp(`(?:assigned_member_id|member_id)=eq\\.${CHILD_ID}`));
        return [];
      },
    });
    try {
      const response = responseCapture();
      await handler({
        method: "GET",
        url: `/api/study/academy-schedules${override ? `?assignedMemberId=${override}` : ""}`,
        headers: {},
      }, response);
      assert.equal(response.statusCode, override ? 403 : 200);
      assert.equal(listed, !override);
    } finally {
      restore();
    }
  }
});

test("missing, other-family, and inactive selected children are blocked before listing", async () => {
  for (const assignedMemberId of ["", OTHER_CHILD_ID]) {
    let listed = false;
    const restore = replaceUtils(parentMocks(null, async (path) => {
      if (path.startsWith("family_members?")) return [];
      listed = true;
      return [];
    }));
    try {
      const response = responseCapture();
      await handler({
        method: "GET",
        url: `/api/study/academy-schedules${assignedMemberId ? `?assignedMemberId=${assignedMemberId}` : ""}`,
        headers: {},
      }, response);
      assert.equal(response.statusCode, assignedMemberId ? 403 : 400);
      assert.equal(listed, false);
    } finally {
      restore();
    }
  }
});

test("create records session ownership through the service-role wrapper", async () => {
  let rpcBody;
  const body = {
    assignedMemberId: CHILD_ID,
    name: "태권도",
    dayOfWeek: 2,
    time: "17:00",
    memo: "도복",
    stars: 1,
  };
  const restore = replaceUtils(parentMocks(body, async (path, options) => {
    const child = await activeChildFetch(path);
    if (child) return child;
    assert.equal(path, "rpc/create_academy_schedule_for_assignee");
    rpcBody = JSON.parse(options.body);
    return [{
      id: SCHEDULE_ID,
      academy_name: "태권도",
      day_of_week: 2,
      start_time: "17:00:00",
      memo: "도복",
      star_count: 1,
    }];
  }));
  try {
    const response = responseCapture();
    await handler({ method: "POST", headers: {} }, response);
    assert.equal(response.statusCode, 201);
    assert.equal(response.body.schedule.id, SCHEDULE_ID);
    assert.equal(rpcBody.p_family_id, FAMILY_ID);
    assert.equal(rpcBody.p_actor_member_id, PARENT_ID);
    assert.equal(rpcBody.p_assigned_member_id, CHILD_ID);
    assert.equal("family_id" in rpcBody, false);
  } finally {
    restore();
  }
});

test("ownership fields in a mutation payload are explicitly rejected", async () => {
  let called = false;
  const restore = replaceUtils(parentMocks({
    assignedMemberId: CHILD_ID,
    family_id: FAMILY_ID,
    name: "태권도",
    dayOfWeek: 2,
    time: "17:00",
    memo: "",
    stars: 1,
  }, async () => {
    called = true;
    return [];
  }));
  try {
    const response = responseCapture();
    await handler({ method: "POST", headers: {} }, response);
    assert.equal(response.statusCode, 400);
    assert.equal(response.body.code, "ACADEMY_FIELD_NOT_ALLOWED");
    assert.equal(called, false);
  } finally {
    restore();
  }
});

test("update and delete pass family, actor, selected child, and schedule to scoped wrappers", async () => {
  for (const method of ["PATCH", "DELETE"]) {
    let rpcBody;
    const body = method === "PATCH" ? {
      id: SCHEDULE_ID,
      assignedMemberId: CHILD_ID,
      name: "태권도",
      dayOfWeek: 3,
      time: "18:00",
      memo: "",
      stars: 1,
    } : {
      id: SCHEDULE_ID,
      assignedMemberId: CHILD_ID,
    };
    const expectedRpc = method === "PATCH"
      ? "rpc/update_academy_schedule_for_assignee"
      : "rpc/delete_academy_schedule_for_assignee";
    const restore = replaceUtils(parentMocks(body, async (path, options) => {
      const child = await activeChildFetch(path);
      if (child) return child;
      assert.equal(path, expectedRpc);
      rpcBody = JSON.parse(options.body);
      return method === "PATCH" ? [{
        id: SCHEDULE_ID,
        academy_name: "태권도",
        day_of_week: 3,
        start_time: "18:00:00",
        memo: "",
        star_count: 1,
      }] : SCHEDULE_ID;
    }));
    try {
      const response = responseCapture();
      await handler({ method, headers: {} }, response);
      assert.equal(response.statusCode, 200);
      assert.equal(rpcBody.p_family_id, FAMILY_ID);
      assert.equal(rpcBody.p_actor_member_id, PARENT_ID);
      assert.equal(rpcBody.p_assigned_member_id, CHILD_ID);
      assert.equal(rpcBody.p_schedule_id, SCHEDULE_ID);
    } finally {
      restore();
    }
  }
});

test("completion-history deletion conflict and cross-scope not-found are sanitized", async () => {
  for (const [supabaseCode, status, code] of [
    ["P0002", 404, "ACADEMY_SCHEDULE_NOT_FOUND"],
    ["P0003", 409, "ACADEMY_COMPLETION_HISTORY_EXISTS"],
    ["40001", 409, "ACADEMY_MUTATION_STALE"],
  ]) {
    const restore = replaceUtils(parentMocks({
      id: SCHEDULE_ID,
      assignedMemberId: CHILD_ID,
    }, async (path) => {
      const child = await activeChildFetch(path);
      if (child) return child;
      const error = new Error("private database detail");
      error.supabaseCode = supabaseCode;
      throw error;
    }));
    try {
      const response = responseCapture();
      await handler({ method: "DELETE", headers: {} }, response);
      assert.equal(response.statusCode, status);
      assert.equal(response.body.code, code);
      assert.doesNotMatch(JSON.stringify(response.body), /private database detail/);
    } finally {
      restore();
    }
  }
});

test("academy completion GET validates the active child before listing scoped history", async () => {
  const calls = [];
  const restore = replaceUtils({
    authenticate: () => ({ sub: CHILD_ID, family: FAMILY_ID, role: "child" }),
    memberInFamily: async (memberId, familyId) => {
      calls.push(`member:${memberId}:${familyId}`);
      return {
        id: CHILD_ID,
        family_id: FAMILY_ID,
        role: "child",
        is_active: true,
      };
    },
    supabaseFetch: async (path) => {
      calls.push(path);
      assert.match(path, new RegExp(`family_id=eq\\.${FAMILY_ID}`));
      assert.match(path, new RegExp(`member_id=eq\\.${CHILD_ID}`));
      assert.match(path, /order=completed_date\.desc,created_at\.desc$/);
      return [{
        id: COMPLETION_ID,
        academy_schedule_id: SCHEDULE_ID,
        completed_date: "2026-07-29",
        star_count: 1,
        created_at: "2026-07-29T10:00:00Z",
      }];
    },
  });
  try {
    const response = responseCapture();
    await completionHandler({
      method: "GET",
      url: `/api/rewards/academy-complete?familyId=attacker&memberId=${OTHER_CHILD_ID}`,
      headers: {},
    }, response);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body.completions.map((row) => row.id), [COMPLETION_ID]);
    assert.match(calls[0], /^member:/);
    assert.match(calls[1], /^academy_completion_history\?/);
  } finally {
    restore();
  }
});

test("academy completion GET blocks missing, inactive, wrong-family, and non-child members before listing", async () => {
  const deniedCases = [
    { claimsRole: "child", member: null },
    { claimsRole: "child", member: { id: CHILD_ID, family_id: FAMILY_ID, role: "child", is_active: false } },
    { claimsRole: "child", member: { id: CHILD_ID, family_id: "99999999-9999-4999-8999-999999999999", role: "child", is_active: true } },
    { claimsRole: "parent", member: { id: PARENT_ID, family_id: FAMILY_ID, role: "parent", is_active: true } },
    { claimsRole: "parent", member: { id: CHILD_ID, family_id: FAMILY_ID, role: "child", is_active: true } },
    { claimsRole: "guardian", member: { id: CHILD_ID, family_id: FAMILY_ID, role: "guardian", is_active: true } },
  ];
  for (const { claimsRole, member } of deniedCases) {
    let listed = false;
    const restore = replaceUtils({
      authenticate: () => ({ sub: CHILD_ID, family: FAMILY_ID, role: claimsRole }),
      memberInFamily: async () => member,
      supabaseFetch: async () => {
        listed = true;
        return [];
      },
    });
    try {
      const response = responseCapture();
      await completionHandler({ method: "GET", headers: {} }, response);
      assert.equal(response.statusCode, 403);
      assert.equal(response.body.code, "CHILD_PERMISSION_REQUIRED");
      assert.equal(listed, false);
    } finally {
      restore();
    }
  }
});

test("academy completion POST blocks an inactive child before reading input or calling the wrapper", async () => {
  let read = false;
  let called = false;
  const restore = replaceUtils({
    authenticate: () => ({ sub: CHILD_ID, family: FAMILY_ID, role: "child" }),
    memberInFamily: async () => ({
      id: CHILD_ID,
      family_id: FAMILY_ID,
      role: "child",
      is_active: false,
    }),
    readJson: async () => {
      read = true;
      return { scheduleId: SCHEDULE_ID };
    },
    supabaseFetch: async () => {
      called = true;
      return [];
    },
  });
  try {
    const response = responseCapture();
    await completionHandler({ method: "POST", headers: {} }, response);
    assert.equal(response.statusCode, 403);
    assert.equal(response.body.code, "CHILD_PERMISSION_REQUIRED");
    assert.equal(read, false);
    assert.equal(called, false);
  } finally {
    restore();
  }
});

test("academy schedule GET returns a safe message for an unsupported active role", async () => {
  let listed = false;
  const restore = replaceUtils({
    authenticate: () => ({ sub: CHILD_ID, family: FAMILY_ID, role: "guardian" }),
    memberInFamily: async () => ({
      id: CHILD_ID,
      family_id: FAMILY_ID,
      role: "guardian",
      is_active: true,
    }),
    supabaseFetch: async () => {
      listed = true;
      return [];
    },
  });
  try {
    const response = responseCapture();
    await handler({ method: "GET", url: "/api/study/academy-schedules", headers: {} }, response);
    assert.equal(response.statusCode, 403);
    assert.equal(response.body.code, "ACTIVE_MEMBER_REQUIRED");
    assert.equal(response.body.error, "활성 가족 구성원 인증이 필요합니다.");
    assert.equal(listed, false);
  } finally {
    restore();
  }
});

test("child completion uses the assignee-scoped wrapper and preserves duplicate-safe result", async () => {
  let rpcBody;
  const restore = replaceUtils({
    authenticate: () => ({ sub: CHILD_ID, family: FAMILY_ID, role: "child" }),
    memberInFamily: async () => ({
      id: CHILD_ID,
      family_id: FAMILY_ID,
      display_name: "자녀",
      role: "child",
      is_active: true,
    }),
    readJson: async () => ({ scheduleId: SCHEDULE_ID }),
    sendTargetedPush: async () => ({ success: 1, failure: 0 }),
    supabaseFetch: async (path, options) => {
      if (path === "rpc/complete_academy_schedule_for_assignee") {
        rpcBody = JSON.parse(options.body);
        return [{
          id: COMPLETION_ID,
          academy_schedule_id: SCHEDULE_ID,
          completed_date: "2026-07-29",
          star_count: 1,
          created_at: "2026-07-29T10:00:00Z",
        }];
      }
      if (path.startsWith("sticker_transactions?")) return [{ amount: 1 }];
      return [];
    },
  });
  try {
    const response = responseCapture();
    await completionHandler({ method: "POST", headers: {} }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.balance, 1);
    assert.equal(rpcBody.p_family_id, FAMILY_ID);
    assert.equal(rpcBody.p_actor_member_id, CHILD_ID);
    assert.equal(rpcBody.p_assigned_member_id, CHILD_ID);
    assert.equal(rpcBody.p_schedule_id, SCHEDULE_ID);
  } finally {
    restore();
  }
});
