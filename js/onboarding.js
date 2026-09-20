import { restoreFamilyAuth } from "./family-auth.js";

const SIMPLE_PINS=new Set(["0000","1111","1234","4321"]),CHILD_REQUIRED="CHILD_REQUIRED",CHILD_AVATARS=new Set(["👦","👧","🧒","🐰","🐻","🐱","🦊","🐼"]);
export function validateRegistration(input){const familyDisplayName=String(input.familyDisplayName||"").normalize("NFKC").trim(),parentDisplayName=String(input.parentDisplayName||"").normalize("NFKC").trim(),parentPin=String(input.parentPin||""),parentPinConfirm=String(input.parentPinConfirm||"");if(!familyDisplayName||[...familyDisplayName].length>60)return{ok:false,field:"familyDisplayName",code:"FAMILY_NAME_INVALID"};if(!parentDisplayName||[...parentDisplayName].length>60)return{ok:false,field:"parentDisplayName",code:"PARENT_NAME_INVALID"};if(!/^\d{4}$/.test(parentPin))return{ok:false,field:"parentPin",code:"PARENT_PIN_INVALID"};if(SIMPLE_PINS.has(parentPin)||/^(\d)\1{3}$/.test(parentPin))return{ok:false,field:"parentPin",code:"WEAK_PARENT_PIN"};if(parentPin!==parentPinConfirm)return{ok:false,field:"parentPinConfirm",code:"PIN_CONFIRMATION_MISMATCH"};return{ok:true,value:{familyDisplayName,parentDisplayName,parentPin,parentPinConfirm}}}
export function validateChild(input){const displayName=String(input.displayName||"").normalize("NFKC").trim(),avatarEmoji=String(input.avatarEmoji||"🧒");if(!displayName||[...displayName].length>60||/[\p{Cc}\p{Cf}]/u.test(displayName))return{ok:false,field:"displayName",code:"CHILD_VALIDATION_FAILED"};if(!CHILD_AVATARS.has(avatarEmoji))return{ok:false,field:"avatarEmoji",code:"CHILD_VALIDATION_FAILED"};return{ok:true,value:{displayName,avatarEmoji}}}
export function initExistingFamilyInvite({onInviteAccepted=async()=>{}}={}) {
  const el=id=>document.getElementById(id),welcome=el("onboardingWelcome"),panel=el("onboardingInvite"),form=el("onboardingInviteForm"),code=el("onboardingInviteCode"),submit=el("onboardingInviteSubmit"),error=el("onboardingInviteError"),back=el("onboardingInviteBack");
  let busy=false,contextReady=false;
  el("existingFamilyButton").addEventListener("click",()=>{
    if(busy)return;
    welcome.hidden=true;panel.hidden=false;error.textContent="";
    panel.querySelector("h2")?.focus();
  });
  back.addEventListener("click",()=>{
    if(busy)return;
    code.value="";error.textContent="";panel.hidden=true;welcome.hidden=false;
    welcome.querySelector("h1")?.focus();
  });
  form.addEventListener("input",()=>{error.textContent=""});
  form.addEventListener("submit",async event=>{
    event.preventDefault();if(busy)return;
    const normalized=code.value.normalize("NFKC").toUpperCase().replace(/[\s-]/g,"");
    if(!contextReady&&!normalized){error.textContent="연결 코드를 입력해 주세요.";code.focus();return}
    busy=true;submit.disabled=true;back.disabled=true;submit.setAttribute("aria-busy","true");
    try{
      if(!contextReady){
        const response=await fetch("/api/onboarding/invite",{method:"POST",credentials:"same-origin",cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify({inviteCode:normalized})});
        const data=await response.json().catch(()=>({}));
        if(!response.ok||data.state!=="FAMILY_CONTEXT_READY")throw new Error(data.code||"INVITE_INVALID");
        contextReady=true;code.value="";code.disabled=true;
      }
      // Keep the consumed-code context through authentication and app-start retries.
      await onInviteAccepted();
      panel.hidden=true;
    }catch(failure){
      if(contextReady){el("onboardingView").hidden=false;el("appShell").hidden=true;panel.hidden=false;welcome.hidden=true}
      error.textContent=contextReady?"연결은 완료됐어요. 다시 시도해 가족 사용자로 로그인해 주세요.":failure.message==="INVITE_RATE_LIMITED"?"요청이 많아요. 잠시 후 다시 시도해 주세요.":"연결 코드를 확인해 주세요. 코드는 10분 동안 한 번만 사용할 수 있어요. 필요하면 기존 기기에서 새 코드를 만들어 주세요.";
      error.focus();
    }finally{
      busy=false;submit.disabled=false;back.disabled=false;submit.removeAttribute("aria-busy");
      submit.textContent=contextReady?"로그인 계속하기":"연결하기";
    }
  });
}
export function createRequestState(uuid=()=>crypto.randomUUID()){let requestId="",fingerprint="";return{forPayload(next){if(!requestId||fingerprint!==next){requestId=uuid();fingerprint=next}return requestId},consume(){requestId="";fingerprint=""}}}
export function onboardingErrorMessage(code){if(["FAMILY_NAME_INVALID","PARENT_NAME_INVALID","PARENT_PIN_INVALID","PIN_CONFIRMATION_MISMATCH","ONBOARDING_VALIDATION_FAILED"].includes(code))return"입력한 내용을 확인해 주세요.";if(code==="WEAK_PARENT_PIN")return"추측하기 어려운 4자리 PIN을 입력해 주세요.";if(code==="IDEMPOTENCY_CONFLICT")return"입력 내용이 바뀌었어요. 새 등록으로 다시 시도해 주세요.";if(code==="ONBOARDING_RATE_LIMITED")return"요청이 많아요. 잠시 후 다시 시도해 주세요.";if(code==="NETWORK_ERROR")return"연결을 확인하고 같은 정보로 다시 시도해 주세요.";return"가족을 만들지 못했어요. 잠시 후 다시 시도해 주세요."}
function childErrorMessage(code){if(code==="IDEMPOTENCY_CONFLICT")return"입력 내용이 바뀌었어요. 새 등록으로 다시 시도해 주세요.";if(code==="CHILD_CREATION_RATE_LIMITED")return"요청이 많아요. 잠시 후 다시 시도해 주세요.";if(code==="FAMILY_MEMBER_LIMIT_REACHED")return"가족 구성원은 최대 10명까지 등록할 수 있어요.";if(["AUTH_SESSION_INVALID","AUTH_ROLE_REQUIRED"].includes(code))return"자녀 추가는 인증된 부모만 할 수 있어요.";if(code==="NETWORK_ERROR")return"연결을 확인하고 같은 정보로 다시 시도해 주세요.";if(code==="CHILD_VALIDATION_FAILED")return"자녀 이름과 프로필 그림을 확인해 주세요.";return"자녀를 추가하지 못했어요. 잠시 후 다시 시도해 주세요."}
export function initOnboarding({onAuthenticated,onChildAdditionStart=()=>{},onHide=()=>{},onInviteAccepted=async()=>{},onChildCreated=async()=>null,onOpenLearning=async()=>{},onSkipLearning=()=>{},onHandoffChild=async()=>{}}){const el=id=>document.getElementById(id),view=el("onboardingView"),app=el("appShell"),welcome=el("onboardingWelcome"),invitePanel=el("onboardingInvite"),inviteForm=el("onboardingInviteForm"),inviteCode=el("onboardingInviteCode"),inviteSubmit=el("onboardingInviteSubmit"),inviteError=el("onboardingInviteError"),registration=el("onboardingRegistration"),childRequired=el("onboardingChildRequired"),childRegistration=el("onboardingChildRegistration"),learningSetup=el("onboardingLearningSetup"),learningChild=el("onboardingLearningChild"),learningStatus=el("onboardingLearningStatus"),form=el("onboardingForm"),error=el("onboardingError"),submit=el("onboardingSubmit"),requests=createRequestState(),childForm=el("onboardingChildForm"),childError=el("onboardingChildError"),childSubmit=el("onboardingChildSubmit"),childRequests=createRequestState();let submitting=false,inviteSubmitting=false,childSubmitting=false,committedChild=null,learningChildren=[],childReentry=false;
function startChildAddition(){
  const auth=restoreFamilyAuth();
  if(!auth||auth.member.role!=="parent"||auth.member.is_active===false)return false;
  if(childSubmitting)return false;
  onChildAdditionStart();
  if(committedChild){showPanel(childRegistration);return false;}
  childReentry=true;childRequests.consume();childForm.reset();
  childForm.elements.avatarEmoji.value="🧒";childError.textContent="";
  el("onboardingChildName").removeAttribute("aria-invalid");
  for(const input of childForm.querySelectorAll("input"))input.disabled=false;
  childSubmit.disabled=false;childSubmit.removeAttribute("aria-busy");childSubmit.textContent="자녀 추가";
  view.dataset.onboardingState="CHILD_ADD";showPanel(childRegistration);return true;
}
function backFromChildAddition(){
  if(childSubmitting)return;
  if(committedChild){showPanel(childRegistration);return;}
  if(childReentry)hide();else showChildRequired();
}
function showPanel(panel,afterCreate=false){if(committedChild&&!afterCreate)panel=childRegistration;view.hidden=false;app.hidden=true;for(const item of[welcome,registration,childRequired,childRegistration,learningSetup])item.hidden=item!==panel;panel.querySelector("h1, h2")?.focus()}function showWelcome(){view.dataset.onboardingState="NEW_VISITOR";showPanel(welcome)}function showChildRequired(){view.dataset.onboardingState=CHILD_REQUIRED;showPanel(childRequired)}function hide(){view.hidden=true;app.hidden=false;onHide()}function selectedLearningChildId(){return learningChildren[Number(learningChild.value)]?.id||""}function showLearningSetupOptional({children=[],selectedChildId=""}={}){view.dataset.onboardingState="LEARNING_SETUP_OPTIONAL";learningChildren=[...children];learningChild.replaceChildren();learningChildren.forEach((child,index)=>{const option=document.createElement("option");option.value=String(index);option.textContent=`${child.avatar_emoji||"👤"} ${child.display_name}`;learningChild.append(option)});const selectedIndex=learningChildren.findIndex(child=>child.id===selectedChildId);learningChild.value=String(selectedIndex>=0?selectedIndex:0);showPanel(learningSetup)}function showLearningReady(){view.dataset.onboardingState="LEARNING_READY";hide()}function showError(code,field){error.textContent=onboardingErrorMessage(code);const ids={familyDisplayName:"onboardingFamilyName",parentDisplayName:"onboardingParentName",parentPin:"onboardingParentPin",parentPinConfirm:"onboardingParentPinConfirm"},input=field?el(ids[field]):null;if(input){input.setAttribute("aria-invalid","true");input.focus()}else error.focus()}
el("createFamilyButton").addEventListener("click",()=>showPanel(registration));el("onboardingBack").addEventListener("click",showWelcome);el("onboardingContinueParent").addEventListener("click",hide);el("onboardingOpenChildForm").addEventListener("click",()=>showPanel(childRegistration));el("onboardingChildBack").addEventListener("click",backFromChildAddition);el("onboardingCreateLearningPlan").addEventListener("click",async()=>{learningStatus.textContent="";try{await onOpenLearning(selectedLearningChildId());hide()}catch{learningStatus.textContent="학습 화면을 열지 못했어요. 잠시 후 다시 시도해 주세요.";learningStatus.focus()}});el("onboardingSkipLearning").addEventListener("click",()=>{onSkipLearning();hide()});el("onboardingStartChild").addEventListener("click",async()=>{learningStatus.textContent="";try{await onHandoffChild(selectedLearningChildId())}catch{learningStatus.textContent="아이 화면으로 전환하지 못했어요. 다시 시도해 주세요.";learningStatus.focus()}});form.addEventListener("input",()=>{error.textContent="";form.querySelectorAll('[aria-invalid="true"]').forEach(input=>input.removeAttribute("aria-invalid"))});
form.addEventListener("submit",async event=>{event.preventDefault();if (submitting) return;const values={familyDisplayName:el("onboardingFamilyName").value,parentDisplayName:el("onboardingParentName").value,parentPin:el("onboardingParentPin").value,parentPinConfirm:el("onboardingParentPinConfirm").value},validation=validateRegistration(values);if(!validation.ok)return showError(validation.code,validation.field);const rememberDevice=el("onboardingRememberDevice").checked,fingerprint=JSON.stringify({...validation.value,rememberDevice}),onboardingRequestId=requests.forPayload(fingerprint);submitting=true;submit.disabled=true;submit.setAttribute("aria-busy","true");submit.textContent="가족을 만드는 중…";try{const response=await fetch("/api/onboarding/family",{method:"POST",credentials:"same-origin",cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify({onboardingRequestId,familyDisplayName:validation.value.familyDisplayName,parentDisplayName:validation.value.parentDisplayName,parentPin:validation.value.parentPin,rememberDevice})}),data=await response.json().catch(()=>({}));if(!response.ok){const apiError=new Error("Registration failed");apiError.code=data.code||"ONBOARDING_CREATION_FAILED";throw apiError}await onAuthenticated(data);form.reset();el("onboardingRememberDevice").checked=true;showChildRequired()}catch(requestError){showError(requestError.code||(navigator.onLine?"ONBOARDING_CREATION_FAILED":"NETWORK_ERROR"))}finally{submitting=false;submit.disabled=false;submit.removeAttribute("aria-busy");submit.textContent="가족 만들기"}});
async function refreshCreatedChild(){
  childSubmitting=true;childSubmit.disabled=true;childSubmit.setAttribute("aria-busy","true");childSubmit.textContent="목록 새로고침 중…";
  try{
    const setup=await onChildCreated(committedChild);
    // Keep committed context until the transition and form reset both complete.
    // A refreshed child is sufficient to enter the app; learning setup stays optional.
    view.dataset.onboardingState=setup?.state||"LEARNING_SETUP_OPTIONAL";
    hide();childForm.reset();childForm.elements.avatarEmoji.value="🧒";
    committedChild=null;childError.textContent="";
    for(const input of childForm.querySelectorAll("input"))input.disabled=false;

  }catch{
    view.dataset.onboardingState="CHILD_CREATED_REFRESH_REQUIRED";
    for(const item of[welcome,registration,childRequired,childRegistration,learningSetup])item.hidden=item!==childRegistration;
    view.hidden=false;app.hidden=true;
    childError.textContent="자녀 추가는 완료됐어요. 목록을 새로고침하지 못했어요. 다시 등록하지 말고 목록 새로고침을 눌러 주세요.";
    for(const input of childForm.querySelectorAll("input"))input.disabled=true;
    childError.focus();
  }finally{
    childSubmitting=false;childSubmit.disabled=false;childSubmit.removeAttribute("aria-busy");childSubmit.textContent=committedChild?"목록 새로고침":"자녀 추가";
  }
}
childForm.addEventListener("input",()=>{childError.textContent="";el("onboardingChildName").removeAttribute("aria-invalid")});childForm.addEventListener("submit",async event=>{event.preventDefault();if(childSubmitting)return;if(committedChild)return refreshCreatedChild();const validation=validateChild({displayName:el("onboardingChildName").value,avatarEmoji:childForm.elements.avatarEmoji.value});if(!validation.ok){childError.textContent=childErrorMessage(validation.code);el("onboardingChildName").setAttribute("aria-invalid","true");el("onboardingChildName").focus();return}const clientRequestId=childRequests.forPayload(JSON.stringify(validation.value));childSubmitting=true;childSubmit.disabled=true;childSubmit.setAttribute("aria-busy","true");childSubmit.textContent="추가하는 중…";try{const auth=restoreFamilyAuth();if(!auth||auth.member.role!=="parent"){const authError=new Error("Parent authentication required");authError.code=auth?"AUTH_ROLE_REQUIRED":"AUTH_SESSION_INVALID";throw authError}const response=await fetch("/api/family/children",{method:"POST",credentials:"same-origin",cache:"no-store",headers:{"Content-Type":"application/json",Authorization:`Bearer ${auth.token}`},body:JSON.stringify({clientRequestId,...validation.value})}),data=await response.json();if(!response.ok){const apiError=new Error("Child creation failed");apiError.code=data.code||"CHILD_CREATION_FAILED";throw apiError}if(data?.ok!==true||typeof data.created!=="boolean"||typeof data.child?.id!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.child.id))throw new Error("Invalid child creation response.");committedChild=data;childRequests.consume();await refreshCreatedChild()}catch(requestError){childError.textContent=childErrorMessage(requestError.code||(navigator.onLine?"CHILD_CREATION_FAILED":"NETWORK_ERROR"));childError.focus()}finally{childSubmitting=false;childSubmit.disabled=false;childSubmit.removeAttribute("aria-busy");childSubmit.textContent=committedChild?"목록 새로고침":"자녀 추가"}});return{startChildAddition,hide,showChildRequired,showLearningReady,showLearningSetupOptional,showWelcome}}
