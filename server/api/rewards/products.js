const u = require("./_utils");

function payload(body) {
  const name = String(body.name || "").trim();
  const description = String(body.description || "").trim();
  const cost = Number(body.stickerCost);
  const stock = body.stock === "" || body.stock === null || body.stock === undefined ? null : Number(body.stock);
  if (!name || name.length > 80 || !Number.isInteger(cost) || cost < 1 || (stock !== null && (!Number.isInteger(stock) || stock < 0))) {
    throw u.err("Check the product name, sticker cost, and stock.", 400, "REWARD_PRODUCT_INVALID");
  }
  return {
    name,
    description: description.slice(0, 500),
    sticker_cost: cost,
    image_url: String(body.imageUrl || "").trim().slice(0, 500) || null,
    emoji: String(body.emoji || "🎁").slice(0, 8),
    stock,
    is_active: body.isActive !== false,
    sort_order: Number.isInteger(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
    category: String(body.category || "기타").trim().slice(0, 40) || "기타",
    updated_at: new Date().toISOString(),
  };
}

async function scopedProduct(context, id) {
  if (!/^[0-9a-f-]{36}$/i.test(id || "")) throw u.err("Product id is required.", 400, "REWARD_PRODUCT_ID_INVALID");
  const row = (await u.supabaseFetch(u.buildFamilyScopedObjectPath(context, {
    table: "reward_products",
    objectId: id,
    select: "id,family_id",
  })))?.[0];
  if (!row || String(row.family_id) !== context.familyId) throw u.safeNotFound();
  return row;
}

module.exports = async function handler(request, response) {
  if (!["POST", "PATCH", "DELETE"].includes(request.method)) return u.allow(response, ["POST", "PATCH", "DELETE"]);
  try {
    const context = await u.authenticateActiveMember(request, { requiredRole: "parent" });
    const body = await u.readJson(request);
    if (request.method === "POST") {
      const product = { ...payload(body), family_id: context.familyId };
      const rows = await u.supabaseFetch("reward_products", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(product),
      });
      return u.json(response, 201, { product: u.productSafe(rows[0]) });
    }

    const existing = await scopedProduct(context, body.id);
    const path = `reward_products?id=eq.${encodeURIComponent(existing.id)}&family_id=eq.${encodeURIComponent(context.familyId)}`;
    if (request.method === "DELETE") {
      const rows = await u.supabaseFetch(path, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ is_active: false, updated_at: new Date().toISOString() }),
      });
      if (!rows?.[0]) throw u.safeNotFound();
      return u.json(response, 200, { ok: true });
    }
    const rows = await u.supabaseFetch(path, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(payload(body)),
    });
    if (!rows?.[0]) throw u.safeNotFound();
    return u.json(response, 200, { product: u.productSafe(rows[0]) });
  } catch (error) {
    const failure = u.publicRouteError(error, "Unable to save product.", "REWARD_PRODUCT_FAILED");
    return u.json(response, failure.status, failure.body);
  }
};
