const u=require("./_utils");
const {performance}=require("node:perf_hooks");
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
 const startedAt=performance.now(),timings={},timed=req.method==="GET";
 // Auth includes trustedFamilyScope; query stages include fetch, body read and parse.
 async function measure(name,run){const start=performance.now();try{return await run()}finally{if(timed)timings[name]=performance.now()-start}}
 function respond(status,body){
  if(timed){
   // Total ends at response assembly, excluding serialization and transport.
   // Parallel stages overlap. On failure, only settled stages are reported.
   timings.total=performance.now()-startedAt;
   try{res.setHeader("Server-Timing",["auth","members","settings","device-count","total"].filter(name=>Number.isFinite(timings[name])).map(name=>`${name};dur=${Math.max(0,timings[name]).toFixed(2)}`).join(", "))}catch{ /* Diagnostics must not prevent the existing response. */ }
  }
  return u.json(res,status,body);
 }
 if(!["GET","PATCH"].includes(req.method))return u.allow(res,["GET","PATCH"]);
 try{
  const scope=await measure("auth",()=>u.trustedFamilyScope(req,res));
  let claims=scope.claims;
  if(req.method==="PATCH"){
   if(claims?.role!=="parent")throw u.err("Parent permission is required.",403);const body=await u.readJson(req);
   if(body.familySettings){const s={};if(typeof body.familySettings.chatNotificationsEnabled==="boolean")s.chat_notifications_enabled=body.familySettings.chatNotificationsEnabled;if(typeof body.familySettings.systemNotificationsEnabled==="boolean")s.system_notifications_enabled=body.familySettings.systemNotificationsEnabled;await u.supabaseFetch(`families?id=eq.${claims.family}`,{method:"PATCH",body:JSON.stringify(s)});}else{if(!/^[0-9a-f-]{36}$/i.test(body.memberId||""))throw u.err("memberId is required.");const changes={updated_at:new Date().toISOString()};if(typeof body.isActive==="boolean")changes.is_active=body.isActive;if(typeof body.notificationsEnabled==="boolean")changes.notifications_enabled=body.notificationsEnabled;await u.supabaseFetch(`family_members?id=eq.${body.memberId}&family_id=eq.${claims.family}`,{method:"PATCH",body:JSON.stringify(changes)});}
  }
  // The trusted scope and any PATCH must complete before these independent reads.
  const [rows,settingRows,devices]=await Promise.all([
   measure("members",()=>u.supabaseFetch(`family_members?select=id,display_name,role,avatar_emoji,is_active,notifications_enabled&family_id=eq.${encodeURIComponent(scope.familyId)}&order=created_at.asc`)),
   claims?measure("settings",()=>u.supabaseFetch(`families?select=chat_notifications_enabled,system_notifications_enabled&id=eq.${claims.family}&limit=1`)):null,
   claims?.role==="parent"?measure("device-count",()=>u.supabaseFetch(`family_push_subscriptions?select=member_id&family_id=eq.${claims.family}&is_active=eq.true&member_id=not.is.null`)):null,
  ]);
  const settings=settingRows?.[0]||null;
  if(claims?.role==="parent")for(const row of rows||[])row.device_count=(devices||[]).filter(d=>d.member_id===row.id).length;
  const members=(rows||[]).filter(row=>claims?.role==="parent"||row.is_active).map(row=>{const safe={id:row.id,display_name:row.display_name,role:row.role,avatar_emoji:row.avatar_emoji};if(claims?.role==="parent")Object.assign(safe,{is_active:row.is_active,notifications_enabled:row.notifications_enabled,device_count:row.device_count||0});return safe});
  console.info("[family members] query success",{rowCount:Array.isArray(rows)?rows.length:0,activeMemberCount:members.length,authenticated:Boolean(claims)});
  if(!members.length){console.warn("[family members] no active family members found");return respond(200,{members:[],settings,message:"가족 구성원이 없습니다."});}
  return respond(200,{members,settings});
 }catch(e){
  const code=classifyError(e),missing=e.missingEnvironmentVariables||[];
  console.error("[family members] request failed",{code,httpStatus:e.statusCode||500,supabaseStatus:e.supabaseStatus||null,supabaseCode:e.supabaseCode||null,message:e.message,supabaseMessage:e.supabaseMessage||null,cause:e.causeMessage||null,missingEnvironmentVariables:missing,environment:environmentStatus()});
  const status=code==="FAMILY_JWT_INVALID"?401:code==="SUPABASE_CONNECTION_FAILED"?502:500;
  return respond(status,{ok:false,error:code==="ENVIRONMENT_MISSING"?"가족 구성원 API 환경변수가 설정되지 않았습니다.":code==="FAMILY_MEMBERS_TABLE_MISSING"?"가족 구성원 테이블이 준비되지 않았습니다.":code==="SUPABASE_AUTH_FAILED"?"Supabase 서버 인증에 실패했습니다.":code==="SUPABASE_CONNECTION_FAILED"?"Supabase에 연결할 수 없습니다.":"가족 구성원을 조회하지 못했습니다.",code,...(missing.length?{missingEnvironmentVariables:missing}:{})});
 }
};
