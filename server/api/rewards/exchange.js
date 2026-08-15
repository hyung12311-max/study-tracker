const u = require("./_utils");

function uuid(value) {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);
}

async function availableProduct(context, productId) {
  if (!uuid(productId)) throw u.err("Invalid exchange request.", 400, "REWARD_EXCHANGE_INVALID");
  const product = (await u.supabaseFetch(u.buildFamilyScopedObjectPath(context, {
    table: "reward_products",
    objectId: productId,
    select: "id,family_id,is_active,stock,available_from,available_until",
  })))?.[0];
  if (!product || String(product.family_id) !== context.familyId || product.is_active !== true) throw u.safeNotFound();
  const now = Date.now();
  if ((product.available_from && Date.parse(product.available_from) > now)
    || (product.available_until && Date.parse(product.available_until) < now)) {
    throw u.err("This product is not currently available.", 409, "REWARD_PRODUCT_UNAVAILABLE");
  }
  if (product.stock !== null && Number(product.stock) < 1) {
    throw u.err("This product is out of stock.", 409, "REWARD_PRODUCT_OUT_OF_STOCK");
  }
  return product;
}

async function pendingRequest(context, requestId) {
  if (!uuid(requestId)) throw u.err("Invalid decision.", 400, "REWARD_DECISION_INVALID");
  const row = (await u.supabaseFetch(u.buildFamilyScopedObjectPath(context, {
    table: "reward_exchange_requests",
    objectId: requestId,
    select: "id,family_id,member_id,product_id,status,product_name,product_emoji,sticker_cost,requested_at",
  })))?.[0];
  if (!row || String(row.family_id) !== context.familyId || row.status !== "pending") throw u.safeNotFound();
  return row;
}

module.exports = async function handler(request, response) {
  if (!["POST", "PATCH"].includes(request.method)) return u.allow(response, ["POST", "PATCH"]);
  try {
    const context = await u.authenticateActiveMember(
      request,
      request.method === "PATCH" ? { requiredRole: "parent" } : { allowRoles: ["parent", "child"] }
    );
    const body = await u.readJson(request);

    if (request.method === "POST") {
      if (!/^[a-zA-Z0-9_-]{8,100}$/.test(body.clientRequestId || "")) {
        throw u.err("Invalid exchange request.", 400, "REWARD_EXCHANGE_INVALID");
      }
      let memberId;
      if (context.role === "parent") {
        if (!uuid(body.memberId)) throw u.err("Child member is required.", 400, "REWARD_CHILD_REQUIRED");
        memberId = (await u.resolveActiveFamilyChild(context, body.memberId)).id;
      } else {
        memberId = u.childSelfScope(context, body.memberId === undefined ? undefined : body.memberId);
      }
      await availableProduct(context, body.productId);
      const rows = await u.supabaseFetch("rpc/create_reward_exchange_request_v2", {
        method: "POST",
        body: JSON.stringify({
          p_family_id: context.familyId,
          p_actor_member_id: context.memberId,
          p_target_member_id: memberId,
          p_product_id: body.productId,
          p_client_request_id: body.clientRequestId,
        }),
      });
      const created = rows?.[0] || rows;
      if (!created?.id) throw u.err("Unable to create exchange request.", 409, "REWARD_EXCHANGE_NOT_CREATED");
      const member = memberId === context.memberId ? context.member : await u.memberInFamily(memberId, context.familyId);
      const who = member?.display_name || "아이";
      const icon = created.product_emoji || "🎁";
      await u.insertSystemMessage(context.familyId, "reward_exchange_requested", created.id, `${who}가 ${icon} ${created.product_name} 교환을 신청했습니다.`);
      void u.sendTargetedPush({
        familyId: context.familyId,
        target: "parent",
        title: "🎁 보상 교환 신청",
        body: `${who}가 ${created.product_name}를 신청했습니다.`,
        tag: `reward-request-${created.id}`,
      });
      return u.json(response, 201, { request: u.requestSafe({ ...created, family_members: member }) });
    }

    if (!["approve", "reject"].includes(body.action)) throw u.err("Invalid decision.", 400, "REWARD_DECISION_INVALID");
    const existing = await pendingRequest(context, body.requestId);
    let decided;
    if (body.action === "approve") {
      const rows = await u.supabaseFetch("rpc/approve_reward_exchange", {
        method: "POST",
        body: JSON.stringify({ p_request_id: existing.id, p_parent_id: context.memberId, p_family_id: context.familyId }),
      });
      decided = rows?.[0] || rows;
    } else {
      const rows = await u.supabaseFetch(
        `reward_exchange_requests?id=eq.${encodeURIComponent(existing.id)}&family_id=eq.${encodeURIComponent(context.familyId)}&status=eq.pending`,
        {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            status: "rejected",
            decided_at: new Date().toISOString(),
            decided_by: context.memberId,
            rejection_reason: String(body.reason || "").slice(0, 200),
            updated_at: new Date().toISOString(),
          }),
        }
      );
      decided = rows?.[0];
    }
    if (!decided) throw u.safeNotFound();
    const member = await u.memberInFamily(existing.member_id, context.familyId);
    const result = { ...existing, ...decided };
    const icon = result.product_emoji || "🎁";
    if (body.action === "approve") {
      await u.insertSystemMessage(context.familyId, "reward_achieved", result.id, `${member?.display_name || "아이"}의 ${icon} ${result.product_name} 교환이 완료되었습니다.`);
      void u.sendTargetedPush({ familyId: context.familyId, target: "member", memberId: existing.member_id, title: "🎁 교환 승인", body: `${result.product_name} 교환이 승인되었습니다.`, tag: `reward-approved-${result.id}` });
    } else {
      void u.sendTargetedPush({ familyId: context.familyId, target: "member", memberId: existing.member_id, title: "보상 교환 안내", body: `${result.product_name} 교환 신청이 거절되었습니다.`, tag: `reward-rejected-${result.id}` });
    }
    return u.json(response, 200, { request: u.requestSafe({ ...result, family_members: member }) });
  } catch (error) {
    let failure = u.publicRouteError(error, "Reward exchange failed.", "REWARD_EXCHANGE_FAILED");
    if (failure.status === 500 && error.supabaseCode && /insufficient/i.test(error.supabaseMessage || "")) {
      failure = { status: 409, body: { ok: false, error: "사용 가능한 스티커가 부족합니다.", code: "REWARD_BALANCE_INSUFFICIENT" } };
    }
    return u.json(response, failure.status, failure.body);
  }
};
