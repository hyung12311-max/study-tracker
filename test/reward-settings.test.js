const assert = require("node:assert/strict");
const test = require("node:test");

const utils = require("../server/api/rewards/_utils");
const handler = require("../server/api/rewards/settings");

const FAMILY_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

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

test("GET reward settings reads only the authenticated family row", async () => {
  const calls = [];
  const restore = replaceUtils({
    activeAuthenticatedMember: async () => ({ claims: { family: FAMILY_A, role: "child" } }),
    supabaseFetch: async (path) => {
      calls.push(path);
      if (path.startsWith("family_reward_settings?")) return [{ target_stickers: 12, reward_name: "A reward" }];
      return [];
    },
  });
  try {
    const response = responseCapture();
    await handler({ method: "GET", headers: {} }, response);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body.setting, { target_stickers: 12, reward_name: "A reward" });
    assert.match(calls[0], new RegExp(`family_id=eq\\.${FAMILY_A}`));
  } finally { restore(); }
});

test("GET missing family settings returns server defaults without legacy fallback", async () => {
  const calls = [];
  const restore = replaceUtils({
    activeAuthenticatedMember: async () => ({ claims: { family: FAMILY_A, role: "child" } }),
    supabaseFetch: async (path) => { calls.push(path); return []; },
  });
  try {
    const response = responseCapture();
    await handler({ method: "GET", headers: {} }, response);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body.setting, { target_stickers: 10, reward_name: "5,000원 용돈" });
    assert.equal(calls.length, 1);
    assert.match(calls[0], /^family_reward_settings\?/);
  } finally { restore(); }
});

test("PUT reward settings derives family_id from the active parent session", async () => {
  let authRole;
  let write;
  const restore = replaceUtils({
    activeAuthenticatedMember: async (_request, role) => { authRole = role; return { claims: { family: FAMILY_A, role: "parent" } }; },
    readJson: async () => ({ goal: 25, name: "A only" }),
    supabaseFetch: async (path, options) => {
      write = { path, body: JSON.parse(options.body) };
      return [JSON.parse(options.body)];
    },
  });
  try {
    const response = responseCapture();
    await handler({ method: "PUT", headers: {} }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(authRole, "parent");
    assert.equal(write.path, "family_reward_settings?on_conflict=family_id");
    assert.equal(write.body.family_id, FAMILY_A);
  } finally { restore(); }
});

test("PUT rejects client-supplied family identifiers", async () => {
  let wrote = false;
  const restore = replaceUtils({
    activeAuthenticatedMember: async () => ({ claims: { family: FAMILY_A, role: "parent" } }),
    readJson: async () => ({ goal: 25, name: "attempt", family_id: "attacker-family" }),
    supabaseFetch: async () => { wrote = true; return []; },
  });
  try {
    const response = responseCapture();
    await handler({ method: "PUT", headers: {} }, response);
    assert.equal(response.statusCode, 400);
    assert.equal(response.body.code, "REWARD_SETTING_FIELD_INVALID");
    assert.equal(wrote, false);
  } finally { restore(); }
});
