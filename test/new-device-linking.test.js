const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const utils = require("../server/api/family/_utils");
const push = require("../server/api/push/_utils");
const exchange = require("../server/api/onboarding/invite");
const invites = require("../server/api/family/invites");
const FAMILY = "10000000-0000-4000-8000-000000000001";
const PARENT = { id: "20000000-0000-4000-8000-000000000002", family_id: FAMILY, member_key: "parent", display_name: "부모", role: "parent", is_active: true };
const CHILD = { ...PARENT, id: "30000000-0000-4000-8000-000000000003", member_key: "child", display_name: "자녀", role: "child" };
// Synthetic fixtures only; never obtained from a deployed environment.
const CODE = "23456-789AB-CDEFG-HJKMN";
const SECRET = "local-invite-contract-fixture-".repeat(2);
function response() { return { headers: {}, setHeader(k, v) { this.headers[k] = v; }, getHeader(k) { return this.headers[k]; }, end(v) { this.body = JSON.parse(v); } }; }

test("Exchange uses the actual SQL parameter names, hashes only, and issues bootstrap without member auth", async t => {
  const calls = [], logs = [];
  t.mock.method(push, "env", () => SECRET);
  t.mock.method(utils, "env", () => SECRET);
  t.mock.method(utils, "readJson", async () => ({ inviteCode: CODE.toLowerCase() }));
  t.mock.method(utils, "supabaseFetch", async (route, options) => {
    calls.push({ route, body: JSON.parse(options.body) });
    return [{ exchanged: true, family_id: FAMILY, result_code: "OK" }];
  });
  for (const level of ["log", "info", "warn", "error"]) t.mock.method(console, level, (...args) => logs.push(args));
  const res = response();
  await exchange({ method: "POST", headers: { "x-forwarded-for": "127.0.0.1, 10.0.0.1", "x-forwarded-proto": "https" } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true, state: "FAMILY_CONTEXT_READY" });
  assert.equal(calls[0].route, "rpc/exchange_product_family_invite");
  const sql = read("supabase/migrations/202608170003_existing_family_invites.sql");
  const names = sql.match(/create function public\.exchange_product_family_invite\(([^)]+)\)/)[1].split(",").map(p => p.trim().split(" ")[0]).sort();
  assert.deepEqual(Object.keys(calls[0].body).sort(), names);
  const codeHash = invites._test.inviteHash(CODE.replaceAll("-", ""));
  assert.equal(calls[0].body.p_invite_hash, codeHash);
  assert.equal(calls[0].body.p_rate_scope_digest, crypto.createHmac("sha256", SECRET).update(`family-invite-exchange:v1:127.0.0.1:${codeHash}`).digest("hex"));
  assert.doesNotMatch(JSON.stringify(calls), /p_rate_scope_hash|23456|789AB/);
  assert.deepEqual(logs, []);
  const cookie = res.headers["Set-Cookie"];
  assert.match(cookie, /HttpOnly; SameSite=Strict; Path=\//);
  assert.match(cookie, /Max-Age=28800; Secure/);
  const scope = await utils.trustedFamilyScope({ headers: { cookie: cookie.split(";")[0] } }, response());
  assert.equal(scope.familyId, FAMILY);
  assert.equal(scope.source, "bootstrap");
  assert.equal(scope.claims, null);
  assert.equal(res.headers["Cache-Control"], "no-store");
});

for (const failure of ["invalid", "expired", "used", "revoked", "rate-limited", "RPC failure", "malformed"]) {
  test(`Exchange safely rejects ${failure} without bootstrap or auth`, async t => {
    let called = false;
    t.mock.method(utils, "env", () => SECRET);
    t.mock.method(utils, "readJson", async () => ({ inviteCode: failure === "malformed" ? "bad" : CODE }));
    t.mock.method(utils, "supabaseFetch", async () => {
      called = true;
      if (failure === "RPC failure") throw Error("private database details");
      // SQL intentionally maps all unavailable invite states to the same result.
      return [{ exchanged: false, family_id: null, result_code: failure === "rate-limited" ? "INVITE_RATE_LIMITED" : "INVITE_INVALID" }];
    });
    const res = response();
    await exchange({ method: "POST", headers: {} }, res);
    assert.equal(res.statusCode, failure === "rate-limited" ? 429 : 401);
    assert.deepEqual(res.body, { ok: false, error: "초대 코드를 확인해 주세요.", code: failure === "rate-limited" ? "INVITE_RATE_LIMITED" : "INVITE_INVALID" });
    assert.equal(res.headers["Set-Cookie"], undefined);
    assert.equal(called, failure !== "malformed");
  });
}

test("Generation derives family and creator from parent authentication and persists only the HMAC", async t => {
  const calls = [], logs = [];
  t.mock.method(utils, "env", () => SECRET);
  t.mock.method(utils, "authenticateActiveMember", async (_req, options) => {
    assert.equal(options.requiredRole, "parent");
    return { familyId: FAMILY, memberId: PARENT.id };
  });
  t.mock.method(utils, "supabaseFetch", async (route, options) => {
    calls.push({ route, body: JSON.parse(options.body) });
    return [{ safe_ref: CHILD.id, expires_at: "2099-01-01T00:00:00Z" }];
  });
  for (const level of ["log", "info", "warn", "error"]) t.mock.method(console, level, (...args) => logs.push(args));
  const res = response();
  await invites({ method: "POST", headers: {}, body: { familyId: "other-family", parentId: "other-parent" } }, res);
  assert.equal(res.statusCode, 201);
  assert.match(res.body.invite.code, /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{5}(?:-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{5}){3}$/);
  assert.deepEqual(calls[0].body, { p_family_id: FAMILY, p_parent_member_id: PARENT.id, p_invite_hash: invites._test.inviteHash(res.body.invite.code.replaceAll("-", "")) });
  assert.equal(JSON.stringify(calls).includes(res.body.invite.code), false);
  assert.deepEqual(logs, []);
});

test("A child cannot generate invites through the API", async t => {
  t.mock.method(utils, "authenticateActiveMember", async (_req, options) => {
    assert.equal(options.requiredRole, "parent");
    throw Object.assign(Error("denied"), { code: "AUTH_ROLE_REQUIRED", statusCode: 403 });
  });
  t.mock.method(utils, "supabaseFetch", async () => assert.fail("must not access invite storage"));
  const res = response();
  await invites({ method: "POST", headers: {} }, res);
  assert.equal(res.statusCode, 403);
});

function section(source, start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `Missing source section: ${start}`);
  return source.slice(a, b);
}
function storage() {
  const values = new Map();
  return { values, getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, String(v)), removeItem: k => values.delete(k) };
}
function element() {
  const listeners = new Map(), classes = new Set(), attributes = new Map();
  return {
    value: "", textContent: "", hidden: false, disabled: false, checked: true, open: false, dataset: {}, children: [], elements: { avatarEmoji: { value: "🧒" } }, style: { setProperty() {} },
    classList: { contains: v => classes.has(v), add: v => classes.add(v), remove: v => classes.delete(v), toggle(v, on) { if (on) classes.add(v); else classes.delete(v); } },
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, []); if (!listeners.get(type).includes(fn)) listeners.get(type).push(fn); },
    dispatchEvent(event) { for (const fn of listeners.get(event.type) || []) fn(event); },
    async fire(type, extra = {}) { for (const fn of listeners.get(type) || []) await fn({ type, preventDefault() {}, currentTarget: this, ...extra }); },
    setAttribute: (k, v) => attributes.set(k, v), getAttribute: k => attributes.get(k), hasAttribute: k => attributes.has(k), removeAttribute: k => attributes.delete(k),
    append(...items) { this.children.push(...items); }, replaceChildren(...items) { this.children = items; }, querySelector() { return null; }, querySelectorAll() { return []; }, focus() {}, reset() {}, showModal() { this.open = true; }, close() { this.open = false; },
  };
}
function loginData(member, remember = true) {
  const encode = v => Buffer.from(JSON.stringify(v)).toString("base64url"), exp = Math.floor(Date.now() / 1000) + 28800;
  return { token: encode({ sub: member.id, family: member.family_id, key: member.member_key, role: member.role, exp }) + ".signature", realtimeToken: encode({ alg: "HS256" }) + "." + encode({ sub: member.id, exp }) + ".signature", member, rememberDevice: remember, expires_at: remember ? "2099-01-01T00:00:00Z" : null, ...(remember ? { deviceSessionToken: "synthetic-device-session" } : {}) };
}

// Execute the Product modules and actual app startup functions in a browser-like VM.
// Only the DOM, network and unrelated study/push presentation are substituted.
function browserHarness({ restored = null, members = [PARENT, CHILD] } = {}) {
  const nodes = new Map(), calls = [], timers = new Map();
  let nextTimer = 0, familyReady = Boolean(restored), clipboardFails = false, postResult = null, list = [], now = Date.now(), initialized = 0, entered = 0;
  const node = key => { if (!nodes.has(key)) nodes.set(key, element()); return nodes.get(key); };
  node("#onboardingInvite").hidden = true;
  node("#appShell").hidden = true;
  node("#parent").querySelector = selector => node(selector);
  node(".parent-management-tabs").querySelector = selector => node(selector);
  const document = Object.assign(element(), { querySelector: node, querySelectorAll: () => [], getElementById: id => node("#" + id), createElement: element, documentElement: element(), body: element(), hidden: false });
  const window = Object.assign(element(), { location: { search: "" }, innerHeight: 800 });
  const sessionStorage = storage(), localStorage = storage();
  if (restored) localStorage.setItem("familyDeviceSessionToken", "saved-device-fixture");
  const fetch = async (url, options = {}) => {
    const body = options.body ? JSON.parse(options.body) : null;
    calls.push({ url, method: options.method || "GET", body, headers: options.headers });
    let status = 200, data;
    if (url === "/api/family/session/restore") { status = restored ? 200 : 401; data = restored || { code: "DEVICE_SESSION_MISSING" }; }
    else if (url === "/api/family/context") data = { hasFamilyContext: familyReady };
    else if (url === "/api/onboarding/invite") { familyReady = true; data = { ok: true, state: "FAMILY_CONTEXT_READY" }; }
    else if (url === "/api/family/members") { assert.equal(familyReady, true); data = { members }; }
    else if (url === "/api/family/verify-pin") { assert.equal(familyReady, true); status = body.pin === "7392" ? 200 : 401; data = status === 200 ? loginData(PARENT, body.rememberDevice) : { code: "PIN_INVALID" }; }
    else if (url === "/api/family/child-login") { assert.equal(familyReady, true); assert.equal(body.pin, undefined); data = loginData(CHILD, body.rememberDevice); }
    else if (url === "/api/family/invites" && options.method === "POST") data = postResult ? await postResult() : { invite: { code: CODE, safeRef: CHILD.id, expiresAt: new Date(now + 600000).toISOString() } };
    else if (url === "/api/family/invites") data = { invites: list };
    else if (url.startsWith("/api/family/invites/")) data = { ok: true };
    else if (url === "/api/family/messages") data = { messages: [], unread: 0 };
    else throw Error("Unexpected network path: " + url);
    return { ok: status < 400, status, json: async () => data };
  };
  const sandbox = {
    document, window, sessionStorage, localStorage, fetch, crypto: crypto.webcrypto, performance, URLSearchParams, AbortController, atob,
    Date: class extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } },
    setTimeout: (fn, delay) => { timers.set(++nextTimer, { fn, at: now + delay }); return nextTimer; }, clearTimeout: id => timers.delete(id),
    navigator: { platform: "test", onLine: true, clipboard: { async writeText(value) { assert.equal(value, CODE); if (clipboardFails) throw Error("denied"); } } },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
    MutationObserver: class { observe() {} }, requestAnimationFrame() {}, console: { log() {}, info() {}, warn() {}, error() {} },
    SUPABASE_CONFIG: {}, createClient: () => null,
    familyChatController: null, onboardingController: null, learningController: null, learningAnalysisController: null, learningMistakesController: null, learningReviewQueueController: null, rewardStoreController: null,
    authGeneration: 0, authenticationTransition: null, authenticatedFeaturesTransition: null, completedAuthGeneration: -1, authMembersRefreshRequired: false, remoteLoadGeneration: 0,
    render() {}, emptyLocalData: () => ({}),
    BUILD_VERSION: "test", startupMetrics: {}, startupStartedAt: 0, appReady: false, activeCacheKey: "local-test-cache", realtimeUnsubscribe: null,
    renderStoredUserHint() {}, bindEvents() {}, initParentDashboard() {}, deferStartupTask() {}, registerServiceWorker() {}, updateInstallUI() {}, resetForm() {}, resetBookPlanForm() {}, resetReadingPlanForm() {}, resetAcademyForm() {}, setConnectionStatus() {}, openFirstLearningSetup() {}, learningSetupPreference: { dismiss() {}, clear() {}, isDismissed: () => false },
    async requestJson(url) { assert.ok(url.startsWith("/api/learning/plans")); return { planning: [] }; }, familyAuthHeaders() {}, selectedPlanAssignee() {}, requireSelectedPlanAssignee() {}, switchView() {},
    initLearning() { initialized++; return { reset() {} }; }, initLearningAnalysis: () => ({ reset() {}, async refresh() { return true; } }), initLearningMistakes: () => ({ reset() {} }), initLearningReviewQueue: () => ({ reset() {} }),
    async enterAuthenticatedApp() { entered++; sandbox.appReady = true; }, async evaluateLearningOnboarding() {},
  };
  window.setTimeout = sandbox.setTimeout; window.clearTimeout = sandbox.clearTimeout;
  const context = vm.createContext(sandbox);
  const moduleSource = file => read(file).replace(/^import .*;\r?\n/gm, "").replace(/\bexport /g, "");
  vm.runInContext(moduleSource("js/family-auth.js") + "\n" + moduleSource("js/family-chat.js") + "\n" + moduleSource("js/onboarding.js"), context);
  vm.runInContext(moduleSource("js/parent-dashboard.js") + "\n" + moduleSource("js/onboarding-learning.js"), context);
  vm.runInContext("renderMessages=()=>{};renderPushButton=()=>{};syncExistingPushSubscription=async()=>{};", context);
  const app = read("js/app.js");
  vm.runInContext(section(app, "async function learningOnboardingModel(", "function openOptionalLearningSetup("), context);
  vm.runInContext(section(app, "function authenticatedStartupContext()", "function createStartupLearningRequests()"), context);
  vm.runInContext(section(app, "async function initApp()", "async function learningOnboardingModel("), context);
  vm.runInContext(section(app, '\nwindow.addEventListener("family-auth-changed"', "let initializationPromise").replace("state = emptyLocalData();", "appState = emptyLocalData();"), context);
  const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
  return { node, calls, context, sessionStorage, localStorage, flush,
    timerIds: () => [...timers.keys()],
    async addChild() { await node("#familyAdminList").children.find(item => item.id === "familyAddChildButton").fire("click"); },
    start: () => context.initApp(), initialized: () => initialized, entered: () => entered,
    setClipboardFailure: value => { clipboardFails = value; }, setPostResult: value => { postResult = value; }, setList: value => { list = value; },
    async advance(ms) { now += ms; for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.fn(); } await flush(); },
    async link() { await node("#existingFamilyButton").fire("click"); node("#onboardingInviteCode").value = CODE; return node("#onboardingInviteForm").fire("submit"); },
    async selectParentTab(tab) { vm.runInContext(`new ParentTabs(document.querySelector(".parent-management-tabs")).select(${JSON.stringify(tab)})`, context); await flush(); },
    async parentPanel() { node("#parent").classList.add("active"); await this.selectParentTab("family"); },
  };
}

for (const hasChild of [false, true]) {
  test(`new-device linked parent with ${hasChild ? "child/no plan enters app" : "zero children stays CHILD_REQUIRED"}`, async () => {
    const h = browserHarness({ members: hasChild ? [PARENT, CHILD] : [PARENT] }); await h.start();
    const linking = h.link(); await h.flush();
    await h.node("#familyMemberChoices").children.find(n => n.dataset.memberId === PARENT.id).fire("click");
    h.node("#familyPinInput").value = "7392";
    await h.node("#familyLoginForm").fire("submit"); await linking;
    assert.equal(h.entered(), 1);
    assert.equal(h.node("#onboardingView").hidden, hasChild);
    assert.equal(h.node("#appShell").hidden, !hasChild);
    if (!hasChild) assert.equal(h.node("#onboardingView").dataset.onboardingState, "CHILD_REQUIRED");
    assert.notEqual(h.node("#onboardingView").dataset.onboardingState, "LEARNING_SETUP_OPTIONAL");
  });
}

for (const role of ["parent", "child"]) {
  test(`Empty browser links and logs in as ${role}, saves auth and initializes once without reload`, async () => {
    const h = browserHarness(); await h.start();
    assert.equal(h.initialized(), 0);
    const pending = h.link(); await h.flush();
    assert.equal(h.node("#familyLoginDialog").open, true);
    assert.equal(h.sessionStorage.values.size, 0);
    assert.equal(h.node("#onboardingInviteSubmit").disabled, true);
    await h.node("#onboardingInviteForm").fire("submit");
    assert.equal(h.calls.filter(c => c.url === "/api/onboarding/invite").length, 1);
    const choices = h.node("#familyMemberChoices").children;
    await choices.find(n => n.dataset.memberId === (role === "parent" ? PARENT.id : CHILD.id)).fire("click");
    if (role === "parent") {
      h.node("#familyPinInput").value = "0000"; await h.node("#familyLoginForm").fire("submit");
      assert.equal(h.initialized(), 0); assert.equal(h.sessionStorage.values.size, 0);
      assert.match(h.node("#familyLoginError").textContent, /PIN이 맞지/);
      h.node("#familyPinInput").value = "7392"; await h.node("#familyLoginForm").fire("submit");
    }
    await pending;
    assert.equal(h.initialized(), 1); assert.equal(h.entered(), 1);
    assert.equal(h.node("#appShell").hidden, false); assert.equal(h.node("#onboardingView").hidden, true);
    assert.equal(JSON.parse(h.sessionStorage.getItem("study-tracker-family-auth-v1")).member.role, role);
    assert.equal(h.localStorage.getItem("familyDeviceSessionToken"), "synthetic-device-session");
    assert.equal(h.calls.filter(c => c.url === "/api/family/session/restore").length, 1);
    if (role === "child") assert.equal(h.calls.some(c => c.url === "/api/family/verify-pin"), false);
  });
}

test("Saved parent device restores and initializes once without code or PIN", async () => {
  const h = browserHarness({ restored: loginData(PARENT) }); await h.start();
  assert.equal(h.initialized(), 1); assert.equal(h.entered(), 1);
  assert.equal(h.node("#appShell").hidden, false);
  assert.equal(h.calls.some(c => /onboarding\/invite|verify-pin|child-login/.test(c.url)), false);
  assert.equal(h.calls[0].body.deviceSessionToken, "saved-device-fixture");
});

test("Parent opting out of device persistence still initializes with session auth", async () => {
  const h = browserHarness(); await h.start(); const pending = h.link(); await h.flush();
  await h.node("#familyMemberChoices").children.find(n => n.dataset.memberId === PARENT.id).fire("click");
  h.node("#rememberDeviceInput").checked = false; h.node("#familyPinInput").value = "7392";
  await h.node("#familyLoginForm").fire("submit"); await pending;
  assert.equal(h.localStorage.getItem("familyDeviceSessionToken"), null);
  assert.ok(h.sessionStorage.getItem("study-tracker-family-auth-v1")); assert.equal(h.entered(), 1);
});

test("Parent entry loads metadata, guards duplicate creation, shows server expiry and handles clipboard failure", async () => {
  const h = browserHarness({ restored: loginData(PARENT) }); await h.start(); await h.parentPanel();
  assert.equal(h.node(".family-invite-panel").hidden, false);
  assert.equal(h.calls.filter(c => c.url === "/api/family/invites").length, 1);
  let finish; h.setPostResult(() => new Promise(resolve => { finish = resolve; }));
  const pending = h.node("#familyInviteCreate").fire("click"); await h.flush();
  await h.node("#familyInviteCreate").fire("click");
  assert.equal(h.calls.filter(c => c.url === "/api/family/invites" && c.method === "POST").length, 1);
  assert.equal(h.node("#familyInviteCreate").disabled, true);
  const expiry = new Date(Date.now() + 120000).toISOString();
  finish({ invite: { code: CODE, safeRef: CHILD.id, expiresAt: expiry } }); await pending;
  assert.equal(h.node("#familyInviteCode").textContent, CODE);
  assert.equal(h.node("#familyInviteExpiry").textContent, "만료 시각: " + new Date(expiry).toLocaleString("ko-KR"));
  assert.equal(h.node("#familyInviteCreate").disabled, false);
  await h.node("#familyInviteCopy").fire("click"); assert.equal(h.node("#familyInviteStatus").textContent, "연결 코드를 복사했어요.");
  h.setClipboardFailure(true); await h.node("#familyInviteCopy").fire("click");
  assert.match(h.node("#familyInviteStatus").textContent, /직접 선택해 복사/); assert.equal(h.node("#familyInviteCode").textContent, CODE);
  assert.equal([...h.localStorage.values.values(), ...h.sessionStorage.values.values()].some(v => v.includes(CODE)), false);
  await h.advance(121000);
  assert.equal(h.node("#familyInviteCode").textContent, ""); assert.equal(h.node("#familyInviteCopy").disabled, true);
  assert.match(h.node("#familyInviteStatus").textContent, /만료/);
});

for (const change of ["logout", "child", "other-parent", "leave"]) {
  test(`Displayed and in-flight plaintext is cleared on ${change}`, async () => {
    const h = browserHarness({ restored: loginData(PARENT) }); await h.start(); await h.parentPanel();
    await h.node("#familyInviteCreate").fire("click"); assert.equal(h.node("#familyInviteCode").textContent, CODE);
    let finish; h.setPostResult(() => new Promise(resolve => { finish = resolve; }));
    const pending = h.node("#familyInviteCreate").fire("click"); await h.flush();
    if (change === "logout") vm.runInContext('state.token="";state.realtimeToken="";state.member=null;clearFamilyAuth();', h.context);
    if (change === "child") { h.context.nextAuth = loginData(CHILD); vm.runInContext("completeFamilyLogin(nextAuth)", h.context); }
    if (change === "other-parent") { h.context.nextAuth = loginData({ ...PARENT, id: CHILD.id }); vm.runInContext("completeFamilyLogin(nextAuth)", h.context); }
    if (change === "leave") await h.selectParentTab("study");
    finish({ invite: { code: CODE, safeRef: CHILD.id, expiresAt: "2099-01-01T00:00:00Z" } }); await pending;
    assert.equal(h.node("#familyInviteCode").textContent, ""); assert.equal(h.node("#familyInviteCopy").disabled, true);
    if (["child", "logout"].includes(change)) {
      assert.equal(h.node(".family-invite-panel").hidden, true);
      const count = h.calls.length; await h.node("#familyInviteCreate").fire("click"); assert.equal(h.calls.length, count);
    }
  });
}

test("Creation failure restores controls and leaving the app parent view clears the code", async () => {
  const h = browserHarness({ restored: loginData(PARENT) }); await h.start(); await h.parentPanel();
  h.setPostResult(async () => { throw Error("offline"); }); await h.node("#familyInviteCreate").fire("click");
  assert.equal(h.node("#familyInviteCreate").disabled, false); assert.match(h.node("#familyInviteStatus").textContent, /만들지 못/);
  h.setPostResult(null); await h.node("#familyInviteCreate").fire("click");
  h.context.familyChatController.setInvitePanelActive(false);
  assert.equal(h.node("#familyInviteCode").textContent, "");
  assert.match(section(read("js/app.js"), "function switchView(", "function enterParentMode("), /setInvitePanelActive\(viewName === "parent"/);
});

test("An already expired server response never enables copying", async () => {
  const h = browserHarness({ restored: loginData(PARENT) }); await h.start(); await h.parentPanel();
  h.setPostResult(async () => ({ invite: { code: CODE, safeRef: CHILD.id, expiresAt: "2000-01-01T00:00:00Z" } }));
  await h.node("#familyInviteCreate").fire("click"); await h.node("#familyInviteCopy").fire("click");
  assert.equal(h.node("#familyInviteCode").textContent, ""); assert.equal(h.node("#familyInviteCopy").disabled, true);
  assert.match(h.node("#familyInviteStatus").textContent, /만료/);
});

test("Known consumption and cancellation clear the current code", async () => {
  const h = browserHarness({ restored: loginData(PARENT) }); await h.start(); await h.parentPanel();
  const item = { safeRef: CHILD.id, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 600000).toISOString(), usedAt: null, revokedAt: null };
  h.setList([item]); await h.node("#familyInviteCreate").fire("click");
  await h.node("#familyInviteList").children[0].children[1].fire("click");
  assert.equal(h.node("#familyInviteCode").textContent, "");
  assert.ok(h.calls.some(c => c.method === "DELETE" && c.url.endsWith(CHILD.id)));
  h.setList([{ ...item, usedAt: new Date().toISOString() }]);
  await h.node("#familyInviteCreate").fire("click");
  assert.equal(h.node("#familyInviteCode").textContent, ""); assert.equal(h.node("#familyInviteCopy").disabled, true);
  assert.match(h.node("#familyInviteList").children[0].children[0].textContent, /사용됨/);
});

test("Auth reset and delayed clipboard completion cannot leave stale plaintext or success", async () => {
  const h = browserHarness({ restored: loginData(PARENT) }); await h.start(); await h.parentPanel();
  await h.node("#familyInviteCreate").fire("click");
  let finish; h.context.navigator.clipboard.writeText = () => new Promise(resolve => { finish = resolve; });
  const pending = h.node("#familyInviteCopy").fire("click"); await h.flush();
  vm.runInContext("clearFamilyAuth()", h.context);
  finish(); await pending;
  assert.equal(h.node("#familyInviteCode").textContent, ""); assert.equal(h.node("#familyInviteStatus").textContent, "");
  assert.equal(h.node(".family-invite-panel").hidden, true);
});

test("Failed app start retries the accepted context without consuming the code twice", async () => {
  const h = browserHarness(); await h.start();
  let starts = 0;
  const original = h.context.initializeAuthenticatedFeatures;
  h.context.initializeAuthenticatedFeatures = async (...args) => { if (++starts === 1) { h.context.onboardingController.hide(); throw Error("transient startup failure"); } return original(...args); };
  const pending = h.link(); await h.flush();
  await h.node("#familyMemberChoices").children.find(n => n.dataset.memberId === CHILD.id).fire("click"); await pending;
  assert.match(h.node("#onboardingInviteError").textContent, /연결은 완료/);
  assert.equal(h.node("#onboardingView").hidden, false); assert.equal(h.node("#onboardingInvite").hidden, false);
  await h.node("#onboardingInviteForm").fire("submit");
  assert.equal(h.calls.filter(c => c.url === "/api/onboarding/invite").length, 1);
  assert.equal(h.entered(), 1); assert.equal(h.initialized(), 1); assert.equal(h.node("#appShell").hidden, false);
});

test("Child-add entry clears displayed code, copy status and timer; returning loads metadata and allows a fresh code", async () => {
  const h = browserHarness({ restored: loginData(PARENT) }); await h.start(); await h.parentPanel();
  const baselineTimers = h.timerIds();
  await h.node("#familyInviteCreate").fire("click");
  await h.node("#familyInviteCopy").fire("click");
  assert.equal(h.node("#familyInviteCode").textContent, CODE);
  assert.match(h.node("#familyInviteStatus").textContent, /복사했어요/);
  assert.equal(h.timerIds().length, baselineTimers.length + 1);
  await h.addChild();
  assert.equal(h.node("#onboardingView").dataset.onboardingState, "CHILD_ADD");
  assert.equal(h.node("#onboardingChildRegistration").hidden, false);
  assert.equal(h.node("#appShell").hidden, true);
  assert.equal(h.node("#familyInviteCode").textContent, "");
  assert.equal(h.node("#familyInviteExpiry").textContent, "");
  assert.equal(h.node("#familyInviteStatus").textContent, "");
  assert.equal(h.node("#familyInviteCopy").disabled, true);
  assert.deepEqual(h.timerIds(), baselineTimers);
  const count = h.calls.length;
  await h.node("#familyInviteCreate").fire("click");
  assert.equal(h.calls.length, count);
  h.setList([{ safeRef: CHILD.id, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 600000).toISOString() }]);
  await h.node("#onboardingChildBack").fire("click"); await h.flush();
  assert.equal(h.node("#appShell").hidden, false);
  assert.equal(h.node("#familyInviteList").children.length, 1);
  assert.equal(h.node("#familyInviteCode").textContent, "");
  assert.equal(h.node("#familyInviteStatus").textContent, "");
  assert.deepEqual(h.timerIds(), baselineTimers);
  await h.node("#familyInviteCreate").fire("click");
  assert.equal(h.node("#familyInviteCode").textContent, CODE);
  assert.equal(h.node("#familyInviteCopy").disabled, false);
  assert.equal(h.calls.filter(c => c.url === "/api/family/invites" && c.method === "POST").length, 2);
  assert.equal(h.calls.some(c => c.method === "DELETE"), false);
});

for (const returnBeforeResponse of [false, true]) {
  test(`Child-add invalidates pending creation even when response arrives ${returnBeforeResponse ? "after returning" : "inside child-add"}`, async () => {
    const h = browserHarness({ restored: loginData(PARENT) }); await h.start(); await h.parentPanel();
    const baselineTimers = h.timerIds();
    let finish; h.setPostResult(() => new Promise(resolve => { finish = resolve; }));
    const pending = h.node("#familyInviteCreate").fire("click"); await h.flush();
    await h.addChild();
    if (returnBeforeResponse) { await h.node("#onboardingChildBack").fire("click"); await h.flush(); }
    finish({ invite: { code: CODE, safeRef: CHILD.id, expiresAt: new Date(Date.now() + 600000).toISOString() } });
    await pending;
    assert.equal(h.node("#familyInviteCode").textContent, "");
    assert.equal(h.node("#familyInviteExpiry").textContent, "");
    assert.equal(h.node("#familyInviteStatus").textContent, "");
    assert.equal(h.node("#familyInviteCopy").disabled, true);
    assert.deepEqual(h.timerIds(), baselineTimers);
    if (!returnBeforeResponse) {
      assert.equal(h.node("#onboardingChildRegistration").hidden, false);
      assert.equal(h.node("#appShell").hidden, true);
      await h.node("#onboardingChildBack").fire("click"); await h.flush();
    }
    h.setPostResult(null);
    await h.node("#familyInviteCreate").fire("click");
    assert.equal(h.node("#familyInviteCode").textContent, CODE);
    assert.equal(h.node("#familyInviteCopy").disabled, false);
    assert.equal(h.calls.some(c => c.method === "DELETE"), false);
  });
}

test("Connection copy and informational lost-device path describe the existing contract without recovery actions", () => {
  const html = read("index.html"), onboarding = read("js/onboarding.js");
  const panel = section(html, '<section id="onboardingInvite"', '<section id="onboardingRegistration"');
  for (const text of ["기존 가족에 연결", "기기 연결 코드", "부모관리 → 가족 관리 → 새 기기 연결", "10분", "한 번", "부모 PIN", "연결하기", "로그인된 기존 기기를 사용할 수 없나요?", "유효한 미사용 연결 코드", "직접 복구할 수 없어요"]) assert.ok(panel.includes(text), text);
  const details = section(panel, "<details>", "</details>");
  assert.doesNotMatch(details, /<button|<form|<a\b|onclick|가족 만들기/);
  assert.doesNotMatch(onboarding, /준비 중이에요|\/api\/.*recovery/);
  assert.equal((onboarding.match(/el\("existingFamilyButton"\)\.addEventListener/g) || []).length, 1);
  assert.match(html, /새 기기 연결<\/h4>/);
});
