const assert = require("node:assert/strict");
const test = require("node:test");

const utils = require("../server/api/rewards/_utils");
const handler = require("../server/api/learning/profile");

const FAMILY = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PARENT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CHILD = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function responseCapture() {
  return { statusCode: 0, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(v) { this.body = JSON.parse(v); } };
}

function replace(overrides) {
  const originals = {};
  for (const [key, value] of Object.entries(overrides)) {
    originals[key] = utils[key];
    utils[key] = value;
  }
  return () => Object.assign(utils, originals);
}

function request(method, body, headers = {}) {
  return {
    method,
    url: method === "GET" ? `/api/learning/profile?assignedMemberId=${CHILD}` : "/api/learning/profile",
    headers: { host: "study.example", origin: "https://study.example", "x-forwarded-proto": "https", "content-type": "application/json", "x-study-csrf": "1", ...headers },
    testBody: body,
  };
}

function base({ role = "parent", active = true, childRows, body, fetch }) {
  const actor = role === "parent" ? PARENT : CHILD;
  return {
    authenticate: (_request, required) => {
      if (required && required !== role) throw utils.err("Parent required", 403, "ACTIVE_PARENT_REQUIRED");
      return { sub: actor, family: FAMILY, role };
    },
    memberInFamily: async () => ({ id: actor, family_id: FAMILY, role, is_active: active }),
    readJson: async () => body,
    supabaseFetch: async (path, options) => {
      if (path.startsWith("family_members?")) return childRows === undefined
        ? [{ id: CHILD, family_id: FAMILY, role: "child", is_active: true }]
        : childRows;
      return fetch(path, options);
    },
  };
}

test("parent reads a same-family child profile without exposing internal codes", async () => {
  const restore = replace(base({ fetch: async (path) => {
    assert.match(path, new RegExp(`family_id=eq\\.${FAMILY}`));
    assert.match(path, new RegExp(`member_id=eq\\.${CHILD}`));
    return [{ subject: "math", level_code: "elementary_1" }];
  } }));
  try {
    const response = responseCapture();
    await handler(request("GET"), response);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body.profile, { subject: "수학", level: "초등 1" });
    assert.doesNotMatch(JSON.stringify(response.body), /math|elementary_1/);
    assert.equal(response.headers["Cache-Control"], "no-store");
  } finally { restore(); }
});

test("missing profile returns null and keeps the catalog-compatible contract", async () => {
  const restore = replace(base({ fetch: async () => [] }));
  try {
    const response = responseCapture();
    await handler(request("GET"), response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.profile, null);
  } finally { restore(); }
});

test("parent update uses session family and actor through the approved wrapper", async () => {
  const body = { assignedMemberId: CHILD, subject: "수학", level: "초등 6" };
  const restore = replace(base({ body, fetch: async (path, options) => {
    assert.equal(path, "rpc/upsert_learning_member_subject_profile");
    assert.deepEqual(JSON.parse(options.body), {
      p_family_id: FAMILY,
      p_actor_member_id: PARENT,
      p_member_id: CHILD,
      p_subject: "math",
      p_level_code: "elementary_6",
    });
    return { subject: "math", level_code: "elementary_6" };
  } }));
  try {
    const response = responseCapture();
    await handler(request("PUT", body), response);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body.profile, { subject: "수학", level: "초등 6" });
  } finally { restore(); }
});

test("child, inactive parent, and non-family child are blocked before profile data access", async () => {
  for (const options of [{ role: "child" }, { active: false }, { childRows: [] }]) {
    let profileAccess = false;
    const restore = replace(base({ ...options, fetch: async () => { profileAccess = true; return []; } }));
    try {
      const response = responseCapture();
      await handler(request("GET"), response);
      assert.ok([401, 403, 404].includes(response.statusCode));
      assert.equal(profileAccess, false);
    } finally { restore(); }
  }
});

test("profile mutation rejects CSRF and extra family or actor fields before wrapper", async () => {
  for (const [body, headers] of [
    [{ assignedMemberId: CHILD, subject: "수학", level: "초등 1" }, { "x-study-csrf": "" }],
    [{ assignedMemberId: CHILD, subject: "수학", level: "초등 1", familyId: FAMILY }, {}],
    [{ assignedMemberId: CHILD, subject: "수학", level: "elementary_1" }, {}],
  ]) {
    let wrapperCalled = false;
    const restore = replace(base({ body, fetch: async () => { wrapperCalled = true; return []; } }));
    try {
      const response = responseCapture();
      await handler(request("PUT", body, headers), response);
      assert.ok([400, 403].includes(response.statusCode));
      assert.equal(wrapperCalled, false);
    } finally { restore(); }
  }
});
