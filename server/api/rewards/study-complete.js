const u=require("./_utils");
function seoulDate(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}
module.exports=async function handler(req,res){
 if(req.method!=="POST")return u.allow(res,["POST"]);
 try{
  const c=u.authenticate(req),body=await u.readJson(req),planId=String(body.planId||"");
  const member=await u.memberInFamily(c.sub,c.family);if(member?.role!=="child"||member.is_active===false)throw u.err("자녀 사용자만 학습을 완료할 수 있습니다.",403,"CHILD_PERMISSION_REQUIRED");
  if(!/^\d+$/.test(planId))throw u.err("학습 계획을 확인할 수 없습니다.",400,"INVALID_PLAN_ID");
  const rows=await u.supabaseFetch("rpc/complete_study_plan_with_reward",{method:"POST",body:JSON.stringify({p_family_id:c.family,p_member_id:c.sub,p_plan_id:planId,p_completed_date:seoulDate()})});
  const row=rows?.[0];if(!row)throw u.err("학습 완료를 처리하지 못했습니다.",409,"COMPLETION_FAILED");
  return u.json(res,200,{ok:true,completion:{plan:row.completed_plan,adjustmentType:row.adjustment_type,rescheduledCount:Number(row.rescheduled_count||0),stickerCount:Number(row.sticker_count||0),rewardType:row.reward_type,rewardReason:row.reward_reason,alreadyCompleted:Boolean(row.already_completed),balance:Number(row.balance||0)}});
 }catch(e){return u.json(res,e.statusCode||500,{ok:false,error:e.statusCode?e.message:"학습 완료를 처리하지 못했습니다.",...(e.code?{code:e.code}:{})})}
};
