const u=require("./_utils");
module.exports=async function(req,res){
 if(!["GET","POST"].includes(req.method))return u.allow(res,["GET","POST"]);
 try{
  const claims=req.method==="GET"||req.headers.authorization?u.authenticate(req):null;
  if(req.method==="GET"){
   const url=new URL(req.url,"http://localhost"),messages=await u.fetchMessages(claims.family,url.searchParams.get("before"),url.searchParams.get("limit"));
   const rows=await u.supabaseFetch(`family_messages?select=id,sender_id,family_message_reads!left(member_id)&family_id=eq.${claims.family}&deleted_at=is.null&or=(sender_id.is.null,sender_id.neq.${claims.sub})`);
   const unread=(rows||[]).filter(row=>!(row.family_message_reads||[]).some(read=>read.member_id===claims.sub)).length;
   return u.json(res,200,{messages,unread});
  }
  const body=await u.readJson(req);
  if(body.messageType==="system"){
   if(body.relatedType!=="study_complete"||!body.relatedId)throw u.err("Invalid system message.");
   const plan=(await u.supabaseFetch(`study_plans?select=id,subject,workbook,status&id=eq.${encodeURIComponent(body.relatedId)}&limit=1`))?.[0];
   if(!plan||!["done","완료"].includes(plan.status))throw u.err("Completed study record was not found.",409);
   const family=(await u.supabaseFetch("families?select=id&family_key=eq.default&limit=1"))?.[0];if(!family)throw u.err("Family is not configured.",500);
   const reward=(await u.supabaseFetch(`sticker_history?select=sticker_count&family_id=eq.${family.id}&study_plan_id=eq.${encodeURIComponent(plan.id)}&limit=1`))?.[0],awardedStickerCount=Number(reward?.sticker_count||0);
   const content=`하겸이가 ${plan.subject}${plan.workbook?` · ${plan.workbook}`:""} 학습을 완료했습니다. ${awardedStickerCount>0?`스티커 ${awardedStickerCount}개를 받았어요.`:"지급된 스티커는 없어요."} ⭐`;
   const inserted=await u.supabaseFetch("family_messages?on_conflict=family_id,related_type,related_id",{method:"POST",headers:{Prefer:"resolution=ignore-duplicates,return=representation"},body:JSON.stringify({family_id:family.id,sender_id:null,message_type:"system",content,related_type:"study_complete",related_id:String(plan.id)})});
   const row=inserted?.[0];return u.json(res,200,{ok:true,created:Boolean(row),message:row?u.safe(row):null});
  }
  if(!claims)throw u.err("Authentication is required.",401);const content=String(body.content||"").trim();
  if(!content||content.length>1000)throw u.err("Message must contain 1 to 1000 characters.");if(!/^[a-zA-Z0-9_-]{8,100}$/.test(body.clientMessageId||""))throw u.err("Invalid client message ID.");
  const sender=(await u.supabaseFetch(`family_members?select=id,member_key,display_name,avatar_emoji,is_active&family_id=eq.${claims.family}&id=eq.${claims.sub}&limit=1`))?.[0];if(!sender?.is_active)throw u.err("Member is not active.",403);
  const inserted=await u.supabaseFetch("family_messages?on_conflict=client_message_id",{method:"POST",headers:{Prefer:"resolution=ignore-duplicates,return=representation"},body:JSON.stringify({family_id:claims.family,sender_id:claims.sub,content,client_message_id:body.clientMessageId})});
  const created=Boolean(inserted?.[0]);let row=inserted?.[0];if(!row)row=(await u.supabaseFetch(`family_messages?select=*&client_message_id=eq.${encodeURIComponent(body.clientMessageId)}&limit=1`))?.[0];const message=u.safe({...row,sender_name:sender.display_name,sender_avatar:sender.avatar_emoji});if(created)void u.sendPush(row,{...sender,id:claims.sub});return u.json(res,200,{ok:true,message});
 }catch(e){return u.json(res,e.statusCode||500,{error:e.statusCode?e.message:"Family message request failed."})}
};
