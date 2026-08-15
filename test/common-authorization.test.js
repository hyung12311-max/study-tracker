const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");

const authorization = require("../server/api/_authorization");
const family = require("../server/api/family/_utils");

const FAMILY_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const FAMILY_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PARENT_A = "aaaaaaaa-0000-4000-8000-000000000001";
const CHILD_A = "aaaaaaaa-0000-4000-8000-000000000002";
const CHILD_B = "bbbbbbbb-0000-4000-8000-000000000002";

function member(overrides = {}) {
  return {
    id: PARENT_A,
    family_id: FAMILY_A,
    member_key: "parent-a",
    display_name: "Parent A",
    role: "parent",
    avatar_emoji: "P",
    is_active: true,
    ...overrides,
  };
}

function claims(overrides = {}) {
  return {
    sub: PARENT_A,
    family: FAMILY_A,
    key: "parent-a",
    role: "parent",
    exp: Math.floor(Date.now() / 1000) + 60,
    ...overrides,
  };
}

function foundation({ token = claims(), rows = [member()], fetch } = {}) {
  return authorization.createAuthorizationFoundation({
    authenticate: () => token,
    supabaseFetch: fetch || (async () => rows),
  });
}

function signedToken(payload, secret) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

async function sessionInvalid(auth) {
  await assert.rejects(
    auth.authenticateActiveMember({ headers: {} }),
    (error) => error.statusCode === 401
      && error.code === "AUTH_SESSION_INVALID"
      && !Object.keys(error).includes("authorizationReason")
  );
}

test("valid parent returns an authoritative current-member context", async () => {
  const context = await foundation().authenticateActiveMember({}, { requiredRole: "parent" });
  assert.equal(context.familyId, FAMILY_A);
  assert.equal(context.memberId, PARENT_A);
  assert.equal(context.memberKey, "parent-a");
  assert.equal(context.role, "parent");
  assert.equal(context.role, context.member.role);
  assert.equal(context.claims.role, context.member.role);
});

test("default integration requires a valid unexpired signed family token", async () => {
  const previousSecret = process.env.FAMILY_AUTH_SECRET;
  const originalFetch = family.supabaseFetch;
  const secret = "phase-1-common-auth-test-secret-32-characters";
  process.env.FAMILY_AUTH_SECRET = secret;
  family.supabaseFetch = async () => [member()];
  const valid = family.signToken(member());
  let databaseRead = false;
  try {
    family.supabaseFetch = async () => { databaseRead = true; return [member()]; };
    const context = await authorization.authenticateActiveMember({
      headers: { authorization: `Bearer ${valid}` },
    });
    assert.equal(context.memberId, PARENT_A);
    assert.equal(databaseRead, true);

    databaseRead = false;
    await assert.rejects(
      authorization.authenticateActiveMember({
        headers: { authorization: `Bearer ${valid.slice(0, -1)}x` },
      }),
      (error) => error.statusCode === 401 && error.code === "AUTH_INVALID"
    );
    assert.equal(databaseRead, false);

    const expired = signedToken({
      sub: PARENT_A,
      family: FAMILY_A,
      key: "parent-a",
      role: "parent",
      exp: Math.floor(Date.now() / 1000) - 1,
    }, secret);
    await assert.rejects(
      authorization.authenticateActiveMember({
        headers: { authorization: `Bearer ${expired}` },
      }),
      (error) => error.statusCode === 401 && error.code === "AUTH_EXPIRED"
    );
    assert.equal(databaseRead, false);
  } finally {
    family.supabaseFetch = originalFetch;
    if (previousSecret === undefined) delete process.env.FAMILY_AUTH_SECRET;
    else process.env.FAMILY_AUTH_SECRET = previousSecret;
  }
});

test("valid child and allowRoles pass with the Learning/Study-compatible shape", async () => {
  const child = member({ id: CHILD_A, member_key: "child-a", role: "child" });
  const token = claims({ sub: CHILD_A, key: "child-a", role: "child" });
  const context = await foundation({ token, rows: [child] })
    .authenticateActiveMember({}, { allowRoles: ["parent", "child"] });
  assert.deepEqual(context.claims, token);
  assert.equal(context.member, child);
  assert.equal(context.role, "child");
});

test("inactive and deleted members share session-invalid semantics", async () => {
  await sessionInvalid(foundation({ rows: [member({ is_active: false })] }));
  await sessionInvalid(foundation({ rows: [] }));
});

test("parent-to-child and child-to-parent role drift are rejected", async () => {
  await sessionInvalid(foundation({ rows: [member({ role: "child" })] }));
  await sessionInvalid(foundation({
    token: claims({ sub: CHILD_A, key: "child-a", role: "child" }),
    rows: [member({ id: CHILD_A, member_key: "child-a", role: "parent" })],
  }));
});

test("family and member-key drift are rejected", async () => {
  await sessionInvalid(foundation({ rows: [member({ family_id: FAMILY_B })] }));
  await sessionInvalid(foundation({ rows: [member({ member_key: "renamed-parent" })] }));
});

test("requiredRole uses the current DB role and returns 403 only after identity validation", async () => {
  const child = member({ id: CHILD_A, member_key: "child-a", role: "child" });
  const token = claims({ sub: CHILD_A, key: "child-a", role: "child" });
  await assert.rejects(
    foundation({ token, rows: [child] }).authenticateActiveMember({}, { requiredRole: "parent" }),
    (error) => error.statusCode === 403 && error.code === "AUTH_ROLE_REQUIRED"
  );
});

test("active same-family children resolve by UUID and member key", async () => {
  const child = member({ id: CHILD_A, member_key: "child-a", role: "child" });
  const queries = [];
  const auth = foundation({ fetch: async (path) => { queries.push(path); return [child]; } });
  const context = await foundation().authenticateActiveMember({});
  assert.equal((await auth.resolveActiveFamilyChild(context, CHILD_A)).id, CHILD_A);
  assert.equal((await auth.resolveActiveFamilyChild(context, "child-a")).id, CHILD_A);
  assert.ok(queries.every((query) => query.includes(`family_id=eq.${FAMILY_A}`)));
  assert.ok(queries.every((query) => query.includes("role=eq.child&is_active=eq.true")));
});

test("cross-family, inactive, role-mismatch, and invalid child identifiers share safe 404", async () => {
  const context = await foundation().authenticateActiveMember({});
  for (const rows of [
    [],
    [member({ id: CHILD_B, family_id: FAMILY_B, role: "child" })],
    [member({ id: CHILD_A, role: "child", is_active: false })],
    [member({ id: CHILD_A, role: "parent" })],
  ]) {
    await assert.rejects(
      foundation({ rows }).resolveActiveFamilyChild(context, CHILD_A),
      (error) => error.statusCode === 404 && error.code === "FAMILY_CHILD_NOT_FOUND"
    );
  }
  await assert.rejects(
    foundation().resolveActiveFamilyChild(context, "../invalid"),
    (error) => error.statusCode === 404 && error.code === "FAMILY_CHILD_NOT_FOUND"
  );
});

test("child self scope cannot be overridden and comes from the authorization context", async () => {
  const childContext = {
    familyId: FAMILY_A,
    memberId: CHILD_A,
    memberKey: "child-a",
    role: "child",
  };
  assert.equal(authorization.childSelfScope(childContext), CHILD_A);
  assert.throws(
    () => authorization.childSelfScope(childContext, CHILD_B),
    (error) => error.statusCode === 403 && error.code === "AUTH_ROLE_REQUIRED"
  );
});

test("object path foundation always combines object ID with context family ID", () => {
  const context = { familyId: FAMILY_A, memberId: PARENT_A, role: "parent" };
  const path = authorization.buildFamilyScopedObjectPath(context, {
    table: "learning_assignments",
    select: "id,status",
    objectId: CHILD_A,
  });
  assert.match(path, new RegExp(`id=eq\\.${CHILD_A}`));
  assert.match(path, new RegExp(`family_id=eq\\.${FAMILY_A}`));
  assert.throws(() => authorization.buildFamilyScopedObjectPath(context, {
    table: "learning_assignments?select=*",
    objectId: CHILD_A,
  }), TypeError);
});

test("public sanitizer never exposes internal database or credential details", () => {
  const internal = new Error("relation family_members failed for token secret-token");
  internal.supabaseMessage = "column family_id violates private_constraint";
  internal.supabaseDetails = `family ${FAMILY_A}`;
  internal.supabaseHint = "use service-role-key";
  internal.pin = "2468";
  internal.pinHash = "private-pin-hash";
  internal.stack = "private stack";
  const result = authorization.publicAuthorizationError(internal);
  const serialized = JSON.stringify(result);
  assert.deepEqual(result, {
    status: 500,
    body: { ok: false, error: "The request could not be processed.", code: "REQUEST_FAILED" },
  });
  for (const secret of [
    "family_members",
    "family_id",
    "private_constraint",
    FAMILY_A,
    "service-role-key",
    "secret-token",
    "2468",
    "private-pin-hash",
    "private stack",
  ]) assert.equal(serialized.includes(secret), false);
});

test("known authorization errors also sanitize internal drift reasons", async () => {
  let caught;
  try {
    await foundation({ rows: [] }).authenticateActiveMember({});
  } catch (error) {
    caught = error;
  }
  assert.equal(caught.authorizationReason, "member-deleted");
  const result = authorization.publicAuthorizationError(caught);
  assert.deepEqual(result, {
    status: 401,
    body: {
      ok: false,
      error: "Authentication is no longer valid.",
      code: "AUTH_SESSION_INVALID",
    },
  });
  assert.equal(JSON.stringify(result).includes("member-deleted"), false);
});
