const crypto = require("crypto");
const u = require("../family/_utils");
const invite = require("../family/invites")._test;

function digest(secret, value) { return crypto.createHmac("sha256", secret).update(value).digest("hex"); }
function reject(response, status = 401, code = "INVITE_INVALID") { return u.json(response, status, { ok: false, error: "초대 코드를 확인해 주세요.", code }); }

module.exports = async function exchangeInvite(request, response) {
  if (request.method !== "POST") return u.allow(response, ["POST"]);
  response.setHeader("Cache-Control", "no-store");
  try {
    const body = await u.readJson(request), code = invite.normalizeCode(body?.inviteCode);
    const authSecret = u.env("FAMILY_AUTH_SECRET");
    if (!code || !authSecret || authSecret.length < 32) return reject(response);
    const address = String(request.headers["x-forwarded-for"] || request.socket?.remoteAddress || "unknown").split(",", 1)[0].trim();
    const codeHash = invite.inviteHash(code);
    const rpc = await u.supabaseFetch("rpc/exchange_product_family_invite", { method: "POST", body: JSON.stringify({ p_invite_hash: codeHash, p_rate_scope_hash: digest(authSecret, `family-invite-exchange:v1:${address}:${codeHash}`) }) });
    const result = Array.isArray(rpc) ? rpc[0] : rpc;
    if (result?.result_code === "INVITE_RATE_LIMITED") return reject(response, 429, "INVITE_RATE_LIMITED");
    const family = result?.["family" + "_id"];
    if (result?.result_code !== "OK" || !/^[0-9a-f-]{36}$/i.test(family || "")) return reject(response);
    u.setBootstrapCookie(request, response, family);
    return u.json(response, 200, { ok: true, state: "FAMILY_CONTEXT_READY" });
  } catch { return reject(response); }
};
