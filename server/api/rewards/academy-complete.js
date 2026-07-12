const u=require("./_utils");
function seoulDate(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}

module.exports=async function handler(req,res){
 if(!["GET","POST"].includes(req.method))return u.allow(res,["GET","POST"]);
 try{
  const c=u.authenticate(req);
  if(req.method==="GET"){
   const rows=await u.supabaseFetch(`academy_completion_history?select=id,academy_schedule_id,completed_date,star_count,created_at&family_id=eq.${c.family}&member_id=eq.${c.sub}&order=completed_date.desc,created_at.desc`);
   return u.json(res,200,{completions:rows||[]});
  }
  const member=await u.memberInFamily(c.sub,c.family);if(member?.role!=="child"||member.is_active===false)throw u.err("Child permission is required.",403,"CHILD_PERMISSION_REQUIRED");
  const body=await u.readJson(req);
  if(!/^[0-9a-f-]{36}$/i.test(body.scheduleId||""))throw u.err("Invalid academy completion.");
  const rows=await u.supabaseFetch("rpc/complete_academy_schedule",{method:"POST",body:JSON.stringify({p_family_id:c.family,p_member_id:c.sub,p_schedule_id:body.scheduleId,p_completed_date:seoulDate()})});
  const row=rows?.[0]||rows,starCount=Number(row?.star_count),completion=row?{id:row.id,academy_schedule_id:row.academy_schedule_id,completed_date:row.completed_date,star_count:Number.isFinite(starCount)&&starCount>=0?starCount:1,created_at:row.created_at}:null;
  if(!completion?.id)throw u.err("Unable to complete academy schedule.",409);
  const transactions=await u.supabaseFetch(`sticker_transactions?select=amount&family_id=eq.${c.family}&member_id=eq.${c.sub}`);
  return u.json(res,200,{completion,stickerCount:completion.star_count,balance:(transactions||[]).reduce((sum,item)=>sum+Number(item.amount||0),0)});
 }catch(e){
  console.error("[academy completion] failed",{message:e.supabaseMessage||e.message,code:e.supabaseCode||e.code||null,details:e.supabaseDetails||null});
  return u.json(res,e.statusCode||500,{error:e.supabaseMessage||e.message||"Academy completion failed.",code:e.supabaseCode||e.code||null});
 }
};
