const u = require("./_utils");

module.exports = async function handler(request, response) {
  if (request.method !== "GET") return u.allow(response, ["GET"]);
  try {
    const context = await u.authenticateActiveMember(request, { allowRoles: ["parent", "child"] });
    const url = new URL(request.url, "http://localhost");
    const requestedMember = url.searchParams.get("memberId");
    let memberId;
    let walletMemberName = "";
    let walletMemberKey = context.memberKey;
    let members = [];

    if (context.role === "parent") {
      members = await u.supabaseFetch(
        `family_members?select=id,member_key,display_name,avatar_emoji,role,is_active&family_id=eq.${encodeURIComponent(context.familyId)}&order=created_at.asc`
      );
      const children = (members || []).filter((member) => member.role === "child" && member.is_active === true);
      const walletMember = requestedMember
        ? await u.resolveActiveFamilyChild(context, requestedMember)
        : children.find((member) => member.member_key === "hagyeom") || children[0];
      if (!walletMember) throw u.safeNotFound("FAMILY_CHILD_NOT_FOUND");
      memberId = walletMember.id;
      walletMemberName = walletMember.display_name || "";
      walletMemberKey = walletMember.member_key;
    } else {
      memberId = u.childSelfScope(context, requestedMember || undefined);
      walletMemberName = context.member.display_name || "";
    }

    const familyId = encodeURIComponent(context.familyId);
    const scopedMemberId = encodeURIComponent(memberId);
    const [products, transactions, balanceRows, requests, history, wishlist, stickerHistory] = await Promise.all([
      u.supabaseFetch(`reward_products?select=*&family_id=eq.${familyId}${context.role === "parent" ? "" : "&is_active=eq.true"}&order=sort_order.asc,name.asc`),
      u.supabaseFetch(`sticker_transactions?select=id,amount,transaction_type,source_type,source_id,description,created_at&family_id=eq.${familyId}&member_id=eq.${scopedMemberId}&order=created_at.desc&limit=50`),
      u.supabaseFetch(`sticker_transactions?select=amount&family_id=eq.${familyId}&member_id=eq.${scopedMemberId}`),
      u.supabaseFetch(`reward_exchange_requests?select=*,family_members!reward_exchange_requests_member_id_fkey(display_name,avatar_emoji)&family_id=eq.${familyId}${context.role === "parent" ? "" : `&member_id=eq.${scopedMemberId}`}&order=requested_at.desc&limit=100`),
      u.supabaseFetch(`reward_exchange_history?select=*&family_id=eq.${familyId}${context.role === "parent" ? "" : `&member_id=eq.${scopedMemberId}`}&order=completed_at.desc&limit=100`).catch((error) => {
        if (error.supabaseCode === "PGRST205") return [];
        throw error;
      }),
      u.supabaseFetch(`reward_wishlist?select=product_id&family_id=eq.${familyId}&member_id=eq.${scopedMemberId}`),
      u.supabaseFetch(`sticker_history?select=id,study_plan_id,sticker_count,reward_type,reward_reason,created_at&family_id=eq.${familyId}&member_id=eq.${scopedMemberId}&order=created_at.desc`),
    ]);
    const balance = (balanceRows || []).reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const reserved = (requests || [])
      .filter((row) => row.member_id === memberId && row.status === "pending")
      .reduce((sum, row) => sum + Number(row.sticker_cost || 0), 0);
    return u.json(response, 200, {
      balance,
      availableBalance: Math.max(balance - reserved, 0),
      products: (products || []).map(u.productSafe),
      transactions: transactions || [],
      requests: (requests || []).map(u.requestSafe),
      history: history || [],
      stickerHistory: stickerHistory || [],
      stickerHistoryCount: (stickerHistory || []).length,
      wishlist: (wishlist || []).map((row) => row.product_id),
      members: members || [],
      viewer: {
        id: context.memberId,
        memberKey: context.memberKey,
        role: context.role,
        walletMemberId: memberId,
        walletMemberName,
        walletMemberKey,
      },
    });
  } catch (error) {
    const failure = u.publicRouteError(error, "Unable to load reward store.", "REWARD_STORE_FAILED");
    return u.json(response, failure.status, failure.body);
  }
};
