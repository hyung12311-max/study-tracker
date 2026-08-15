const u = require("./_utils");

const DEFAULT_SETTING = { target_stickers: 10, reward_name: "5,000원 용돈" };

function safe(row = DEFAULT_SETTING) {
  return {
    target_stickers: Number(row.target_stickers),
    reward_name: String(row.reward_name),
  };
}

module.exports = async function rewardSettings(request, response) {
  if (!["GET", "PUT"].includes(request.method)) return u.allow(response, ["GET", "PUT"]);
  try {
    const { claims } = await u.activeAuthenticatedMember(request, request.method === "PUT" ? "parent" : undefined);
    if (request.method === "GET") {
      const row = (await u.supabaseFetch(
        `family_reward_settings?select=target_stickers,reward_name&family_id=eq.${encodeURIComponent(claims.family)}&limit=1`
      ))?.[0];
      return u.json(response, 200, { ok: true, setting: safe(row || DEFAULT_SETTING) });
    }

    const body = await u.readJson(request);
    const allowed = new Set(["goal", "name"]);
    if (Object.keys(body).some((key) => !allowed.has(key))) throw u.err("Unexpected reward setting field.", 400, "REWARD_SETTING_FIELD_INVALID");
    const goal = Number(body.goal);
    const name = String(body.name || "").trim();
    if (!Number.isInteger(goal) || goal < 1 || goal > 10000) throw u.err("Reward goal must be an integer from 1 to 10000.", 400, "REWARD_GOAL_INVALID");
    if (!name || name.length > 120) throw u.err("Reward name must contain 1 to 120 characters.", 400, "REWARD_NAME_INVALID");
    const rows = await u.supabaseFetch("family_reward_settings?on_conflict=family_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({ family_id: claims.family, target_stickers: goal, reward_name: name, updated_at: new Date().toISOString() }),
    });
    return u.json(response, 200, { ok: true, setting: safe(rows?.[0] || { target_stickers: goal, reward_name: name }) });
  } catch (error) {
    return u.json(response, error.statusCode || 500, { ok: false, error: error.statusCode ? error.message : "Reward settings request failed.", code: error.code || "REWARD_SETTINGS_FAILED" });
  }
};
