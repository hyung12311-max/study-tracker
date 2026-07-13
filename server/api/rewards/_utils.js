const family = require("../family/_utils");

function productSafe(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || "",
    sticker_cost: Number(row.sticker_cost),
    image_url: row.image_url || "",
    emoji: row.emoji || "🎁",
    stock: row.stock === null ? null : Number(row.stock),
    is_active: Boolean(row.is_active),
    sort_order: Number(row.sort_order || 0),
    category: row.category || "기타",
    available_from: row.available_from,
    available_until: row.available_until,
    created_at: row.created_at,
  };
}

function requestSafe(row) {
  return {
    id: row.id,
    member_id: row.member_id,
    product_id: row.product_id,
    product_name: row.product_name,
    product_emoji: row.product_emoji,
    sticker_cost: Number(row.sticker_cost),
    status: row.status,
    requested_at: row.requested_at,
    decided_at: row.decided_at,
    rejection_reason: row.rejection_reason,
    member: row.family_members ? {
      display_name: row.family_members.display_name,
      avatar_emoji: row.family_members.avatar_emoji,
    } : null,
  };
}

async function insertSystemMessage(familyId, type, id, content) {
  try {
    await family.supabaseFetch("family_messages?on_conflict=family_id,related_type,related_id", {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates" },
      body: JSON.stringify({
        family_id: familyId,
        sender_id: null,
        message_type: "system",
        content,
        related_type: type,
        related_id: String(id),
        push_sent_at: new Date().toISOString(),
      }),
    });
  } catch (error) {
    console.warn("[reward system message] failed", { requestId: id, statusCode: error.statusCode || 500 });
  }
}

async function sendTargetedPush({ familyId, target = "parent", memberId, title, body, tag, event = "reward_request", url = "/?tab=rewards" }) {
  try {
    const notifications = require("../notifications/_utils");
    let memberKeys = [];
    if (target === "parent") {
      const parents = await family.supabaseFetch(
        `family_members?select=member_key&family_id=eq.${familyId}&role=eq.parent&is_active=eq.true`
      );
      memberKeys = (parents || []).map((member) => member.member_key);
    } else if (memberId) {
      const member = (await family.supabaseFetch(
        `family_members?select=member_key&family_id=eq.${familyId}&id=eq.${memberId}&is_active=eq.true&limit=1`
      ))?.[0];
      if (member?.member_key) memberKeys = [member.member_key];
    }
    if (!memberKeys.length) return { success: 0, failure: 0, subscriptionCount: 0 };
    const result = await notifications.sendToFamily({
      familyId,
      memberKeys,
      event,
      payload: { title, body, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", url, tag },
    });
    console.log("[reward push]", { tag, success: result.success, failure: result.failure });
    return result;
  } catch (error) {
    console.warn("[reward push] failed", { tag, statusCode: error.statusCode || 500 });
    return { success: 0, failure: 1, subscriptionCount: 0, error: true };
  }
}

async function memberInFamily(memberId, familyId) {
  return (await family.supabaseFetch(
    `family_members?select=id,display_name,avatar_emoji,role,is_active&id=eq.${memberId}&family_id=eq.${familyId}&limit=1`
  ))?.[0] || null;
}

module.exports = { ...family, insertSystemMessage, memberInFamily, productSafe, requestSafe, sendTargetedPush };
