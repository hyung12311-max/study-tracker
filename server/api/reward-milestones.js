const u = require("./family/_utils");

async function activeMember(claims) {
  return (await u.supabaseFetch(
    `family_members?select=id,role,is_active&id=eq.${encodeURIComponent(claims.sub)}&family_id=eq.${encodeURIComponent(claims.family)}&is_active=eq.true&limit=1`
  ))?.[0] || null;
}

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
    const claims = u.authenticate(request, request.method === "PUT" ? "parent" : undefined);
    if (!await activeMember(claims)) throw u.err("권한이 없습니다.", 403, "ACTIVE_MEMBER_REQUIRED");
    if (request.method === "GET") {
      const rows = await u.supabaseFetch(
        `reward_milestones?select=id,required_stickers,reward_name,sort_order,created_at,updated_at&family_id=eq.${encodeURIComponent(claims.family)}&order=required_stickers.asc,sort_order.asc`
      );
      return u.json(response, 200, { milestones: rows || [] });
    }
    const body = await u.readJson(request);
    const milestones = cleanMilestones(body.milestones);
    await u.supabaseFetch(`reward_milestones?family_id=eq.${encodeURIComponent(claims.family)}`, { method: "DELETE" });
    let rows = [];
    if (milestones.length) {
      rows = await u.supabaseFetch("reward_milestones", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(milestones.map((item) => ({ ...item, family_id: claims.family }))),
      });
    }
    return u.json(response, 200, { ok: true, milestones: rows || [] });
  } catch (error) {
    console.error("[reward milestones failed]", { status: error.statusCode || 500, code: error.supabaseCode || error.code || null, message: error.supabaseMessage || error.message, details: error.supabaseDetails || null });
    return u.json(response, error.supabaseCode ? 500 : (error.statusCode || 500), { error: error.statusCode === 401 ? "로그인이 만료되었습니다." : error.statusCode === 403 ? "권한이 없습니다." : error.statusCode ? error.message : "서버 오류가 발생했습니다.", code: error.supabaseCode || error.code || "REWARD_MILESTONES_FAILED" });
  }
};
