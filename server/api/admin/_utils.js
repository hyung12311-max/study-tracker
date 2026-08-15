const crypto = require("crypto");
const push = require("../push/_utils");

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FAMILY_LABEL_PATTERN = /^uat-[a-z0-9][a-z0-9-]{2,20}$/;
const SIMPLE_PINS = new Set(["0000", "1111", "1234", "4321"]);
const MAX_UAT_CHILDREN = 5;

function err(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function send(response, status, body) {
  response.setHeader("Cache-Control", "no-store");
  return push.json(response, status, body);
}

function allow(response) {
  response.setHeader("Allow", "POST");
  return send(response, 405, { ok: false, error: "Method not allowed.", code: "METHOD_NOT_ALLOWED" });
}

function exactObject(value, fields, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw err("Provisioning request is invalid.", 400, code);
  }
  if (Object.keys(value).some((key) => !fields.has(key))) {
    throw err("Provisioning request contains unsupported fields.", 400, "FIELD_NOT_ALLOWED");
  }
  return value;
}

function requireMutationGuard(request) {
  const contentType = String(request.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") throw err("JSON requests are required.", 415, "JSON_REQUIRED");
  if (request.headers["x-study-csrf"] !== "1") throw err("Request verification is required.", 403, "CSRF_REQUIRED");

  const origin = String(request.headers.origin || "");
  const host = String(request.headers["x-forwarded-host"] || request.headers.host || "").split(",")[0].trim();
  const protocol = String(request.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  let parsed;
  try {
    parsed = new URL(origin);
  } catch {
    throw err("Request origin is not allowed.", 403, "ORIGIN_NOT_ALLOWED");
  }
  if (!host || parsed.host !== host || (protocol && parsed.protocol !== `${protocol}:`)) {
    throw err("Request origin is not allowed.", 403, "ORIGIN_NOT_ALLOWED");
  }
}

function requireAdmin(request) {
  const secret = push.env("UAT_PROVISIONING_SECRET");
  if (secret.length < 32) throw err("Provisioning is unavailable.", 503, "PROVISIONING_UNAVAILABLE");

  const authorization = String(request.headers.authorization || "");
  if (!authorization.startsWith("Bearer ")) {
    throw err("Admin authorization is required.", 401, "ADMIN_AUTH_REQUIRED");
  }
  const supplied = Buffer.from(authorization.slice(7), "utf8");
  const expected = Buffer.from(secret, "utf8");
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
    throw err("Admin authorization is invalid.", 403, "ADMIN_AUTH_INVALID");
  }
}

function pin(value) {
  if (typeof value !== "string" || !/^\d{4}$/.test(value) || SIMPLE_PINS.has(value) || /^(\d)\1{3}$/.test(value)) {
    throw err("A non-trivial 4-digit bootstrap PIN is required.", 400, "INVALID_BOOTSTRAP_PIN");
  }
  return value;
}

function displayName(value, actor) {
  if (typeof value !== "string" || value.trim() !== value || value.length < 5 || value.length > 80 || !/^UAT\b/i.test(value)) {
    throw err(`${actor} display name must be explicitly marked UAT.`, 400, "INVALID_UAT_DISPLAY_NAME");
  }
  return value;
}

function provisioningRequest(body) {
  exactObject(body, new Set(["requestId", "purpose", "familyLabel", "parent", "child"]), "INVALID_PROVISIONING_REQUEST");
  if (!UUID_PATTERN.test(body.requestId || "")) throw err("A valid request ID is required.", 400, "INVALID_REQUEST_ID");
  if (body.purpose !== "uat") throw err("Only UAT provisioning is allowed.", 400, "UAT_PURPOSE_REQUIRED");
  if (typeof body.familyLabel !== "string" || !FAMILY_LABEL_PATTERN.test(body.familyLabel)) {
    throw err("A valid uat- family label is required.", 400, "INVALID_UAT_FAMILY_LABEL");
  }

  const parent = exactObject(body.parent, new Set(["displayName", "pin"]), "INVALID_PARENT");
  const child = exactObject(body.child, new Set(["displayName", "pin"]), "INVALID_CHILD");
  const familyKey = body.familyLabel;
  const request = {
    requestId: body.requestId.toLowerCase(),
    purpose: "uat",
    familyKey,
    familyDisplayName: `UAT ${familyKey}`,
    parent: {
      memberKey: `${familyKey}-parent`,
      displayName: displayName(parent.displayName, "Parent"),
      pin: pin(parent.pin),
    },
    child: {
      memberKey: `${familyKey}-child`,
      displayName: displayName(child.displayName, "Child"),
      pin: pin(child.pin),
    },
  };
  if (request.parent.pin === request.child.pin) {
    throw err("Parent and child bootstrap PINs must differ.", 400, "BOOTSTRAP_PIN_REUSE");
  }
  request.digest = crypto.createHash("sha256").update(JSON.stringify({
    purpose: request.purpose,
    familyKey: request.familyKey,
    familyDisplayName: request.familyDisplayName,
    parentMemberKey: request.parent.memberKey,
    parentDisplayName: request.parent.displayName,
    childMemberKey: request.child.memberKey,
    childDisplayName: request.child.displayName,
  })).digest("hex");
  return request;
}

function provisioningRequestV2(body) {
  exactObject(body, new Set(["requestId", "purpose", "familyLabel", "parent", "children"]), "INVALID_PROVISIONING_REQUEST");
  if (!UUID_PATTERN.test(body.requestId || "")) throw err("A valid request ID is required.", 400, "INVALID_REQUEST_ID");
  if (body.purpose !== "uat") throw err("Only UAT provisioning is allowed.", 400, "UAT_PURPOSE_REQUIRED");
  if (typeof body.familyLabel !== "string" || !FAMILY_LABEL_PATTERN.test(body.familyLabel)) {
    throw err("A valid uat- family label is required.", 400, "INVALID_UAT_FAMILY_LABEL");
  }
  if (!Array.isArray(body.children) || body.children.length < 1 || body.children.length > MAX_UAT_CHILDREN) {
    throw err(`UAT provisioning requires between 1 and ${MAX_UAT_CHILDREN} children.`, 400, "INVALID_CHILD_COUNT");
  }

  const parentInput = exactObject(body.parent, new Set(["displayName", "pin"]), "INVALID_PARENT");
  const parent = {
    memberKey: "parent",
    displayName: displayName(parentInput.displayName, "Parent"),
    pin: pin(parentInput.pin),
  };
  const children = body.children.map((value, index) => {
    const child = exactObject(value, new Set(["displayName", "pin"]), "INVALID_CHILD");
    return {
      memberKey: `child${index + 1}`,
      displayName: displayName(child.displayName, `Child ${index + 1}`),
      pin: pin(child.pin),
    };
  });
  const pins = [parent.pin, ...children.map((child) => child.pin)];
  if (new Set(pins).size !== pins.length) {
    throw err("Every UAT bootstrap PIN must be distinct.", 400, "BOOTSTRAP_PIN_REUSE");
  }

  const request = {
    requestId: body.requestId.toLowerCase(),
    purpose: "uat",
    familyKey: body.familyLabel,
    familyDisplayName: `UAT ${body.familyLabel}`,
    parent,
    children,
  };
  request.digest = crypto.createHash("sha256").update(JSON.stringify({
    purpose: request.purpose,
    familyKey: request.familyKey,
    familyDisplayName: request.familyDisplayName,
    parentMemberKey: request.parent.memberKey,
    parentDisplayName: request.parent.displayName,
    children: request.children.map(({ memberKey, displayName: childDisplayName }) => ({ memberKey, displayName: childDisplayName })),
  })).digest("hex");
  return request;
}

function safeError(response, error) {
  const message = String(error.supabaseMessage || "");
  if (error.supabaseCode === "55000" && message.includes("IDEMPOTENCY_CONFLICT")) {
    return send(response, 409, { ok: false, error: "Request ID was already used for different UAT data.", code: "IDEMPOTENCY_CONFLICT" });
  }
  if ((error.supabaseCode === "55000" && message.includes("UAT_FAMILY_CONFLICT")) || error.supabaseCode === "23505") {
    return send(response, 409, { ok: false, error: "UAT family label is already reserved.", code: "UAT_FAMILY_CONFLICT" });
  }
  if (error.supabaseCode === "55000" && message.includes("UAT_REQUEST_CONFLICT")) {
    return send(response, 409, { ok: false, error: "UAT request ID is already reserved.", code: "UAT_REQUEST_CONFLICT" });
  }
  if (error.statusCode && !error.supabaseCode) {
    return send(response, error.statusCode, { ok: false, error: error.message, code: error.code || "PROVISIONING_REJECTED" });
  }
  console.error("[UAT provisioning failed]", {
    code: error.supabaseCode || error.code || null,
    status: error.statusCode || 500,
  });
  return send(response, 500, { ok: false, error: "UAT provisioning could not be completed.", code: "PROVISIONING_FAILED" });
}

module.exports = {
  allow,
  provisioningRequest,
  provisioningRequestV2,
  push,
  requireAdmin,
  requireMutationGuard,
  safeError,
  send,
};
