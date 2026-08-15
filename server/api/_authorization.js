const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MEMBER_KEY_PATTERN = /^[a-z0-9_-]{2,40}$/;
const IDENTIFIER_PATTERN = /^[a-z_][a-z0-9_]*$/;
const ROLES = new Set(["parent", "child"]);

const PUBLIC_ERRORS = Object.freeze({
  AUTH_SESSION_INVALID: Object.freeze({
    status: 401,
    error: "Authentication is no longer valid.",
  }),
  AUTH_ROLE_REQUIRED: Object.freeze({
    status: 403,
    error: "Permission is required for this request.",
  }),
  FAMILY_CHILD_NOT_FOUND: Object.freeze({
    status: 404,
    error: "The requested family member was not found.",
  }),
  FAMILY_OBJECT_NOT_FOUND: Object.freeze({
    status: 404,
    error: "The requested resource was not found.",
  }),
});

function authorizationError(code, reason) {
  const contract = PUBLIC_ERRORS[code];
  if (!contract) throw new TypeError("Unknown authorization error code.");
  const error = new Error(contract.error);
  error.statusCode = contract.status;
  error.code = code;
  Object.defineProperty(error, "authorizationReason", {
    configurable: false,
    enumerable: false,
    value: reason || code,
    writable: false,
  });
  return error;
}

function sessionInvalid(reason) {
  return authorizationError("AUTH_SESSION_INVALID", reason);
}

function safeNotFound(code = "FAMILY_OBJECT_NOT_FOUND") {
  if (!new Set(["FAMILY_CHILD_NOT_FOUND", "FAMILY_OBJECT_NOT_FOUND"]).has(code)) {
    throw new TypeError("Unsupported safe not-found code.");
  }
  return authorizationError(code, "scoped-resource-unavailable");
}

function roleOptions(options = {}) {
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError("Authorization options must be an object.");
  }
  const requiredRole = options.requiredRole;
  if (requiredRole !== undefined && !ROLES.has(requiredRole)) {
    throw new TypeError("requiredRole must be parent or child.");
  }
  let allowRoles = null;
  if (options.allowRoles !== undefined) {
    if (!Array.isArray(options.allowRoles) || !options.allowRoles.length) {
      throw new TypeError("allowRoles must be a non-empty role array.");
    }
    allowRoles = new Set(options.allowRoles);
    if ([...allowRoles].some((role) => !ROLES.has(role))) {
      throw new TypeError("allowRoles contains an unsupported role.");
    }
  }
  if (requiredRole && allowRoles && !allowRoles.has(requiredRole)) {
    throw new TypeError("requiredRole must be included in allowRoles.");
  }
  return { allowRoles, requiredRole };
}

function assertDependencies(dependencies) {
  if (
    !dependencies
    || typeof dependencies.authenticate !== "function"
    || typeof dependencies.supabaseFetch !== "function"
  ) {
    throw new TypeError("Authorization dependencies are not configured.");
  }
}

async function authenticateActiveMemberWith(dependencies, request, options = {}) {
  assertDependencies(dependencies);
  const roles = roleOptions(options);
  const claims = dependencies.authenticate(request);
  const rows = await dependencies.supabaseFetch(
    `family_members?select=id,family_id,member_key,display_name,role,avatar_emoji,is_active&id=eq.${encodeURIComponent(claims.sub)}&limit=1`
  );
  const member = rows?.[0];
  if (!member) throw sessionInvalid("member-deleted");
  if (member.is_active !== true) throw sessionInvalid("member-inactive");
  if (String(member.id) !== String(claims.sub)) throw sessionInvalid("member-id-drift");
  if (String(member.family_id) !== String(claims.family)) throw sessionInvalid("family-drift");
  if (String(member.member_key) !== String(claims.key)) throw sessionInvalid("member-key-drift");
  if (member.role !== claims.role) throw sessionInvalid("member-role-drift");
  if (
    (roles.requiredRole && member.role !== roles.requiredRole)
    || (roles.allowRoles && !roles.allowRoles.has(member.role))
  ) {
    throw authorizationError("AUTH_ROLE_REQUIRED", "current-role-not-allowed");
  }
  return {
    claims,
    familyId: String(member.family_id),
    memberId: String(member.id),
    memberKey: String(member.member_key),
    role: member.role,
    member,
  };
}

function childIdentifier(value) {
  if (typeof value !== "string") return null;
  if (UUID_PATTERN.test(value)) return { column: "id", value };
  if (MEMBER_KEY_PATTERN.test(value)) return { column: "member_key", value };
  return null;
}

function assertContext(context) {
  if (
    !context
    || !context.familyId
    || !context.memberId
    || !ROLES.has(context.role)
  ) {
    throw new TypeError("Authorization context is invalid.");
  }
}

async function resolveActiveFamilyChildWith(dependencies, context, identifier) {
  assertDependencies(dependencies);
  assertContext(context);
  if (context.role !== "parent") {
    throw authorizationError("AUTH_ROLE_REQUIRED", "parent-child-selection-required");
  }
  const parsed = childIdentifier(identifier);
  if (!parsed) throw safeNotFound("FAMILY_CHILD_NOT_FOUND");
  const rows = await dependencies.supabaseFetch(
    `family_members?select=id,family_id,member_key,display_name,role,avatar_emoji,is_active&family_id=eq.${encodeURIComponent(context.familyId)}&${parsed.column}=eq.${encodeURIComponent(parsed.value)}&role=eq.child&is_active=eq.true&limit=1`
  );
  const child = rows?.[0];
  if (
    !child
    || String(child.family_id) !== String(context.familyId)
    || child.role !== "child"
    || child.is_active !== true
  ) {
    throw safeNotFound("FAMILY_CHILD_NOT_FOUND");
  }
  return child;
}

function childSelfScope(context, requestedMemberId) {
  assertContext(context);
  if (context.role !== "child") {
    throw authorizationError("AUTH_ROLE_REQUIRED", "child-self-scope-required");
  }
  if (requestedMemberId !== undefined && requestedMemberId !== null) {
    throw authorizationError("AUTH_ROLE_REQUIRED", "child-scope-override");
  }
  return context.memberId;
}

function sqlIdentifier(value, field) {
  if (typeof value !== "string" || !IDENTIFIER_PATTERN.test(value)) {
    throw new TypeError(`${field} is invalid.`);
  }
  return value;
}

function buildFamilyScopedObjectPath(context, options = {}) {
  assertContext(context);
  const table = sqlIdentifier(options.table, "table");
  const idColumn = sqlIdentifier(options.idColumn || "id", "idColumn");
  const select = typeof options.select === "string" && options.select ? options.select : "*";
  if (options.objectId === undefined || options.objectId === null || String(options.objectId) === "") {
    throw new TypeError("objectId is required.");
  }
  return `${table}?select=${encodeURIComponent(select)}&${idColumn}=eq.${encodeURIComponent(String(options.objectId))}&family_id=eq.${encodeURIComponent(context.familyId)}&limit=1`;
}

function publicAuthorizationError(error) {
  const contract = PUBLIC_ERRORS[error?.code];
  if (contract) {
    return {
      status: contract.status,
      body: { ok: false, error: contract.error, code: error.code },
    };
  }
  return {
    status: 500,
    body: {
      ok: false,
      error: "The request could not be processed.",
      code: "REQUEST_FAILED",
    },
  };
}

function defaultDependencies() {
  // Lazy loading keeps the common module reusable by family/_utils without a cycle.
  return require("./family/_utils");
}

function createAuthorizationFoundation(dependencies) {
  assertDependencies(dependencies);
  return Object.freeze({
    authenticateActiveMember: (request, options) => (
      authenticateActiveMemberWith(dependencies, request, options)
    ),
    resolveActiveFamilyChild: (context, identifier) => (
      resolveActiveFamilyChildWith(dependencies, context, identifier)
    ),
  });
}

module.exports = {
  authenticateActiveMember: (request, options) => (
    authenticateActiveMemberWith(defaultDependencies(), request, options)
  ),
  buildFamilyScopedObjectPath,
  childSelfScope,
  createAuthorizationFoundation,
  publicAuthorizationError,
  resolveActiveFamilyChild: (context, identifier) => (
    resolveActiveFamilyChildWith(defaultDependencies(), context, identifier)
  ),
  safeNotFound,
};
