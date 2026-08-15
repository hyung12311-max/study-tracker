const u=require("./_utils");
const authorization=require("../_authorization");
module.exports=async function(req,res){
 if(!["GET","POST"].includes(req.method))return u.allow(res,["GET","POST"]);
 try{
  const context=await authorization.authenticateActiveMember(req,{allowRoles:["parent","child"]});
  if(req.method==="GET"){
   const url=new URL(req.url,"http://localhost"),messages=await u.fetchMessages(context.familyId,url.searchParams.get("before"),url.searchParams.get("limit"));
   const rows=await u.supabaseFetch(`family_messages?select=id,sender_id,family_message_reads!family_message_reads_message_scope_fk(member_id)&family_id=eq.${encodeURIComponent(context.familyId)}&deleted_at=is.null&or=(sender_id.is.null,sender_id.neq.${encodeURIComponent(context.memberId)})`);
   const unread=(rows||[]).filter(row=>!(row.family_message_reads||[]).some(read=>String(read.member_id)===context.memberId)).length;
   return u.json(res,200,{messages,unread});
  }
  const body=await u.readJson(req);
  if(body.messageType==="system"){
   if(body.relatedType!=="study_complete"||!body.relatedId)throw u.err("Invalid system message.");
   const sender=context.member;
   if(context.role!=="child")throw u.err("Active child member is required.",403,"AUTH_ROLE_REQUIRED");
   const plan=(await u.supabaseFetch(`study_plans?select=id,subject,workbook,status&id=eq.${encodeURIComponent(body.relatedId)}&family_id=eq.${encodeURIComponent(context.familyId)}&assigned_member_id=eq.${encodeURIComponent(context.memberId)}&limit=1`))?.[0];
   if(!plan||!["done","완료"].includes(plan.status))throw u.err("Completed study record was not found.",409);
   const reward=(await u.supabaseFetch(`sticker_history?select=sticker_count&family_id=eq.${encodeURIComponent(context.familyId)}&member_id=eq.${encodeURIComponent(context.memberId)}&study_plan_id=eq.${encodeURIComponent(plan.id)}&limit=1`))?.[0],awardedStickerCount=Number(reward?.sticker_count||0);
   const content=`${sender.display_name||"자녀"}님이 ${plan.subject}${plan.workbook?` · ${plan.workbook}`:""} 학습을 완료했습니다. ${awardedStickerCount>0?`스티커 ${awardedStickerCount}개를 받았어요.`:"지급된 스티커는 없어요."} ⭐`;
   const inserted=await u.supabaseFetch("family_messages?on_conflict=family_id,related_type,related_id",{method:"POST",headers:{Prefer:"resolution=ignore-duplicates,return=representation"},body:JSON.stringify({family_id:context.familyId,sender_id:null,message_type:"system",content,related_type:"study_complete",related_id:String(plan.id)})});
   const row=inserted?.[0];return u.json(res,200,{ok:true,created:Boolean(row),message:row?u.safe(row):null});
  }
  const content=String(body.content||"").trim();
  if(!content||content.length>1000)throw u.err("Message must contain 1 to 1000 characters.");if(!/^[a-zA-Z0-9_-]{8,100}$/.test(body.clientMessageId||""))throw u.err("Invalid client message ID.");
  const sender=context.member;
  const inserted=await u.supabaseFetch("family_messages?on_conflict=family_id,client_message_id",{method:"POST",headers:{Prefer:"resolution=ignore-duplicates,return=representation"},body:JSON.stringify({family_id:context.familyId,sender_id:context.memberId,content,client_message_id:body.clientMessageId})});
  const created=Boolean(inserted?.[0]);let row=inserted?.[0];if(!row)row=(await u.supabaseFetch(`family_messages?select=*&family_id=eq.${encodeURIComponent(context.familyId)}&client_message_id=eq.${encodeURIComponent(body.clientMessageId)}&limit=1`))?.[0];if(!row)throw u.err("Message was not saved.",500);const message=u.safe({...row,sender_name:sender.display_name,sender_avatar:sender.avatar_emoji});if(created)void u.sendPush(row,{...sender,id:context.memberId});return u.json(res,200,{ok:true,message});
 }catch(e){const safe=authorization.publicAuthorizationError(e);if(safe.status!==500)return u.json(res,safe.status,safe.body);const controlled=Boolean(e.statusCode&&e.statusCode<500&&!e.supabaseCode&&!String(e.code||"").startsWith("SUPABASE_"));return u.json(res,controlled?e.statusCode:500,{error:controlled?e.message:"Family message request failed.",...(controlled&&e.code?{code:e.code}:{})})}
};
