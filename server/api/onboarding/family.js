const crypto = require("crypto");
const u = require("../family/_utils");

const ALLOWED_FIELDS = new Set([
  "onboardingRequestId", "familyDisplayName", "parentDisplayName", "parentPin", "rememberDevice",
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SIMPLE_PINS = new Set(["0000", "1111", "1234", "4321"]);
const MAX_BODY_BYTES = 16 * 1024;

function failure(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function send(response, status, body) {
  response.setHeader("Cache-Control", "no-store");
  return u.json(response, status, body);
}

function normalizeName(value) {
  if (typeof value !== "string") return "";
  const normalized = value.normalize("NFKC").trim();
  if (!normalized || [...normalized].length > 60 || /[\p{Cc}\p{Cf}]/u.test(normalized)) return "";
  return normalized;
}

function validateRequest(request, body) {
  const contentType = String(request.headers["content-type"] || "").split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") throw failure("Registration request is invalid.", 400, "ONBOARDING_VALIDATION_FAILED");
  const contentLength = Number(request.headers["content-length"] || 0);
  if (contentLength > MAX_BODY_BYTES || JSON.stringify(body).length > MAX_BODY_BYTES) {
    throw failure("Registration request is invalid.", 400, "ONBOARDING_VALIDATION_FAILED");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)
      || Object.keys(body).some((key) => !ALLOWED_FIELDS.has(key))) {
    throw failure("Registration request is invalid.", 400, "ONBOARDING_VALIDATION_FAILED");
  }
  const origin = String(request.headers.origin || "");
  const host = String(request.headers["x-forwarded-host"] || request.headers.host || "").split(",", 1)[0].trim();
  if (origin) {
    let originHost = "";
    try { originHost = new URL(origin).host; } catch {}
    if (!originHost || originHost !== host) throw failure("Registration request is invalid.", 403, "ONBOARDING_VALIDATION_FAILED");
  }
  const onboardingRequestId = String(body.onboardingRequestId || "");
  const familyDisplayName = normalizeName(body.familyDisplayName);
  const parentDisplayName = normalizeName(body.parentDisplayName);
  const parentPin = String(body.parentPin || "");
  if (!UUID.test(onboardingRequestId) || !familyDisplayName || !parentDisplayName
      || !/^\d{4}$/.test(parentPin) || typeof body.rememberDevice !== "boolean") {
    throw failure("Registration request is invalid.", 400, "ONBOARDING_VALIDATION_FAILED");
  }
  if (SIMPLE_PINS.has(parentPin) || /^(\d)\1{3}$/.test(parentPin)) {
    throw failure("Choose a less predictable Parent PIN.", 400, "WEAK_PARENT_PIN");
  }
  return { onboardingRequestId, familyDisplayName, parentDisplayName, parentPin, rememberDevice: body.rememberDevice };
}

function keyedDigest(secret, value) {
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

function mapDatabaseError(error) {
  const marker = String(error.supabaseMessage || error.message || "");
  if (marker.includes("IDEMPOTENCY_CONFLICT")) return failure("This registration ID was already used.", 409, "IDEMPOTENCY_CONFLICT");
  if (marker.includes("ONBOARDING_RATE_LIMITED")) return failure("Too many registration attempts.", 429, "ONBOARDING_RATE_LIMITED");
  return failure("Family registration could not be completed.", 500, "ONBOARDING_CREATION_FAILED");
}

module.exports = async function registerProductFamily(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return send(response, 405, { ok: false, error: "Method not allowed.", code: "METHOD_NOT_ALLOWED" });
  }
  try {
    const body = await u.readJson(request);
    const input = validateRequest(request, body);
    const secret = u.env("FAMILY_AUTH_SECRET");
    if (!secret || secret.length < 32) throw failure("Family authentication is not configured.", 500, "ONBOARDING_CREATION_FAILED");
    const canonical = JSON.stringify({
      familyDisplayName: input.familyDisplayName,
      parentDisplayName: input.parentDisplayName,
      parentPin: input.parentPin,
      rememberDevice: input.rememberDevice,
    });
    const forwarded = String(request.headers["x-forwarded-for"] || "").split(",", 1)[0].trim();
    const address = forwarded || request.socket?.remoteAddress || "unknown";
    const agent = String(request.headers["user-agent"] || "").slice(0, 200);
    const requestDigest = keyedDigest(secret, `product-onboarding:v1:${canonical}`);
    const rateScopeDigest = keyedDigest(secret, `product-onboarding-rate:v1:${address}:${agent}`);
    let rpc;
    try {
      rpc = await u.supabaseFetch("rpc/create_product_family_with_first_parent", {
        method: "POST",
        body: JSON.stringify({
          p_onboarding_request_id: input.onboardingRequestId,
          p_request_digest: requestDigest,
          p_rate_scope_digest: rateScopeDigest,
          p_family_display_name: input.familyDisplayName,
          p_parent_display_name: input.parentDisplayName,
          p_parent_pin: input.parentPin,
        }),
      });
    } catch (error) {
      throw mapDatabaseError(error);
    }
    const result = Array.isArray(rpc) ? rpc[0] : rpc;
    if (!result || !UUID.test(result.family_id || "") || !UUID.test(result.parent_member_id || "")
        || result.canonical_status !== "complete") {
      throw failure("Family registration could not be completed.", 500, "ONBOARDING_CREATION_FAILED");
    }
    const member = {
      id: result.parent_member_id,
      family_id: result.family_id,
      member_key: "parent",
      display_name: input.parentDisplayName,
      role: "parent",
      avatar_emoji: "👤",
    };
    const token = u.signToken(member);
    const realtimeToken = u.signRealtimeToken(member);
    u.setBootstrapCookie(request, response, result.family_id);
    let deviceSessionExpiresAt = null;
    if (input.rememberDevice) {
      const deviceSession = await u.createDeviceSession(request, response, member);
      deviceSessionExpiresAt = deviceSession.expiresAt;
    } else {
      u.clearDeviceCookie(request, response);
    }
    return send(response, result.created === true ? 201 : 200, {
      ok: true,
      created: result.created === true,
      onboardingState: "PARENT_AUTHENTICATED",
      token,
      realtimeToken,
      expiresIn: 28800,
      rememberDevice: input.rememberDevice,
      deviceSessionExpiresAt,
      member: {
        id: member.id,
        displayName: member.display_name,
        role: member.role,
        avatarEmoji: member.avatar_emoji,
      },
      next: { childRequired: true },
    });
  } catch (error) {
    const known = new Set([
      "ONBOARDING_VALIDATION_FAILED", "WEAK_PARENT_PIN", "IDEMPOTENCY_CONFLICT",
      "ONBOARDING_RATE_LIMITED", "ONBOARDING_CREATION_FAILED",
    ]);
    const code = known.has(error.code) ? error.code : "ONBOARDING_CREATION_FAILED";
    const status = known.has(error.code) ? (error.statusCode || 500) : 500;
    const message = known.has(error.code) ? error.message : "Family registration could not be completed.";
    return send(response, status, { ok: false, error: message, code });
  }
};

module.exports._test = { keyedDigest, normalizeName, validateRequest };
