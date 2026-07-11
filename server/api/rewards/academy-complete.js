const u=require("./_utils");

module.exports=async function handler(req,res){
 if(!["GET","POST"].includes(req.method))return u.allow(res,["GET","POST"]);
 try{
  const c=u.authenticate(req);
  if(req.method==="GET"){
   const rows=await u.supabaseFetch(`academy_completion_history?select=id,academy_schedule_id,completed_date,star_count,created_at&family_id=eq.${c.family}&member_id=eq.${c.sub}&order=completed_date.desc,created_at.desc`);
   return u.json(res,200,{completions:rows||[]});
  }
  const body=await u.readJson(req);
  if(!/^[0-9a-f-]{36}$/i.test(body.scheduleId||"")||!/^\d{4}-\d{2}-\d{2}$/.test(body.completedDate||""))throw u.err("Invalid academy completion.");
  const rows=await u.supabaseFetch("rpc/complete_academy_schedule",{method:"POST",body:JSON.stringify({p_family_id:c.family,p_member_id:c.sub,p_schedule_id:body.scheduleId,p_completed_date:body.completedDate})});
  const completion=rows?.[0]||rows;
  if(!completion?.id)throw u.err("Unable to complete academy schedule.",409);
  return u.json(res,200,{completion});
 }catch(e){
  console.error("[academy completion] failed",{message:e.supabaseMessage||e.message,code:e.supabaseCode||e.code||null,details:e.supabaseDetails||null});
  return u.json(res,e.statusCode||500,{error:e.supabaseMessage||e.message||"Academy completion failed.",code:e.supabaseCode||e.code||null});
 }
};
