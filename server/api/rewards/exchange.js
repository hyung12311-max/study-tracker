const u = require("./_utils");

module.exports = async function handler(req, res) {
  if (!["POST", "PATCH"].includes(req.method)) return u.allow(res, ["POST", "PATCH"]);
  let rpcPayload = null;
  try {
    const c = u.authenticate(req);
    const body = await u.readJson(req);

    if (req.method === "POST") {
      if (!/^[0-9a-f-]{36}$/i.test(body.productId || "") || !/^[a-zA-Z0-9_-]{8,100}$/.test(body.clientRequestId || "")) {
        throw u.err("Invalid exchange request.");
      }
      let memberId = c.sub;
      if (c.role === "parent") {
        if (!/^[0-9a-f-]{36}$/i.test(body.memberId || "")) throw u.err("Child member is required.");
        const walletMember = await u.memberInFamily(body.memberId, c.family);
        if (!walletMember || walletMember.role !== "child" || !walletMember.is_active) {
          throw u.err("Active child member not found.", 404);
        }
        memberId = walletMember.id;
      } else if (body.memberId && body.memberId !== c.sub) {
        throw u.err("Another member exchange is not allowed.", 403);
      }
      rpcPayload = {
        p_family_id: c.family,
        p_member_id: memberId,
        p_product_id: body.productId,
        p_client_request_id: body.clientRequestId,
      };
      console.log("[reward exchange] create RPC", rpcPayload);
      const rows = await u.supabaseFetch("rpc/create_reward_exchange_request", {
        method: "POST",
        body: JSON.stringify(rpcPayload),
      });
      const request = rows?.[0] || rows;
      const member = await u.memberInFamily(memberId, c.family);
      if (!request?.id) throw u.err("Unable to create exchange request.", 409);
      const who = member?.display_name || "아이";
      const icon = request.product_emoji || "🎁";
      await u.insertSystemMessage(c.family, "reward_exchange_requested", request.id, `${who}가 ${icon} ${request.product_name} 교환을 신청했습니다.`);
      void u.sendTargetedPush({
        familyId: c.family,
        target: "parent",
        title: "🎁 보상 교환 신청",
        body: `${who}가 ${request.product_name}를 신청했습니다.`,
        tag: `reward-request-${request.id}`,
      });
      return u.json(res, 201, { request: u.requestSafe({ ...request, family_members: member }) });
    }

    u.authenticate(req, "parent");
    if (!/^[0-9a-f-]{36}$/i.test(body.requestId || "") || !["approve", "reject"].includes(body.action)) {
      throw u.err("Invalid decision.");
    }
    let decided;
    if (body.action === "approve") {
      const rows = await u.supabaseFetch("rpc/approve_reward_exchange", {
        method: "POST",
        body: JSON.stringify({ p_request_id: body.requestId, p_parent_id: c.sub, p_family_id: c.family }),
      });
      decided = rows?.[0] || rows;
    } else {
      const rows = await u.supabaseFetch(`reward_exchange_requests?id=eq.${body.requestId}&family_id=eq.${c.family}&status=eq.pending`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          status: "rejected",
          decided_at: new Date().toISOString(),
          decided_by: c.sub,
          rejection_reason: String(body.reason || "").slice(0, 200),
          updated_at: new Date().toISOString(),
        }),
      });
      decided = rows?.[0];
    }
    if (!decided) throw u.err("Pending request not found.", 409);
    const member = await u.memberInFamily(decided.member_id, c.family);
    const icon = decided.product_emoji || "🎁";
    if (body.action === "approve") {
      await u.insertSystemMessage(c.family, "reward_achieved", decided.id, `${member?.display_name || "아이"}의 ${icon} ${decided.product_name} 교환이 완료되었습니다.`);
      void u.sendTargetedPush({
        familyId: c.family,
        target: "member",
        memberId: decided.member_id,
        title: "🎁 교환 승인",
        body: `${decided.product_name} 교환이 승인되었습니다.`,
        tag: `reward-approved-${decided.id}`,
      });
    } else {
      void u.sendTargetedPush({
        familyId: c.family,
        target: "member",
        memberId: decided.member_id,
        title: "보상 교환 안내",
        body: `${decided.product_name} 교환 신청이 거절되었습니다.`,
        tag: `reward-rejected-${decided.id}`,
      });
    }
    return u.json(res, 200, { request: u.requestSafe({ ...decided, family_members: member }) });
  } catch (e) {
    const message = String(e.message || "");
    const friendly = message.includes("insufficient")
      ? "사용 가능한 스티커가 부족합니다."
      : message.includes("out of stock")
        ? "상품 재고가 없습니다."
        : message.includes("unavailable")
          ? "현재 교환할 수 없는 상품입니다."
          : e.statusCode ? e.message : "Reward exchange failed.";
    const actualMessage = e.supabaseMessage || e.message || friendly;
    const details = e.supabaseDetails || e.details || null;
    const code = e.supabaseCode || e.code || null;
    const hint = e.supabaseHint || e.hint || null;
    console.error(e);
    console.error(actualMessage);
    console.error(details);
    console.error(code);
    console.error(hint);
    console.error("[reward exchange] RPC payload", rpcPayload);
    return u.json(res, e.statusCode || 400, { error: actualMessage, message: actualMessage, code, details, hint });
  }
};
