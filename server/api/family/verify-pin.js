const u=require("./_utils");
module.exports=async function(req,res){
 if(req.method!=="POST")return u.allow(res,["POST"]);
 try{const body=await u.readJson(req);if(!/^[a-z0-9_-]{2,40}$/.test(body.memberKey||"")||!/^\d{4}$/.test(body.pin||""))throw u.err("Select a member and enter a 4-digit PIN.");
  const rows=await u.supabaseFetch("rpc/verify_family_member_pin",{method:"POST",body:JSON.stringify({p_member_key:body.memberKey,p_pin:body.pin})});const m=rows?.[0];
  if(!m)throw u.err("Member is not available.",404);if(!m.verified){if(m.locked_until&&new Date(m.locked_until)>new Date())return u.json(res,423,{error:"Too many attempts. Try again in 30 seconds.",lockedUntil:m.locked_until});throw u.err("The PIN does not match.",401)}
  return u.json(res,200,{token:u.signToken(m),realtimeToken:u.signRealtimeToken(m),expiresIn:28800,member:{id:m.member_id,family_id:m.family_id,member_key:m.member_key,display_name:m.display_name,role:m.role,avatar_emoji:m.avatar_emoji}});
 }catch(e){return u.json(res,e.statusCode||500,{error:e.statusCode?e.message:"PIN verification failed."})}
};
