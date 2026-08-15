const u = require("./family/_utils");
const authorization = require("./_authorization");

function cleanMilestones(value) {
  if (!Array.isArray(value) || value.length > 20) throw u.err("보상 마일스톤 목록을 확인해 주세요.", 400, "INVALID_MILESTONES");
  const seen = new Set();
  return value.map((item, index) => {
    const required = Number(item.required_stickers ?? item.stars);
    const name = String(item.reward_name ?? item.name ?? "").trim();
    if (!Number.isInteger(required) || required < 1 || required > 100000 || !name || name.length > 100 || seen.has(required)) {
      throw u.err("보상 마일스톤 값을 확인해 주세요.", 400, "INVALID_MILESTONE");
    }
    seen.add(required);
    return { required_stickers: required, reward_name: name, sort_order: Number.isInteger(Number(item.sort_order)) ? Number(item.sort_order) : index };
  });
}

module.exports = async function rewardMilestones(request, response) {
  if (!["GET", "PUT"].includes(request.method)) return u.allow(response, ["GET", "PUT"]);
  try {
    const context = await u.authenticateActiveMember(request, { requiredRole: "parent" });
    const familyId = encodeURIComponent(context.familyId);
    if (request.method === "GET") {
      const rows = await u.supabaseFetch(`reward_milestones?select=id,required_stickers,reward_name,sort_order,created_at,updated_at&family_id=eq.${familyId}&order=required_stickers.asc,sort_order.asc`);
      return u.json(response, 200, { milestones: rows || [] });
    }
    const milestones = cleanMilestones((await u.readJson(request)).milestones);
    await u.supabaseFetch(`reward_milestones?family_id=eq.${familyId}`, { method: "DELETE" });
    const rows = milestones.length ? await u.supabaseFetch("reward_milestones", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(milestones.map((item) => ({ ...item, family_id: context.familyId }))),
    }) : [];
    return u.json(response, 200, { ok: true, milestones: rows || [] });
  } catch (error) {
    const safe = authorization.publicAuthorizationError(error);
    if (safe.status !== 500) return u.json(response, safe.status, safe.body);
    const controlled = Boolean(error.statusCode >= 400 && error.statusCode < 500 && !error.supabaseCode);
    return u.json(response, controlled ? error.statusCode : 500, {
      ok: false,
      error: controlled ? error.message : "보상 마일스톤을 처리하지 못했습니다.",
      code: controlled && error.code ? error.code : "REWARD_MILESTONES_FAILED",
    });
  }
};
