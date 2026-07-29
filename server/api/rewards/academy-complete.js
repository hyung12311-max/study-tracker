const u=require("./_utils");
function seoulDate(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}
async function activeChild(claims){
 const member=await u.memberInFamily(claims.sub,claims.family);
 if(claims.role!=="child"||!member||member.family_id!==claims.family||member.role!=="child"||member.is_active!==true)throw u.err("Child permission is required.",403,"CHILD_PERMISSION_REQUIRED");
 return member;
}

module.exports=async function handler(req,res){
 if(!["GET","POST"].includes(req.method))return u.allow(res,["GET","POST"]);
 try{
  const c=u.authenticate(req);
  const member=await activeChild(c);
  if(req.method==="GET"){
   const rows=await u.supabaseFetch(`academy_completion_history?select=id,academy_schedule_id,completed_date,star_count,created_at&family_id=eq.${c.family}&member_id=eq.${c.sub}&order=completed_date.desc,created_at.desc`);
   return u.json(res,200,{completions:rows||[]});
  }
  const body=await u.readJson(req);
  if(!body||typeof body!=="object"||Array.isArray(body)||Object.keys(body).some((key)=>!["scheduleId","completedDate"].includes(key)))throw u.err("Invalid academy completion.",400,"INVALID_ACADEMY_COMPLETION");
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.scheduleId||""))throw u.err("Invalid academy completion.",400,"INVALID_ACADEMY_COMPLETION");
  const rows=await u.supabaseFetch("rpc/complete_academy_schedule_for_assignee",{method:"POST",body:JSON.stringify({p_family_id:c.family,p_actor_member_id:c.sub,p_assigned_member_id:c.sub,p_schedule_id:body.scheduleId,p_completed_date:seoulDate()})});
  const row=rows?.[0]||rows,starCount=Number(row?.star_count),completion=row?{id:row.id,academy_schedule_id:row.academy_schedule_id,completed_date:row.completed_date,star_count:Number.isFinite(starCount)&&starCount>=0?starCount:1,created_at:row.created_at}:null;
  if(!completion?.id)throw u.err("Unable to complete academy schedule.",409);
  void u.sendTargetedPush({familyId:c.family,target:"parent",title:"🏫 학원 일정 완료",body:`${member.display_name||"자녀"}님이 학원 일정을 완료했습니다.`,tag:`academy-complete-${completion.id}`});
  const transactions=await u.supabaseFetch(`sticker_transactions?select=amount&family_id=eq.${c.family}&member_id=eq.${c.sub}`);
  return u.json(res,200,{completion,stickerCount:completion.star_count,balance:(transactions||[]).reduce((sum,item)=>sum+Number(item.amount||0),0)});
 }catch(e){
  if(e.supabaseCode==="P0002")return u.json(res,404,{error:"Academy schedule was not found.",code:"ACADEMY_SCHEDULE_NOT_FOUND"});
  if(e.supabaseCode==="42501")return u.json(res,403,{error:"Academy schedule access denied.",code:"ACADEMY_ACCESS_DENIED"});
  console.error("[academy completion] failed",{message:e.supabaseMessage||e.message,code:e.supabaseCode||e.code||null,details:e.supabaseDetails||null});
  if(e.statusCode&&!e.supabaseCode)return u.json(res,e.statusCode,{error:e.message||"Academy completion failed.",code:e.code||null});
  return u.json(res,500,{error:"Academy completion failed.",code:"ACADEMY_COMPLETION_FAILED"});
 }
};
