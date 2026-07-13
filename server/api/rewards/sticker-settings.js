const u=require("./_utils");
const defaults={early_complete_count:3,on_time_complete_count:2,delayed_complete_count:1,no_date_complete_count:1,academy_complete_count:1};
const fields=Object.keys(defaults);
function safe(row={}){return Object.fromEntries(fields.map(key=>[key,Number.isInteger(Number(row[key]))?Number(row[key]):defaults[key]]))}
module.exports=async function handler(req,res){
 if(!["GET","PUT"].includes(req.method))return u.allow(res,["GET","PUT"]);
 try{
  const c=u.authenticate(req,"parent");
  if(req.method==="GET"){
   const row=(await u.supabaseFetch(`sticker_reward_settings?select=${fields.join(",")}&family_id=eq.${c.family}&limit=1`))?.[0];
   return u.json(res,200,{ok:true,settings:safe(row)});
  }
  const body=await u.readJson(req),settings={};
  for(const key of fields){const value=Number(body[key]);if(!Number.isInteger(value)||value<0||value>20)throw u.err("스티커 개수는 0개부터 20개까지 입력해 주세요.",400,"INVALID_STICKER_COUNT");settings[key]=value}
  const rows=await u.supabaseFetch("sticker_reward_settings?on_conflict=family_id",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify({family_id:c.family,...settings,updated_at:new Date().toISOString()})});
  return u.json(res,200,{ok:true,settings:safe(rows?.[0]||settings),message:"스티커 지급 설정이 저장되었습니다."});
 }catch(e){
  console.error("[sticker settings] failed",{statusCode:e.statusCode||500,supabaseStatus:e.supabaseStatus||null,supabaseCode:e.supabaseCode||null,supabaseMessage:e.supabaseMessage||null,supabaseDetails:e.supabaseDetails||null,supabaseHint:e.supabaseHint||null});
  const tableMissing=e.supabaseCode==="PGRST205";
  return u.json(res,e.statusCode||500,{ok:false,error:tableMissing?"스티커 지급 설정 테이블이 없습니다. Supabase migration을 먼저 실행해 주세요.":e.statusCode?e.supabaseMessage||e.message:"스티커 지급 설정을 처리하지 못했습니다.",code:tableMissing?"STICKER_SETTINGS_TABLE_MISSING":e.supabaseCode||e.code||"STICKER_SETTINGS_FAILED",...(e.supabaseCode?{supabaseCode:e.supabaseCode}:{})})
 }
};
