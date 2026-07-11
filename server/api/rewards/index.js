const u=require("./_utils");
module.exports=async function handler(req,res){if(req.method!=="GET")return u.allow(res,["GET"]);try{const c=u.authenticate(req),url=new URL(req.url,"http://localhost"),requestedMember=url.searchParams.get("memberId");let memberId=c.sub;if(requestedMember&&c.role==="parent"){const member=await u.memberInFamily(requestedMember,c.family);if(!member)throw u.err("Member not found.",404);memberId=member.id}
 const [products,transactions,balanceRows,requests,history,wishlist,members]=await Promise.all([
  u.supabaseFetch(`reward_products?select=*&family_id=eq.${c.family}${c.role==="parent"?"":"&is_active=eq.true"}&order=sort_order.asc,name.asc`),
  u.supabaseFetch(`sticker_transactions?select=id,amount,transaction_type,source_type,source_id,description,created_at&member_id=eq.${memberId}&order=created_at.desc&limit=50`),
  u.supabaseFetch(`sticker_transactions?select=amount&member_id=eq.${memberId}`),
  u.supabaseFetch(`reward_exchange_requests?select=*,family_members!reward_exchange_requests_member_id_fkey(display_name,avatar_emoji)&family_id=eq.${c.family}${c.role==="parent"?"":`&member_id=eq.${c.sub}`}&order=requested_at.desc&limit=100`),
  u.supabaseFetch(`reward_exchange_history?select=*&family_id=eq.${c.family}${c.role==="parent"?"":`&member_id=eq.${c.sub}`}&order=completed_at.desc&limit=100`).catch(error=>{if(error.supabaseCode==="PGRST205"){console.warn("[reward store] exchange history unavailable",{code:error.supabaseCode,message:error.supabaseMessage});return[]}throw error}),
  u.supabaseFetch(`reward_wishlist?select=product_id&member_id=eq.${memberId}`),
  c.role==="parent"?u.supabaseFetch(`family_members?select=id,display_name,avatar_emoji,role,is_active&family_id=eq.${c.family}&order=created_at.asc`):Promise.resolve([])
 ]);
 const balance=(balanceRows||[]).reduce((sum,row)=>sum+Number(row.amount||0),0),reserved=(requests||[]).filter(row=>row.member_id===memberId&&row.status==="pending").reduce((sum,row)=>sum+Number(row.sticker_cost||0),0);
 return u.json(res,200,{balance,availableBalance:Math.max(balance-reserved,0),products:(products||[]).map(u.productSafe),transactions:transactions||[],requests:(requests||[]).map(u.requestSafe),history:history||[],wishlist:(wishlist||[]).map(row=>row.product_id),members:members||[],viewer:{id:c.sub,role:c.role,walletMemberId:memberId}});
 }catch(e){console.error(e);console.error(e.supabaseMessage||e.message);console.error(e.supabaseDetails||e.details||null);console.error(e.supabaseCode||e.code||null);return u.json(res,e.statusCode||500,{error:e.supabaseMessage||e.message||"Unable to load reward store.",code:e.supabaseCode||e.code||null,details:e.supabaseDetails||e.details||null,hint:e.supabaseHint||e.hint||null})}};
