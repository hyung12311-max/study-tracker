const u=require("./_utils");
function seoulDate(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}
module.exports=async function handler(req,res){
 if(!["GET","POST"].includes(req.method))return u.allow(res,["GET","POST"]);
 try{
  const context=await u.authenticateActiveMember(req,{requiredRole:"child"});
  const member=context.member;
  if(req.method==="GET"){
   const rows=await u.supabaseFetch(`academy_completion_history?select=id,academy_schedule_id,completed_date,star_count,created_at&family_id=eq.${encodeURIComponent(context.familyId)}&member_id=eq.${encodeURIComponent(context.memberId)}&order=completed_date.desc,created_at.desc`);
   return u.json(res,200,{completions:rows||[]});
  }
  const body=await u.readJson(req);
  if(!body||typeof body!=="object"||Array.isArray(body)||Object.keys(body).some((key)=>!["scheduleId","completedDate"].includes(key)))throw u.err("Invalid academy completion.",400,"INVALID_ACADEMY_COMPLETION");
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.scheduleId||""))throw u.err("Invalid academy completion.",400,"INVALID_ACADEMY_COMPLETION");
  const rows=await u.supabaseFetch("rpc/complete_academy_schedule_for_assignee",{method:"POST",body:JSON.stringify({p_family_id:context.familyId,p_actor_member_id:context.memberId,p_assigned_member_id:context.memberId,p_schedule_id:body.scheduleId,p_completed_date:seoulDate()})});
  const row=rows?.[0]||rows,starCount=Number(row?.star_count),completion=row?{id:row.id,academy_schedule_id:row.academy_schedule_id,completed_date:row.completed_date,star_count:Number.isFinite(starCount)&&starCount>=0?starCount:1,created_at:row.created_at}:null;
  if(!completion?.id)throw u.err("Unable to complete academy schedule.",409);
  void u.sendTargetedPush({familyId:context.familyId,target:"parent",title:"🏫 학원 일정 완료",body:`${member.display_name||"자녀"}님이 학원 일정을 완료했습니다.`,tag:`academy-complete-${completion.id}`});
  const transactions=await u.supabaseFetch(`sticker_transactions?select=amount&family_id=eq.${encodeURIComponent(context.familyId)}&member_id=eq.${encodeURIComponent(context.memberId)}`);
  return u.json(res,200,{completion,stickerCount:completion.star_count,balance:(transactions||[]).reduce((sum,item)=>sum+Number(item.amount||0),0)});
 }catch(e){
  if(e.supabaseCode==="P0002")return u.json(res,404,{error:"Academy schedule was not found.",code:"ACADEMY_SCHEDULE_NOT_FOUND"});
  if(e.supabaseCode==="42501")return u.json(res,403,{error:"Academy schedule access denied.",code:"ACADEMY_ACCESS_DENIED"});
  console.error("[academy completion] failed",{message:e.supabaseMessage||e.message,code:e.supabaseCode||e.code||null,details:e.supabaseDetails||null});
  const failure=u.publicRouteError(e,"Academy completion failed.","ACADEMY_COMPLETION_FAILED");
  return u.json(res,failure.status,failure.body);
 }
};
