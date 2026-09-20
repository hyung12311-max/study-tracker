const crypto = require("crypto");
const u = require("./_utils");

const CROCKFORD = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function secret() { const value = u.env("FAMILY_AUTH_SECRET"); if (!value || value.length < 32) throw u.err("Invite service is not configured.", 500, "INVITE_FAILED"); return value; }
function normalizeCode(value) { const code = String(value || "").normalize("NFKC").toUpperCase().replace(/[\s-]/g, ""); return code.length === 20 && [...code].every(char => CROCKFORD.includes(char)) ? code : ""; }
function inviteHash(code) { return crypto.createHmac("sha256", secret()).update(`family-invite:v1:${code}`).digest("hex"); }
function generateCode() { let code = ""; while (code.length < 20) { for (const byte of crypto.randomBytes(32)) { if (byte >= Math.floor(256 / CROCKFORD.length) * CROCKFORD.length) continue; code += CROCKFORD[byte % CROCKFORD.length]; if (code.length === 20) break; } } return code; }
function displayCode(code) { return code.match(/.{1,5}/g).join("-"); }
function databaseFailure(error) { const marker = String(error.supabaseMessage || error.message || ""); if (marker.includes("INVITE_CREATE_RATE_LIMITED")) return u.err("Too many invite creation attempts.", 429, "INVITE_CREATE_RATE_LIMITED"); return u.err("Invite request failed.", 500, "INVITE_FAILED"); }

module.exports = async function familyInvites(request, response) {
  if (!["GET", "POST", "DELETE"].includes(request.method)) return u.allow(response, ["GET", "POST", "DELETE"]);
  response.setHeader("Cache-Control", "no-store");
  try {
    const context = await u.authenticateActiveMember(request, { requiredRole: "parent" });
    if (request.method === "POST") {
      const code = generateCode();
      let rpc;
      try { rpc = await u.supabaseFetch("rpc/create_product_family_invite", { method: "POST", body: JSON.stringify({ p_family_id: context.familyId, p_parent_member_id: context.memberId, p_invite_hash: inviteHash(code) }) }); } catch (error) { throw databaseFailure(error); }
      const result = Array.isArray(rpc) ? rpc[0] : rpc;
      if (!UUID.test(result?.safe_ref || "") || !result?.expires_at) throw u.err("Invite request failed.", 500, "INVITE_FAILED");
      return u.json(response, 201, { ok: true, invite: { code: displayCode(code), safeRef: result.safe_ref, expiresAt: result.expires_at } });
    }
    if (request.method === "DELETE") {
      const inviteRef = String(request.query?.inviteRef || "");
      if (!UUID.test(inviteRef)) throw u.err("Invite request is invalid.", 400, "INVITE_INVALID_REQUEST");
      await u.supabaseFetch("rpc/revoke_product_family_invite", { method: "POST", body: JSON.stringify({ p_family_id: context.familyId, p_parent_member_id: context.memberId, p_safe_ref: inviteRef }) });
      return u.json(response, 200, { ok: true });
    }
    const rows = await u.supabaseFetch(`family_invites?select=safe_ref,created_at,expires_at,used_at,revoked_at&family_id=eq.${encodeURIComponent(context.familyId)}&creator_parent_id=eq.${encodeURIComponent(context.memberId)}&order=created_at.desc&limit=20`);
    return u.json(response, 200, { ok: true, invites: (rows || []).map(row => ({ safeRef: row.safe_ref, createdAt: row.created_at, expiresAt: row.expires_at, usedAt: row.used_at, revokedAt: row.revoked_at })) });
  } catch (error) {
    if (error.statusCode === 401 && error.code === "AUTH_REQUIRED") {
      return u.json(response, 401, { ok: false, error: "Authentication is required.", code: "AUTH_REQUIRED" });
    }
    // Normalize only the token verifier's explicit failures to the Product session contract.
    const authCode = error.statusCode === 401 && ["AUTH_INVALID", "AUTH_CLAIMS_INVALID", "AUTH_EXPIRED"].includes(error.code)
      ? "AUTH_SESSION_INVALID" : error.code;
    if (["AUTH_SESSION_INVALID", "AUTH_ROLE_REQUIRED"].includes(authCode)) { const safe = require("../_authorization").publicAuthorizationError({ code: authCode }); return u.json(response, safe.status, safe.body); }
    const known = new Set(["INVITE_INVALID_REQUEST", "INVITE_CREATE_RATE_LIMITED", "INVITE_FAILED"]);
    return u.json(response, known.has(error.code) ? error.statusCode : 500, { ok: false, error: known.has(error.code) ? error.message : "Invite request failed.", code: known.has(error.code) ? error.code : "INVITE_FAILED" });
  }
};

module.exports._test = { CROCKFORD, displayCode, generateCode, inviteHash, normalizeCode };
