const crypto = require("crypto");
const u = require("./_utils");

const ALLOWED_FIELDS = new Set(["clientRequestId", "displayName", "avatarEmoji"]);
const FORBIDDEN_FIELDS = new Set(["family_id", "familyId", "role", "is_active", "isActive", "member_key", "memberKey", "pin", "pin_hash", "parentId"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const AVATARS = new Set(["👦", "👧", "🧒", "🐰", "🐻", "🐱", "🦊", "🐼"]);

function fail(message, statusCode, code) { const error = new Error(message); error.statusCode = statusCode; error.code = code; return error; }
function normalizeName(value) { if (typeof value !== "string") return ""; const name = value.normalize("NFKC").trim(); return name && [...name].length <= 60 && !/[\p{Cc}\p{Cf}]/u.test(name) ? name : ""; }
function digest(secret, value) { return crypto.createHmac("sha256", secret).update(value).digest("hex"); }
function validate(body) {
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(key => !ALLOWED_FIELDS.has(key) || FORBIDDEN_FIELDS.has(key))) throw fail("Child information is invalid.", 400, "CHILD_VALIDATION_FAILED");
  const clientRequestId = String(body.clientRequestId || ""), displayName = normalizeName(body.displayName), avatarEmoji = body.avatarEmoji === undefined || body.avatarEmoji === "" ? "🧒" : String(body.avatarEmoji);
  if (!UUID.test(clientRequestId) || !displayName || !AVATARS.has(avatarEmoji)) throw fail("Child information is invalid.", 400, "CHILD_VALIDATION_FAILED");
  return { clientRequestId, displayName, avatarEmoji };
}
function mapDatabaseError(error) {
  const marker = `${error?.supabaseCode}:${error?.supabaseMessage}`;
  if (marker === "55000:IDEMPOTENCY_CONFLICT") return fail("This request ID was already used.", 409, "IDEMPOTENCY_CONFLICT");
  if (marker === "22023:CHILD_VALIDATION_FAILED") return fail("Child information is invalid.", 400, "CHILD_VALIDATION_FAILED");
  if (marker === "42501:PARENT_REQUIRED") return fail("Parent permission is required.", 403, "PARENT_REQUIRED");
  if (marker === "55000:CHILD_CREATION_RATE_LIMITED") return fail("Too many child creation attempts.", 429, "CHILD_CREATION_RATE_LIMITED");
  if (marker === "55000:FAMILY_MEMBER_LIMIT_REACHED") return fail("The family member limit was reached.", 409, "FAMILY_MEMBER_LIMIT_REACHED");
  return error;
}
function diagnosticMessage(error) {
  // The shared fetch helper may use the hint as a fallback message. Never log it.
  const value = error?.supabaseMessage;
  if (typeof value !== "string" || value === error?.supabaseHint) return null;
  const safeMarkers = new Set(["IDEMPOTENCY_CONFLICT", "CHILD_VALIDATION_FAILED", "PARENT_REQUIRED", "CHILD_CREATION_RATE_LIMITED", "FAMILY_MEMBER_LIMIT_REACHED"]);
  return safeMarkers.has(value) ? value : null;
}

module.exports = async function createChild(request, response) {
  if (request.method !== "POST") return u.allow(response, ["POST"]);
  const correlationId = crypto.randomUUID();
  let stage = "auth-context";
  response.setHeader("Cache-Control", "no-store");
  try {
    const context = await u.authenticateActiveMember(request, { requiredRole: "parent" });
    stage = "request-parse";
    const body = await u.readJson(request);
    stage = "request-validation";
    const input = validate(body);
    stage = "digest-generation";
    const secret = u.env("FAMILY_AUTH_SECRET");
    if (!secret || secret.length < 32) throw fail("Child creation could not be completed.", 500, "CHILD_CREATION_FAILED");
    const requestDigest = digest(secret, JSON.stringify({ displayName: input.displayName, avatarEmoji: input.avatarEmoji }));
    let rpc;
    stage = "rpc-create-child";
    try {
      rpc = await u.supabaseFetch("rpc/create_product_family_child", { method: "POST", body: JSON.stringify({ p_family_id: context.familyId, p_parent_member_id: context.memberId, p_client_request_id: input.clientRequestId, p_request_digest: requestDigest, p_display_name: input.displayName, p_avatar_emoji: input.avatarEmoji }) });
    } catch (error) { throw mapDatabaseError(error); }
    stage = "rpc-response-validation";
    const result = Array.isArray(rpc) ? rpc[0] : rpc;
    if (!result || !UUID.test(result.child_member_id || "") || result.canonical_status !== "complete") throw fail("Child creation could not be completed.", 500, "CHILD_CREATION_FAILED");
    return u.json(response, result.created === true ? 201 : 200, { ok: true, created: result.created === true, child: { id: result.child_member_id, displayName: result.display_name, role: "child", avatarEmoji: result.avatar_emoji, isActive: true }, onboardingState: "LEARNING_SETUP_OPTIONAL" });
  } catch (error) {
    const auth = new Set(["AUTH_SESSION_INVALID", "AUTH_ROLE_REQUIRED"]);
    if (auth.has(error?.code)) { const safe = require("../_authorization").publicAuthorizationError(error); return u.json(response, safe.status, safe.body); }
    const known = new Set(["CHILD_VALIDATION_FAILED", "PARENT_REQUIRED", "IDEMPOTENCY_CONFLICT", "CHILD_CREATION_RATE_LIMITED", "FAMILY_MEMBER_LIMIT_REACHED"]);
    if (known.has(error?.code)) return u.json(response, error.statusCode, { ok: false, error: error.message, code: error.code });
    console.error({ route: "/api/family/children", method: "POST", stage, correlationId, supabaseCode: typeof error?.supabaseCode === "string" && /^[A-Z0-9]{5,8}$/.test(error.supabaseCode) ? error.supabaseCode : null, supabaseMessage: diagnosticMessage(error), httpStatus: 500 });
    return u.json(response, 500, { ok: false, error: "Child creation could not be completed.", code: "CHILD_CREATION_FAILED", correlationId });
  }
};

module.exports._test = { ALLOWED_FIELDS, AVATARS, digest, normalizeName, validate };
