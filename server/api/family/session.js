const u=require("./_utils");
function memberSafe(m){return{id:m.id,family_id:m.family_id,member_key:m.member_key,display_name:m.display_name,role:m.role,avatar_emoji:m.avatar_emoji}}
module.exports=async function(req,res){
 if(req.method!=="GET")return u.allow(res,["GET"]);
 try{
  const token=u.cookieToken(req);if(!token)throw u.err("No saved device session.",401,"DEVICE_SESSION_MISSING");
  const session=(await u.supabaseFetch(`family_device_sessions?select=id,family_id,member_id,expires_at,revoked_at&token_hash=eq.${u.tokenHash(token)}&limit=1`))?.[0];
  if(session&&!session.revoked_at&&new Date(session.expires_at)<=new Date())await u.supabaseFetch(`family_device_sessions?id=eq.${session.id}`,{method:"PATCH",body:JSON.stringify({revoked_at:new Date().toISOString(),revoked_reason:"expired"})});
  if(!session||session.revoked_at||new Date(session.expires_at)<=new Date()){u.clearDeviceCookie(req,res);throw u.err("Saved device session is invalid or expired.",401,"DEVICE_SESSION_INVALID")}
  const member=(await u.supabaseFetch(`family_members?select=id,family_id,member_key,display_name,role,avatar_emoji,is_active&id=eq.${session.member_id}&family_id=eq.${session.family_id}&role=eq.parent&is_active=eq.true&limit=1`))?.[0];
  if(!member){u.clearDeviceCookie(req,res);throw u.err("Parent account is unavailable.",401,"DEVICE_MEMBER_INVALID")}
  await u.supabaseFetch(`family_device_sessions?id=eq.${session.id}`,{method:"PATCH",body:JSON.stringify({last_used_at:new Date().toISOString()})});
  return u.json(res,200,{ok:true,token:u.signToken(member),realtimeToken:u.signRealtimeToken(member),expiresIn:28800,expires_at:session.expires_at,rememberDevice:true,member:memberSafe(member)});
 }catch(e){return u.json(res,e.statusCode||500,{ok:false,error:e.statusCode?e.message:"Unable to restore device session.",...(e.code?{code:e.code}:{})})}
};
