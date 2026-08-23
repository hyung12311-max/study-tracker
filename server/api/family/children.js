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
  const marker = String(error.supabaseMessage || error.message || "");
  if (marker.includes("IDEMPOTENCY_CONFLICT")) return fail("This request ID was already used.", 409, "IDEMPOTENCY_CONFLICT");
  if (marker.includes("CHILD_CREATION_RATE_LIMITED")) return fail("Too many child creation attempts.", 429, "CHILD_CREATION_RATE_LIMITED");
  if (marker.includes("FAMILY_MEMBER_LIMIT_REACHED")) return fail("The family member limit was reached.", 409, "FAMILY_MEMBER_LIMIT_REACHED");
  return fail("Child creation could not be completed.", 500, "CHILD_CREATION_FAILED");
}

module.exports = async function createChild(request, response) {
  if (request.method !== "POST") return u.allow(response, ["POST"]);
  response.setHeader("Cache-Control", "no-store");
  try {
    const context = await u.authenticateActiveMember(request, { requiredRole: "parent" });
    const input = validate(await u.readJson(request));
    const secret = u.env("FAMILY_AUTH_SECRET");
    if (!secret || secret.length < 32) throw fail("Child creation could not be completed.", 500, "CHILD_CREATION_FAILED");
    const requestDigest = digest(secret, JSON.stringify({ displayName: input.displayName, avatarEmoji: input.avatarEmoji }));
    let rpc;
    try {
      rpc = await u.supabaseFetch("rpc/create_product_family_child", { method: "POST", body: JSON.stringify({ p_family_id: context.familyId, p_parent_member_id: context.memberId, p_client_request_id: input.clientRequestId, p_request_digest: requestDigest, p_display_name: input.displayName, p_avatar_emoji: input.avatarEmoji }) });
    } catch (error) { throw mapDatabaseError(error); }
    const result = Array.isArray(rpc) ? rpc[0] : rpc;
    if (!result || !UUID.test(result.child_member_id || "") || result.canonical_status !== "complete") throw fail("Child creation could not be completed.", 500, "CHILD_CREATION_FAILED");
    return u.json(response, result.created === true ? 201 : 200, { ok: true, created: result.created === true, child: { id: result.child_member_id, displayName: result.display_name, role: "child", avatarEmoji: result.avatar_emoji, isActive: true }, onboardingState: "LEARNING_SETUP_OPTIONAL" });
  } catch (error) {
    const auth = new Set(["AUTH_SESSION_INVALID", "AUTH_ROLE_REQUIRED"]);
    if (auth.has(error.code)) { const safe = require("../_authorization").publicAuthorizationError(error); return u.json(response, safe.status, safe.body); }
    const known = new Set(["CHILD_VALIDATION_FAILED", "IDEMPOTENCY_CONFLICT", "CHILD_CREATION_RATE_LIMITED", "FAMILY_MEMBER_LIMIT_REACHED", "CHILD_CREATION_FAILED"]);
    return u.json(response, known.has(error.code) ? error.statusCode : 500, { ok: false, error: known.has(error.code) ? error.message : "Child creation could not be completed.", code: known.has(error.code) ? error.code : "CHILD_CREATION_FAILED" });
  }
};

module.exports._test = { ALLOWED_FIELDS, AVATARS, digest, normalizeName, validate };
