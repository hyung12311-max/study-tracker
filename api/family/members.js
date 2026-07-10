const u=require("./_utils");
const ENVIRONMENT_NAMES=["SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY","FAMILY_AUTH_SECRET","SUPABASE_JWT_SECRET"];
function environmentStatus(){return Object.fromEntries(ENVIRONMENT_NAMES.map(name=>[name,Boolean(u.env(name))]));}
function classifyError(error){
 if(error.code==="ENV_MISSING"||error.code==="FAMILY_AUTH_NOT_CONFIGURED")return"ENVIRONMENT_MISSING";
 if(error.code==="SUPABASE_CONNECTION_FAILED")return"SUPABASE_CONNECTION_FAILED";
 if(error.code==="SUPABASE_REQUEST_FAILED"){
  if(["PGRST205","42P01"].includes(error.supabaseCode))return"FAMILY_MEMBERS_TABLE_MISSING";
  if([401,403].includes(error.supabaseStatus))return"SUPABASE_AUTH_FAILED";
  return"SUPABASE_QUERY_FAILED";
 }
 if(error.statusCode===401)return"FAMILY_JWT_INVALID";
 return"FAMILY_MEMBERS_UNEXPECTED_ERROR";
}
module.exports=async function(req,res){
 if(!["GET","PATCH"].includes(req.method))return u.allow(res,["GET","PATCH"]);
 try{
  let claims=null;
  if(req.headers.authorization)claims=u.authenticate(req);
  if(req.method==="PATCH"){
   claims=u.authenticate(req,"parent");const body=await u.readJson(req);
   if(body.familySettings){const s={};if(typeof body.familySettings.chatNotificationsEnabled==="boolean")s.chat_notifications_enabled=body.familySettings.chatNotificationsEnabled;if(typeof body.familySettings.systemNotificationsEnabled==="boolean")s.system_notifications_enabled=body.familySettings.systemNotificationsEnabled;await u.supabaseFetch(`families?id=eq.${claims.family}`,{method:"PATCH",body:JSON.stringify(s)});}else{if(!/^[0-9a-f-]{36}$/i.test(body.memberId||""))throw u.err("memberId is required.");const changes={updated_at:new Date().toISOString()};if(typeof body.isActive==="boolean")changes.is_active=body.isActive;if(typeof body.notificationsEnabled==="boolean")changes.notifications_enabled=body.notificationsEnabled;await u.supabaseFetch(`family_members?id=eq.${body.memberId}&family_id=eq.${claims.family}`,{method:"PATCH",body:JSON.stringify(changes)});}
  }
  const filter=claims?`&family_id=eq.${claims.family}`:"";
  const rows=await u.supabaseFetch(`family_members?select=id,family_id,member_key,display_name,role,avatar_emoji,is_active,notifications_enabled${filter}&order=created_at.asc`);
  let settings=null;if(claims){settings=(await u.supabaseFetch(`families?select=chat_notifications_enabled,system_notifications_enabled&id=eq.${claims.family}&limit=1`))?.[0]||null;if(claims.role==="parent"){const devices=await u.supabaseFetch("push_subscriptions?select=family_member_id&is_active=eq.true&family_member_id=not.is.null");for(const row of rows||[])row.device_count=(devices||[]).filter(d=>d.family_member_id===row.id).length}}
  const members=(rows||[]).filter(row=>claims||row.is_active).map(row=>claims?row:((({family_id,...safe})=>safe)(row)));
  console.info("[family members] query success",{rowCount:Array.isArray(rows)?rows.length:0,activeMemberCount:members.length,authenticated:Boolean(claims)});
  if(!members.length){console.warn("[family members] no active family members found");return u.json(res,200,{members:[],settings,message:"가족 구성원이 없습니다."});}
  return u.json(res,200,{members,settings});
 }catch(e){
  const code=classifyError(e),missing=e.missingEnvironmentVariables||[];
  console.error("[family members] request failed",{code,httpStatus:e.statusCode||500,supabaseStatus:e.supabaseStatus||null,supabaseCode:e.supabaseCode||null,message:e.message,supabaseMessage:e.supabaseMessage||null,cause:e.causeMessage||null,missingEnvironmentVariables:missing,environment:environmentStatus()});
  const status=code==="FAMILY_JWT_INVALID"?401:code==="SUPABASE_CONNECTION_FAILED"?502:500;
  return u.json(res,status,{ok:false,error:code==="ENVIRONMENT_MISSING"?"가족 구성원 API 환경변수가 설정되지 않았습니다.":code==="FAMILY_MEMBERS_TABLE_MISSING"?"가족 구성원 테이블이 준비되지 않았습니다.":code==="SUPABASE_AUTH_FAILED"?"Supabase 서버 인증에 실패했습니다.":code==="SUPABASE_CONNECTION_FAILED"?"Supabase에 연결할 수 없습니다.":"가족 구성원을 조회하지 못했습니다.",code,...(missing.length?{missingEnvironmentVariables:missing}:{})});
 }
};
