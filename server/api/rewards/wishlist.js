const u = require("./_utils");

module.exports = async function handler(request, response) {
  if (request.method !== "POST") return u.allow(response, ["POST"]);
  try {
    const context = await u.authenticateActiveMember(request, { allowRoles: ["parent", "child"] });
    const body = await u.readJson(request);
    if (!/^[0-9a-f-]{36}$/i.test(body.productId || "")) throw u.err("Product id is required.", 400, "REWARD_PRODUCT_ID_INVALID");
    const product = (await u.supabaseFetch(u.buildFamilyScopedObjectPath(context, {
      table: "reward_products",
      objectId: body.productId,
      select: "id,family_id",
    })))?.[0];
    if (!product || String(product.family_id) !== context.familyId) throw u.safeNotFound();
    const familyId = encodeURIComponent(context.familyId);
    const memberId = encodeURIComponent(context.memberId);
    const productId = encodeURIComponent(product.id);
    const existing = (await u.supabaseFetch(
      `reward_wishlist?select=id,family_id,member_id,product_id&family_id=eq.${familyId}&member_id=eq.${memberId}&product_id=eq.${productId}&limit=1`
    ))?.[0];
    if (existing) {
      await u.supabaseFetch(
        `reward_wishlist?id=eq.${encodeURIComponent(existing.id)}&family_id=eq.${familyId}&member_id=eq.${memberId}&product_id=eq.${productId}`,
        { method: "DELETE" }
      );
    } else {
      await u.supabaseFetch("reward_wishlist", {
        method: "POST",
        body: JSON.stringify({ family_id: context.familyId, member_id: context.memberId, product_id: product.id }),
      });
    }
    return u.json(response, 200, { ok: true, wished: !existing });
  } catch (error) {
    const failure = u.publicRouteError(error, "Unable to update wishlist.", "REWARD_WISHLIST_FAILED");
    return u.json(response, failure.status, failure.body);
  }
};
