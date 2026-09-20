const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const section = (source, start, end) => {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `Product function boundaries: ${start}`);
  return source.slice(a, b);
};
const PARENT = { id: "parent-a", family_id: "family-a", member_key: "parent", role: "parent", display_name: "Parent", is_active: true };
const CHILD = { ...PARENT, id: "child-a", member_key: "child", role: "child", display_name: "Child" };
const loginData = member => {
  const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url"), exp = Date.now() / 1000 + 3600;
  return { member, token: encode({ sub: member.id, family: member.family_id, key: member.member_key, role: member.role, exp }) + ".fixture", realtimeToken: encode({}) + "." + encode({ sub: member.id, exp }) + ".fixture" };
};
function storage() {
  const map = new Map();
  return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)), removeItem: key => map.delete(key) };
}
function element() {
  const listeners = new Map(), attrs = new Map(), classes = new Set();
  return {
    value: "", textContent: "", dataset: {}, children: [], style: { setProperty() {} },
    classList: { contains: key => classes.has(key), add: key => classes.add(key), remove: key => classes.delete(key), toggle() {} },
    addEventListener(type, fn) { const list = listeners.get(type) || []; list.push(fn); listeners.set(type, list); },
    removeEventListener(type, fn) { listeners.set(type, (listeners.get(type) || []).filter(item => item !== fn)); },
    listenerCount: type => (listeners.get(type) || []).length,
    dispatchEvent(event) { for (const fn of listeners.get(event.type) || []) fn(event); },
    setAttribute: (key, value) => attrs.set(key, value), getAttribute: key => attrs.get(key), hasAttribute: key => attrs.has(key), removeAttribute: key => attrs.delete(key),
    append(...nodes) { this.children.push(...nodes); }, replaceChildren(...nodes) { this.children = nodes; },
    querySelector() { return null; }, querySelectorAll() { return []; }, closest() { return null; }, click() { this.dispatchEvent({ type: "click" }); }, focus() {}, close() {}, showModal() {},
  };
}
// Actual auth/chat modules plus actual app entry, assignee and repository load
// functions. Only DOM, timers, transport and unrelated feature presentation are stubbed.
function harness({ saved = false, member = PARENT, members = [PARENT, CHILD], realtime = null } = {}) {
  const calls = [], deferred = [], nodes = new Map(), auth = loginData(member);
  let responseMembers = members, fail = false, pending = null, now = Date.now();
  let selected = members.some(m => m.role === "child") ? CHILD.id : "";
  const responses = new Map();
  const node = key => { if (!nodes.has(key)) nodes.set(key, element()); return nodes.get(key); };
  const document = { querySelector: node, querySelectorAll: () => [], createElement: element, documentElement: element(), body: element(), addEventListener() {} };
  const window = Object.assign(element(), { location: { search: "" }, innerHeight: 800, setTimeout() {}, clearTimeout() {} });
  let analysisConstructions = 0;
  const sessionStorage = storage(), localStorage = storage();
  if (saved) localStorage.setItem("familyDeviceSessionToken", "synthetic-device");
  else sessionStorage.setItem("study-tracker-family-auth-v1", JSON.stringify(auth));
  const request = async url => {
    calls.push({ url, essentialComplete: Boolean(app?.appReady), member: chat?.restoreFamilyAuth()?.member });
    if (responses.has(url.split("?")[0])) return responses.get(url.split("?")[0])(url);
    if (url === "/api/family/session/restore") return auth;
    if (url.startsWith("/api/family/messages")) return { messages: [], unread: 0 };
    if (url === "/api/family/members") {
      if (pending) { const current = pending; pending = null; return current; }
      if (fail) throw Error("members unavailable");
      return { members: responseMembers };
    }
    if (url.startsWith("/api/study/plans")) return { plans: [{ id: "plan" }] };
    if (url.startsWith("/api/study/book-plans")) return { bookPlans: [{ id: "book" }] };
    if (url.startsWith("/api/study/academy-schedules")) return { schedules: [], completions: [] };
    if (url === "/api/rewards/settings") return { setting: null };
    if (url === "/api/reward_milestones") return { milestones: [] };
    if (url.startsWith("/api/learning/")) return { profile: null, roadmap: null, catalog: [], assignments: [{ id: "assignment", unitTitle: "Startup unit", stages: [], status: "active" }], planning: [{ plan: { id: "learning-plan" } }], scores: [], attemptHistory: [], skills: [], recommendations: [], queue: [], summary: {} };
    if (url.startsWith("/api/rewards?")) return { learningRewardEarned: 0 };
    throw Error("Unexpected endpoint: " + url);
  };
  const quiet = { log() {}, info() {}, warn() {}, error() {} };
  const chat = vm.createContext({ document, window, sessionStorage, localStorage, atob, AbortController, URLSearchParams, performance,
    Date: class extends Date { static now() { return now; } },
    setTimeout() {}, clearTimeout() {}, navigator: { onLine: true }, console: quiet,
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
    MutationObserver: class { observe() {} }, SUPABASE_CONFIG: realtime ? { url: "synthetic", publishableKey: "synthetic" } : {}, createClient: () => realtime,
    fetch: async url => ({ ok: true, status: 200, json: () => request(url) }),
  });
  let app;
  const moduleSource = file => read(file).replace(/^import .*;\r?\n/gm, "").replace(/\bexport /g, "");
  vm.runInContext(moduleSource("js/family-auth.js") + "\n" + moduleSource("js/family-chat.js"), chat);
  vm.runInContext("renderMessages=()=>{};renderPushButton=()=>{};syncExistingPushSubscription=async()=>{};", chat);
  const empty = () => ({ plans: [], bookPlans: [{ id: "cached-book" }], academySchedules: [], academyCompletions: [], rewardMilestones: [] });
  app = vm.createContext({ console: quiet, window, performance, URLSearchParams, structuredClone, $: node,
    configured: true, familyChatController: null, planAssignees: [], requestJson: request,
    familyAuthHeaders: () => ({ Authorization: `Bearer ${chat.restoreFamilyAuth()?.token || ""}` }), renderPlanAssignees() {},
    selectedPlanAssignee: () => selected,
    toDateInput: () => "2026-09-20", addDays: date => date, readLocalData: empty,
    localDataKey: () => "scoped-test", DEFAULT_REWARD: {}, normalizeRewardMilestones: value => value || [],
    normalizeLoadedPlan: value => value, normalizeLoadedBookPlan: value => value,
    normalizeLoadedAcademySchedule: value => value, normalizeLoadedAcademyCompletion: value => value,
    requestOrFallback: async (_label, promise, fallback) => { const result = await promise; return result.error ? { data: fallback } : result; },
    authGeneration: 0, authenticatedFeaturesTransition: null, completedAuthGeneration: -1, authMembersRefreshRequired: false, localStorage, authenticationTransition: null, remoteLoadGeneration: 0, stickerWalletSnapshot: null, state: empty(), emptyLocalData: empty,
    learningController: null, learningAnalysisController: null, learningMistakesController: null, learningReviewQueueController: null,
    analysisEntryScope: "", analysisEntryPromise: null,
    rewardStoreController: { async refresh() {} }, appReady: false, activeCacheKey: "", realtimeUnsubscribe: null,
    render() {}, renderHeader() {}, renderRoleControls() {}, ensureFormMode() {}, setConnectionStatus() {},
    startupMetrics: {}, startupStartedAt: performance.now(), deferStartupTask: fn => deferred.push(fn), reportStartupPerformance() {}, handleRepositoryError() {},
  });
  const source = read("js/app.js");
  vm.runInContext(section(source, "async function loadPlanAssignees(", "async function handlePlanAssigneeChange("), app);
  vm.runInContext(section(source, "  async function load({ essentialOnly", "  async function save(data)"), app);
  vm.runInContext(section(source, "function authenticatedStartupContext()", 'window.addEventListener("online"'), app);
  vm.runInContext(section(source, "function analysisViewVisible()", "async function learningOnboardingModel("), app);
  vm.runInContext(moduleSource("js/onboarding-learning.js") + "\n" + section(source, "async function learningOnboardingModel(", "async function openFirstLearningSetup("), app);
  app.initLearningMistakes = () => ({ reset() {} });
  app.requireSelectedPlanAssignee = () => selected;
  app.showToast = () => {};
  app.learningSetupPreference = { clear() {}, isDismissed: () => false };
  const onboarding = [];
  app.onboardingController = {
    hide() { onboarding.push("hide"); }, showChildRequired() { onboarding.push("CHILD_REQUIRED"); },
    showLearningReady() { onboarding.push("LEARNING_READY"); }, showLearningSetupOptional() { onboarding.push("LEARNING_SETUP_OPTIONAL"); },
  };
  app.switchView = view => {
    for (const id of ["parent", "today", "family-chat", "rewards", "progress"]) {
      if (id === view) node("#" + id).classList.add("active"); else node("#" + id).classList.remove("active");
    }
    app.familyChatController?.setActive(view === "family-chat");
  };
  app.repository = { load: app.load, subscribe: () => null };
  app.reloadFromRemote = async options => { app.state = await app.repository.load(options); };
  return {
    chat, app, calls, deferred, request,
    start: async options => { app.familyChatController = await chat.initFamilyChat(); return app.enterAuthenticatedApp(options); },
    count: endpoint => calls.filter(call => call.url.split("?")[0] === endpoint).length,
    setMembers: value => { responseMembers = value; }, fail: value => { fail = value; }, pending: value => { pending = value; },
    advance: ms => { now += ms; }, run: code => vm.runInContext(code, chat),
    select: value => { selected = value; }, respond: (endpoint, fn) => responses.set(endpoint, fn),
    node, window, onboarding, analysisConstructions: () => analysisConstructions,
    async fullStart(tab = "") {
      window.location.search = tab ? `?tab=${tab}` : "";
      app.familyChatController = await chat.initFamilyChat();
      return app.initializeAuthenticatedFeatures();
    },
    enableLearning() {
      const visible = new Set(["#childLearningAssignmentList", "#learningAnalysisSection", "#learningScoreSummary", "#learningAttemptHistory", "#learningSkillSummary", "#learningRecommendationSummary", "#learningProgressSummary", "#parentLearningReviewQueue", "#childLearningReviewQueue"]);
      const dom = { querySelector: selector => visible.has(selector) ? node(selector) : null, addEventListener() {}, body: element() };
      const dependencies = { requestJson: request, authHeaders: app.familyAuthHeaders, currentMember: () => app.familyChatController?.currentMember(), selectedAssignee: () => selected, requireSelectedAssignee: () => selected, showToast() {}, openReview() {} };
      for (const [file, init, key] of [["learning", "initLearning", "learningController"], ["learning-analysis", "initLearningAnalysis", "learningAnalysisController"], ["learning-review-queue", "initLearningReviewQueue", "learningReviewQueueController"]]) {
        const context = vm.createContext({ document: dom, console: quiet, crypto: require("node:crypto").webcrypto });
        const clean = name => read(name).replace(/^import[\s\S]*?from "[^"]+";\r?\n/gm, "").replace(/\bexport /g, "");
        vm.runInContext(clean("js/learning-today.js") + "\n" + clean("js/learning-progress.js") + "\n" + clean(`js/${file}.js`), context);
        if (file === "learning-analysis") app.initLearningAnalysis = options => { analysisConstructions++; return context[init](options); };
        else app[key] = context[init](dependencies);
      }
    },
  };
}

for (const saved of [false, true]) {
  test(`${saved ? "saved-device" : "in-tab"} parent startup uses one members request and defers book plans`, async () => {
    const h = harness({ saved }); await h.start();
    assert.equal(h.count("/api/family/session/restore"), Number(saved));
    assert.equal(h.count("/api/family/members"), 1);
    assert.deepEqual(Array.from(h.app.planAssignees, m => m.id), [CHILD.id]);
    assert.equal(h.app.appReady, true);
    assert.equal(h.count("/api/study/book-plans"), 0);
    assert.equal(h.app.state.bookPlans[0].id, "cached-book");
    assert.equal(h.deferred.length, 1);
    await h.deferred[0]();
    assert.equal(h.count("/api/study/book-plans"), 1);
    assert.equal(h.app.state.bookPlans[0].id, "book");
    assert.ok(h.calls.filter(c => c.url.startsWith("/api/study/book-plans")).every(c => c.essentialComplete));
    assert.equal(h.count("/api/family/members"), 1);
  });
}
test("saved-device child retains one members load and no parent book-plan requests", async () => {
  const h = harness({ saved: true, member: CHILD }); await h.start(); await h.deferred[0]();
  assert.equal(h.count("/api/family/session/restore"), 1);
  assert.equal(h.count("/api/family/members"), 1);
  assert.equal(h.count("/api/study/book-plans"), 0);
  assert.equal(h.app.planAssignees.length, 0);
  assert.equal(h.app.state.plans.length, 1);
});
test("successful empty children list is reusable, preserving child-required state", async () => {
  const h = harness({ members: [PARENT] }); await h.start();
  assert.equal(h.count("/api/family/members"), 1);
  assert.equal(h.app.planAssignees.length, 0);
  assert.equal(h.app.familyChatController.childCount(), 0);
  assert.equal(h.count("/api/study/plans"), 0);
});
for (const change of ["family", "member", "reset", "silent reset", "logout", "expired", "failed", "invalid"]) {
  test(`startup reuse rejects ${change} state and assignees fall back to server`, async () => {
    const h = harness(); await h.start();
    await h.app.familyChatController.refreshMembers();
    if (change === "family" || change === "member") {
      const member = { ...PARENT, ...(change === "family" ? { family_id: "family-b" } : { id: "parent-b" }) };
      h.chat.nextAuth = loginData(member); h.run("completeFamilyLogin(nextAuth)");
    }
    if (change === "reset") {
      h.run("clearFamilyAuth()");
      assert.equal(h.app.familyChatController.isAuthenticated(), false);
      assert.equal(h.app.familyChatController.takeStartupMembers(PARENT), null);
      h.chat.nextAuth = loginData(PARENT); h.run("completeFamilyLogin(nextAuth)");
    }
    if (change === "silent reset") h.run("clearFamilyAuth(false)");
    if (change === "logout") { h.run("logout(false)"); assert.equal(h.app.familyChatController.takeStartupMembers(PARENT), null); h.chat.nextAuth = loginData(PARENT); h.run("completeFamilyLogin(nextAuth)"); }
    if (change === "expired") h.advance(30001);
    if (change === "failed" || change === "invalid") {
      if (change === "failed") h.fail(true); else h.setMembers(null);
      await h.app.familyChatController.refreshMembers();
      h.fail(false); h.setMembers([PARENT, CHILD]);
    }
    const before = h.count("/api/family/members");
    await h.app.loadPlanAssignees({ reuseStartupMembers: true });
    assert.equal(h.count("/api/family/members"), before + 1);
    assert.deepEqual(Array.from(h.app.planAssignees, m => m.id), [CHILD.id]);
  });
}
test("handoff checks caller family and is single-use with detached DTOs", async () => {
  const h = harness(); await h.start(); const controller = h.app.familyChatController;
  await controller.refreshMembers();
  assert.equal(controller.takeStartupMembers({ ...PARENT, family_id: "family-b" }), null);
  await controller.refreshMembers();
  const members = controller.takeStartupMembers(PARENT); members[1].id = "mutated";
  assert.equal(controller.activeChildren()[0].id, CHILD.id);
  assert.equal(controller.takeStartupMembers(PARENT), null);
});
test("failed initial members load leaves authentication closed and later authenticated entry falls back", async () => {
  const h = harness(); h.fail(true);
  h.app.familyChatController = await h.chat.initFamilyChat();
  assert.equal(h.app.familyChatController.isAuthenticated(), false);
  assert.equal(h.app.familyChatController.takeStartupMembers(PARENT), null);
  h.fail(false); h.chat.nextAuth = loginData(PARENT); h.run("completeFamilyLogin(nextAuth)");
  await h.app.enterAuthenticatedApp();
  assert.equal(h.count("/api/family/members"), 2);
  assert.deepEqual(Array.from(h.app.planAssignees, m => m.id), [CHILD.id]);
});
test("child creation and explicit refresh obtain fresh assignees and member status", async () => {
  const h = harness({ members: [PARENT] }); await h.start();
  h.setMembers([PARENT, CHILD]);
  const before = h.count("/api/family/members");
  await h.app.familyChatController.refreshMembers({ throwOnError: true });
  await h.app.loadPlanAssignees({ throwOnError: true });
  assert.equal(h.count("/api/family/members"), before + 2);
  assert.deepEqual(Array.from(h.app.planAssignees, m => m.id), [CHILD.id]);
  assert.equal(h.app.familyChatController.childCount(), 1);
  h.setMembers([PARENT, { ...CHILD, is_active: false }]);
  await h.app.familyChatController.refreshMembers();
  await h.app.loadPlanAssignees();
  assert.equal(h.app.planAssignees.length, 0);
  assert.equal(h.app.familyChatController.childCount(), 0);
});
test("late previous-family response cannot overwrite fresh current-family reuse", async () => {
  const h = harness(); await h.start(); let resolve;
  h.pending(new Promise(done => { resolve = done; }));
  const old = h.app.familyChatController.refreshMembers();
  const otherParent = { ...PARENT, family_id: "family-b" }, otherChild = { ...CHILD, family_id: "family-b", id: "child-b" };
  h.chat.nextAuth = loginData(otherParent); h.run("completeFamilyLogin(nextAuth)");
  h.setMembers([otherParent, otherChild]); await h.app.familyChatController.refreshMembers();
  resolve({ members: [PARENT, CHILD] }); await old;
  assert.deepEqual(Array.from(h.app.familyChatController.takeStartupMembers(otherParent), m => m.id), [PARENT.id, "child-b"]);
});

for (const saved of [false, true]) {
  test(`${saved ? "saved" : "in-tab"} analysis destination startup shares exact learning requests and onboarding plans`, async () => {
    const h = harness({ saved }); h.enableLearning();
    const startup = await h.start({ shareOnboarding: true, analysisRequested: true });
    assert.equal((await h.app.learningOnboardingModel("", startup)).state, "LEARNING_READY");
    for (const endpoint of ["assignments", "review-queue", "plans"]) assert.equal(h.count(`/api/learning/${endpoint}`), 1, endpoint);
    assert.equal(h.count("/api/family/members"), 1);
    assert.equal(h.count("/api/study/book-plans"), 0);
    assert.match(h.node("#childLearningAssignmentList").innerHTML, /Startup unit/);
    assert.equal(h.node("#learningAnalysisSection").getAttribute("aria-busy"), "false");
    assert.equal(h.app.learningReviewQueueController.snapshot().failed, false);
    startup.close(); await h.deferred[0]();
    assert.equal(h.count("/api/study/book-plans"), 1);
    // Each explicit consumer refresh fetches new data; the startup pool is not permanent.
    await h.app.learningController.refresh({ force: true });
    await h.app.learningAnalysisController.refresh();
    await h.app.learningReviewQueueController.refresh();
    await h.app.learningOnboardingModel();
    for (const endpoint of ["assignments", "review-queue", "plans"]) assert.equal(h.count(`/api/learning/${endpoint}`), 3, endpoint);
  });
}
test("unselected parent onboarding fetches its first child independently", async () => {
  const h = harness(); h.select(""); h.enableLearning();
  const startup = await h.start({ shareOnboarding: true });
  assert.equal(h.count("/api/learning/plans"), 0);
  assert.equal((await h.app.learningOnboardingModel("", startup)).selectedChildId, CHILD.id);
  assert.equal(h.count("/api/learning/plans"), 1); startup.close();
});
test("saved child retains its own unqualified assignments and queue requests", async () => {
  const h = harness({ saved: true, member: CHILD }); h.enableLearning(); await h.start();
  assert.equal(h.count("/api/learning/assignments"), 1);
  assert.equal(h.count("/api/learning/review-queue"), 1);
  assert.equal(h.count("/api/learning/plans"), 0);
  assert.ok(h.calls.filter(c => /\/api\/learning\/(assignments|review-queue)/.test(c.url)).every(c => !c.url.includes("?")));
});
for (const endpoint of ["assignments", "review-queue", "plans"]) {
  test(`shared ${endpoint} failure preserves consumer degradation, first content and fresh retry`, async () => {
    const h = harness(); h.enableLearning(); let failing = true;
    h.respond(`/api/learning/${endpoint}`, () => { if (failing) throw Error("synthetic unavailable"); return { assignments: [], queue: [], planning: [{ plan: { id: "recovered" } }] }; });
    const startup = await h.start({ shareOnboarding: true, analysisRequested: true });
    assert.equal(h.app.appReady, true); assert.equal(h.app.state.plans.length, 1);
    assert.equal(h.count(`/api/learning/${endpoint}`), 1);
    if (endpoint === "review-queue") assert.equal(h.app.learningReviewQueueController.snapshot().failed, true);
    if (endpoint === "assignments" || endpoint === "plans") assert.match(h.node("#childLearningAssignmentList").innerHTML, /synthetic unavailable/);
    failing = false;
    if (endpoint === "plans") {
      assert.equal((await h.app.learningOnboardingModel("", startup)).state, "LEARNING_READY");
      assert.equal(h.count("/api/learning/plans"), 2);
    }
    startup.close(); await h.app.learningController.refresh({ force: true }); await h.app.learningAnalysisController.refresh(); await h.app.learningReviewQueueController.refresh();
    assert.equal(h.app.learningReviewQueueController.snapshot().failed, false);
    assert.doesNotMatch(h.node("#childLearningAssignmentList").innerHTML, /synthetic unavailable/);
  });
}
for (const change of ["child", "family", "member", "auth reset", "logout", "new session"]) {
  test(`shared learning scope discards late ${change} response`, async () => {
    const h = harness(); await h.start(); let resolve;
    const startup = h.app.createStartupLearningRequests();
    h.respond("/api/learning/assignments", () => new Promise(done => { resolve = done; }));
    const pending = startup.request(`/api/learning/assignments?assignedMemberId=${CHILD.id}`);
    const rejected = assert.rejects(pending, /Startup scope changed/);
    if (change === "child") h.select("child-b");
    else if (change === "auth reset") h.run("clearFamilyAuth()");
    else if (change === "logout") h.run("logout(false)");
    else { h.chat.nextAuth = loginData({ ...PARENT, ...(change === "family" ? { family_id: "family-b" } : change === "member" ? { id: "parent-b" } : {}) }); h.run("completeFamilyLogin(nextAuth)"); }
    resolve({ assignments: [{ id: "old" }] }); await rejected;
    assert.equal(startup.isCurrent(), false);
  });
}
test("exact query/header boundaries and detached consumer results", async () => {
  const h = harness(); await h.start(); const startup = h.app.createStartupLearningRequests();
  const url = `/api/learning/assignments?assignedMemberId=${CHILD.id}`;
  const a = await startup.request(url), b = await startup.request(url);
  a.assignments[0].unitTitle = "changed";
  assert.equal(b.assignments[0].unitTitle, "Startup unit");
  assert.equal(h.count("/api/learning/assignments"), 1);
  await startup.request("/api/learning/assignments?assignedMemberId=child-b");
  await startup.request(url, { headers: { Authorization: "different" } });
  assert.equal(h.count("/api/learning/assignments"), 3);
  startup.close(); await assert.rejects(startup.request(url), /Startup scope changed/);
});
test("late previous-child controller response cannot overwrite fresh child state", async () => {
  const h = harness(); h.enableLearning(); await h.start(); let resolve;
  h.respond("/api/learning/assignments", () => new Promise(done => { resolve = done; }));
  const startup = h.app.createStartupLearningRequests();
  const old = h.app.learningController.refresh({ force: true, startupRequests: startup });
  h.select("child-b");
  h.respond("/api/learning/assignments", () => ({ assignments: [{ id: "new", unitTitle: "New child unit", stages: [] }] }));
  await h.app.learningController.refresh({ force: true });
  resolve({ assignments: [{ id: "old", unitTitle: "Old child unit", stages: [] }] }); await old;
  assert.match(h.node("#childLearningAssignmentList").innerHTML, /New child unit/);
  assert.doesNotMatch(h.node("#childLearningAssignmentList").innerHTML, /Old child unit/);
});

test("unexpected startup failure disposes the sharing lifecycle", async () => {
  const h = harness(); let startup;
  const create = h.app.createStartupLearningRequests;
  h.app.createStartupLearningRequests = () => (startup = create());
  h.app.readLocalData = () => { throw Error("synthetic storage failure"); };
  await assert.rejects(h.start({ shareOnboarding: true }), /synthetic storage failure/);
  assert.equal(startup.isCurrent(), false);
});

const analysisOnly = ["scores", "attempt-history", "skills", "recommendations"];
for (const saved of [false, true]) {
  test(`${saved ? "saved" : "in-tab"} default startup skips hidden analysis; first entry loads once and explicit refresh stays fresh`, async () => {
    const h = harness({ saved }); h.enableLearning(); await h.fullStart();
    assert.equal(h.app.appReady, true); assert.equal(h.app.state.plans.length, 1);
    assert.equal(h.analysisConstructions(), 0);
    assert.equal(h.node("#learningAnalysisSection").getAttribute("aria-busy"), undefined);
    for (const endpoint of analysisOnly) assert.equal(h.count(`/api/learning/${endpoint}`), 0);
    assert.equal(h.calls.filter(c => c.url.startsWith("/api/rewards?")).length, 0);
    h.node("#parent").classList.add("active"); h.node("#parentPanelLearning").hidden = false;
    await Promise.all([h.app.ensureLearningAnalysis(), h.app.ensureLearningAnalysis(), h.app.ensureLearningAnalysis()]);
    assert.equal(h.analysisConstructions(), 1);
    for (const endpoint of analysisOnly) assert.equal(h.count(`/api/learning/${endpoint}`), 1);
    assert.equal(h.node("#learningAnalysisSection").getAttribute("aria-busy"), "false");
    assert.ok(h.node("#learningProgressSummary").innerHTML);
    await h.app.ensureLearningAnalysis();
    assert.equal(h.count("/api/learning/scores"), 1);
    await h.app.ensureLearningAnalysis({ force: true });
    assert.equal(h.count("/api/learning/scores"), 2);
    assert.equal(h.analysisConstructions(), 1);
  });
}
test("slow or failed scores cannot gate default startup; analysis entry exposes degraded UI", async () => {
  const h = harness(); h.enableLearning(); let resolve;
  h.respond("/api/learning/scores", () => new Promise(done => { resolve = done; }));
  await h.fullStart(); assert.equal(h.app.appReady, true); assert.equal(resolve, undefined);
  h.node("#parent").classList.add("active");
  const opening = h.app.ensureLearningAnalysis();
  assert.equal(h.node("#learningAnalysisSection").getAttribute("aria-busy"), "true");
  resolve({ scores: [] }); await opening;
  h.respond("/api/learning/scores", () => { throw Error("scores failed"); });
  await h.app.ensureLearningAnalysis({ force: true });
  assert.match(h.node("#learningScoreSummary").innerHTML, /learning-analysis-error/);
  assert.equal(h.app.appReady, true);
});
test("family-chat deep-link loads chat before blocked default data and never starts analysis", async () => {
  const h = harness({ saved: true }); h.enableLearning(); let release;
  h.respond("/api/study/plans", () => new Promise(done => { release = done; }));
  const starting = h.fullStart("family-chat");
  for (let i = 0; i < 50; i++) await Promise.resolve();
  assert.equal(h.node("#family-chat").classList.contains("active"), true);
  assert.equal(h.count("/api/family/messages"), 1);
  assert.equal(h.app.appReady, false);
  for (const endpoint of analysisOnly) assert.equal(h.count(`/api/learning/${endpoint}`), 0);
  release({ plans: [{ id: "plan" }] }); await starting;
  assert.equal(h.count("/api/family/messages"), 1);
});
test("analysis deep-link starts its own work before unrelated default data completes", async () => {
  const h = harness(); h.enableLearning(); let release;
  h.respond("/api/study/plans", () => new Promise(done => { release = done; }));
  const starting = h.fullStart("analysis");
  for (let i = 0; i < 70; i++) await Promise.resolve();
  assert.equal(h.node("#parent").classList.contains("active"), true);
  assert.equal(h.analysisConstructions(), 1);
  for (const endpoint of analysisOnly) assert.equal(h.count(`/api/learning/${endpoint}`), 1);
  assert.equal(h.node("#learningAnalysisSection").getAttribute("aria-busy"), "false");
  assert.equal(h.app.appReady, false);
  release({ plans: [] }); await starting;
  assert.equal(h.count("/api/learning/scores"), 1);
});
for (const tab of ["", "family-chat", "analysis"]) {
  test(`mandatory child onboarding precedes ${tab || "default"} screen without showing the app`, async () => {
    const h = harness({ members: [PARENT] }); h.enableLearning(); await h.fullStart(tab);
    assert.equal(h.onboarding[0], "CHILD_REQUIRED");
    assert.equal(h.onboarding.includes("hide"), false);
    assert.equal(h.count("/api/family/messages"), 0);
    assert.equal(h.analysisConstructions(), 0);
  });
}
test("optional setup never intercepts default or explicit destinations", async () => {
  for (const tab of ["", "family-chat", "analysis"]) {
    const h = harness(); h.enableLearning(); h.respond("/api/learning/plans", () => ({ planning: [] }));
    await h.fullStart(tab);
    assert.equal(h.onboarding.includes("LEARNING_SETUP_OPTIONAL"), false);
    assert.equal(h.app.appReady, true);
  }
});

for (const saved of [false, true]) for (const hasPlan of [false, true]) {
  test(`${saved ? "saved-device" : "in-tab"} parent with child and ${hasPlan ? "plan" : "no plan"} enters app within startup budget`, async () => {
    const h = harness({ saved }); h.enableLearning();
    h.respond("/api/learning/plans", () => ({ planning: hasPlan ? [{ plan: { id: "plan" } }] : [] }));
    h.respond("/api/learning/assignments", () => ({ assignments: [] }));
    await h.fullStart();
    assert.equal(h.app.appReady, true);
    assert.equal(h.onboarding.includes("LEARNING_SETUP_OPTIONAL"), false);
    assert.equal(h.onboarding.includes("CHILD_REQUIRED"), false);
    assert.ok(h.onboarding.includes(hasPlan ? "LEARNING_READY" : "hide"));
    assert.match(h.node("#childLearningAssignmentList").innerHTML, /아직 배정된 문제풀이 단원이 없습니다/);
    assert.doesNotMatch(h.node("#childLearningAssignmentList").innerHTML, /불러오는 중|learning-error/);
    assert.equal(h.count("/api/family/members"), 1);
    assert.equal(h.count("/api/study/book-plans"), 0);
    for (const endpoint of ["assignments", "review-queue", "plans"]) assert.equal(h.count(`/api/learning/${endpoint}`), 1);
    for (const endpoint of analysisOnly) assert.equal(h.count(`/api/learning/${endpoint}`), 0);
    const count = h.calls.length; await flush(); assert.equal(h.calls.length, count);
    h.app.openOptionalLearningSetup();
    assert.equal(h.onboarding.at(-1), "LEARNING_SETUP_OPTIONAL");
    assert.equal(h.calls.length, count, "explicit chooser uses already validated children without an extra fetch");
  });
}

test("child-role no-plan startup stays in app and cannot open parent setup", async () => {
  const h = harness({ member: CHILD }); h.enableLearning();
  h.respond("/api/learning/assignments", () => ({ assignments: [] }));
  await h.fullStart(); h.app.openOptionalLearningSetup();
  assert.equal(h.app.appReady, true);
  assert.equal(h.onboarding.includes("LEARNING_SETUP_OPTIONAL"), false);
  assert.equal(h.count("/api/learning/plans"), 0);
  assert.equal(h.count("/api/learning/scores"), 0);
});
test("hidden initialized analysis stays quiet across child changes and refreshes on next entry", async () => {
  const h = harness(); h.enableLearning(); await h.fullStart("analysis");
  h.node("#parent").classList.remove("active"); h.select("child-b");
  await h.app.ensureLearningAnalysis({ force: true });
  assert.equal(h.count("/api/learning/scores"), 1);
  h.node("#parent").classList.add("active"); await h.app.ensureLearningAnalysis();
  assert.equal(h.count("/api/learning/scores"), 2);
  assert.equal(h.analysisConstructions(), 1);
  assert.match(h.calls.filter(c => c.url.startsWith("/api/learning/scores")).at(-1).url, /child-b/);
});

test("auth renewal refreshes the currently visible analysis destination", async () => {
  const h = harness(); h.enableLearning(); await h.fullStart("analysis");
  vm.runInContext(section(read("js/app.js"), '\nwindow.addEventListener("family-auth-changed"', "let initializationPromise"), h.app);
  h.window.dispatchEvent({ type: "family-auth-changed", detail: { authenticated: true } });
  await h.app.authenticatedFeaturesTransition;
  assert.equal(h.count("/api/learning/scores"), 2);
  assert.equal(h.analysisConstructions(), 1);
  assert.equal(h.node("#learningAnalysisSection").getAttribute("aria-busy"), "false");
});

const flush = async () => { for (let i = 0; i < 100; i++) await Promise.resolve(); };
const gate = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

for (const consumer of ["learningController", "learningReviewQueueController"]) {
  test(`analysis deep-link pending survives fresh ${consumer} request and coordinator cleans up`, async () => {
    const h = harness(); h.enableLearning(); const pending = gate(); let first = true, store, listenerBaseline;
    const create = h.app.createStartupLearningRequests;
    h.app.createStartupLearningRequests = () => {
      listenerBaseline = h.window.listenerCount("family-auth-changed");
      return (store = create());
    };
    h.respond("/api/learning/assignments", () => {
      if (first) { first = false; return pending.promise; }
      return { assignments: [{ id: "fresh", unitTitle: "Fresh learning", stages: [] }] };
    });
    const starting = h.fullStart("analysis"); await flush();
    assert.equal(h.app.appReady, false);
    await h.app[consumer].refresh({ force: true });
    assert.equal(store.isCurrent(), true, "consumer must not close the coordinator's store");
    assert.equal(h.count(consumer === "learningController" ? "/api/learning/assignments" : "/api/learning/review-queue"), 2);
    pending.resolve({ assignments: [{ id: "shared", unitTitle: "Shared analysis", status: "active", stages: [] }] });
    await starting;
    assert.equal(h.node("#learningAnalysisSection").getAttribute("aria-busy"), "false");
    assert.match(h.node("#learningProgressSummary").innerHTML, /Shared analysis/);
    assert.equal(store.isCurrent(), false);
    assert.equal(h.window.listenerCount("family-auth-changed"), listenerBaseline);
    await assert.rejects(store.request("/api/learning/assignments"), /Startup scope changed/);
    await h.app.ensureLearningAnalysis();
    assert.equal(h.count("/api/learning/scores"), 1);
    if (consumer === "learningController") assert.match(h.node("#childLearningAssignmentList").innerHTML, /Fresh learning/);
  });
}

test("legitimately cancelled analysis entry can retry with the same auth and child", async () => {
  const h = harness(); h.enableLearning(); await h.fullStart();
  h.node("#parent").classList.add("active"); h.node("#parentPanelLearning").hidden = false;
  const pending = gate(), store = h.app.createStartupLearningRequests();
  h.respond("/api/learning/scores", () => pending.promise);
  const entry = h.app.ensureLearningAnalysis({ startupRequests: store });
  store.close(); pending.resolve({ scores: [] }); await entry;
  assert.equal(h.app.analysisEntryScope, "");
  await h.app.ensureLearningAnalysis();
  assert.equal(h.count("/api/learning/scores"), 2);
  assert.equal(h.node("#learningAnalysisSection").getAttribute("aria-busy"), "false");
});

// Keep the actual repository generation/cache guards and the actual auth event
// handler in these races; transport, presentation and realtime transport are stubs.
function useAuthLifecycle(h) {
  const subscriptions = [], readiness = [], stores = [];
  Object.assign(h.app, {
    navigator: { onLine: true }, remoteLoadPromise: null,
    applyStickerWalletData: value => value, writeLocalData() {}, markOverduePlans: async () => {},
    localDataKey: () => JSON.stringify(h.chat.restoreFamilyAuth()?.member || null),
  });
  let ready = false;
  Object.defineProperty(h.app, "appReady", {
    get: () => ready,
    set: value => { ready = value; if (value) readiness.push(h.chat.restoreFamilyAuth()?.member?.id || null); },
    configurable: true,
  });
  const create = h.app.createStartupLearningRequests;
  h.app.createStartupLearningRequests = () => { const store = create(); stores.push(store); return store; };
  h.app.repository.subscribe = () => { const row = { member: h.chat.restoreFamilyAuth()?.member?.id, active: true }; subscriptions.push(row); return () => { row.active = false; }; };
  const source = read("js/app.js");
  vm.runInContext(section(source, "async function reloadFromRemote(", "function deferStartupTask("), h.app);
  vm.runInContext(section(source, '\nwindow.addEventListener("family-auth-changed"', "let initializationPromise"), h.app);
  return { subscriptions, readiness, stores };
}
function authenticate(h, member) {
  h.setMembers([member, { ...CHILD, family_id: member.family_id }]);
  h.chat.nextAuth = loginData(member); h.run("completeFamilyLogin(nextAuth)");
}

test("early family-chat auth change while not ready serializes fresh startup and only new auth finalizes", async () => {
  const h = harness(); h.enableLearning(); const audit = useAuthLifecycle(h), pending = gate(); let first = true;
  h.respond("/api/study/plans", () => { if (first) { first = false; return pending.promise; } return { plans: [{ id: "new-context" }] }; });
  const starting = h.fullStart("family-chat"); await flush();
  assert.equal(h.node("#family-chat").classList.contains("active"), true);
  assert.equal(h.app.appReady, false);
  authenticate(h, { ...PARENT, id: "parent-b", family_id: "family-b" }); await flush();
  assert.equal(audit.stores[0].isCurrent(), false);
  assert.equal(audit.subscriptions.length, 0);
  pending.resolve({ plans: [{ id: "obsolete" }] }); await starting; await flush();
  assert.deepEqual(audit.readiness, ["parent-b"]);
  assert.deepEqual(audit.subscriptions.map(s => s.member), ["parent-b"]);
  assert.equal(h.app.state.plans[0].id, "new-context");
  assert.equal(h.deferred.length, 1);
  assert.equal(h.count("/api/learning/scores"), 0);
  assert.ok(audit.stores.every(store => !store.isCurrent()));
});

for (const reset of ["logout(false)", "clearFamilyAuth()"])
test(`${reset} wins over pending startup readiness, subscriptions, deferred work and chat response`, async () => {
  const h = harness(); h.enableLearning(); const audit = useAuthLifecycle(h), pending = gate(), messages = gate();
  h.respond("/api/study/plans", () => pending.promise);
  h.respond("/api/family/messages", () => messages.promise);
  const starting = h.fullStart("family-chat"); await flush();
  h.run(reset); await flush();
  pending.resolve({ plans: [{ id: "obsolete" }] });
  messages.resolve({ messages: [{ id: "old-message", body: "obsolete" }], unread: 1 });
  await starting; await flush();
  assert.equal(h.app.appReady, false);
  assert.equal(h.app.state.plans.length, 0);
  assert.equal(h.run("state.messages.length"), 0);
  assert.deepEqual(audit.readiness, []);
  assert.equal(audit.subscriptions.length, 0);
  assert.equal(h.deferred.length, 0);
  assert.ok(audit.stores.every(store => !store.isCurrent()));
});

test("chat realtime auth resolving after logout cannot install an obsolete channel", async () => {
  const pending = gate(), channels = [];
  const realtime = { realtime: { setAuth: () => pending.promise }, removeChannel() {}, channel: name => {
    const channel = { name, on() { return this; }, subscribe() { channels.push(this); return this; } };
    return channel;
  } };
  const h = harness({ realtime }); await h.start();
  h.app.familyChatController.setActive(true); await flush();
  h.run("logout(false)"); pending.resolve(); await flush();
  assert.equal(channels.length, 0);
  authenticate(h, { ...PARENT, id: "parent-b" });
  h.app.familyChatController.setActive(true); await flush();
  assert.equal(channels.length, 1);
  assert.match(channels[0].name, /parent-b/);
});

test("auth transition waits for pending reward controller construction instead of binding twice", async () => {
  const h = harness(); h.enableLearning(); const audit = useAuthLifecycle(h), pending = gate(); let constructions = 0;
  h.app.rewardStoreController = null;
  h.app.handleStickerWalletLoaded = () => {};
  h.app.initRewardStore = () => { constructions++; return pending.promise; };
  const starting = h.fullStart(); await flush();
  authenticate(h, { ...PARENT, id: "parent-b" }); await flush();
  assert.equal(constructions, 1);
  assert.equal(h.app.appReady, false);
  pending.resolve({ async refresh() {} }); await starting;
  assert.equal(constructions, 1);
  assert.deepEqual(audit.readiness, ["parent-b"]);
  assert.equal(audit.subscriptions.length, 1);
});

for (const startB of [false, true]) {
  test(`rapid A-B-C transitions ${startB ? "invalidate running B" : "coalesce obsolete B"} without duplicate subscription`, async () => {
    const h = harness(); h.enableLearning(); const audit = useAuthLifecycle(h), a = gate(), b = gate();
    h.respond("/api/study/plans", () => {
      const id = h.chat.restoreFamilyAuth()?.member.id;
      return id === PARENT.id ? a.promise : id === "parent-b" ? b.promise : { plans: [{ id: "context-c" }] };
    });
    const starting = h.fullStart(); await flush();
    authenticate(h, { ...PARENT, id: "parent-b" });
    if (startB) { a.resolve({ plans: [{ id: "context-a" }] }); await flush(); assert.equal(audit.stores.length, 2); }
    authenticate(h, { ...PARENT, id: "parent-c" }); await flush();
    a.resolve({ plans: [{ id: "context-a" }] }); b.resolve({ plans: [{ id: "context-b" }] });
    await starting; await flush();
    assert.deepEqual(audit.readiness, ["parent-c"]);
    assert.deepEqual(audit.subscriptions.map(s => s.member), ["parent-c"]);
    assert.equal(h.app.state.plans[0].id, "context-c");
    assert.equal(audit.stores.length, startB ? 3 : 2);
    assert.equal(h.deferred.length, 1);
  });
}

test("old queued and already-running deferred work cannot populate the new context", async () => {
  const h = harness(); h.enableLearning(); const audit = useAuthLifecycle(h); await h.fullStart();
  const oldDeferred = h.deferred[0], pending = gate(); let first = true;
  h.respond("/api/study/plans", () => { if (first) { first = false; return pending.promise; } return { plans: [{ id: "context-b" }] }; });
  const oldWork = oldDeferred(); await flush();
  authenticate(h, { ...PARENT, id: "parent-b" }); await h.app.authenticatedFeaturesTransition;
  pending.resolve({ plans: [{ id: "obsolete-deferred" }] }); await oldWork;
  assert.equal(h.app.state.plans[0].id, "context-b");
  const before = h.calls.length; await oldDeferred(); assert.equal(h.calls.length, before);
  assert.equal(audit.subscriptions.filter(s => s.active).length, 1);
  assert.deepEqual(audit.readiness, [PARENT.id, "parent-b"]);
});

test("late assignees cannot populate the next family and fresh members decide mandatory onboarding", async () => {
  const h = harness(); h.enableLearning(); const audit = useAuthLifecycle(h);
  h.app.familyChatController = await h.chat.initFamilyChat();
  h.app.familyChatController.takeStartupMembers(PARENT);
  const pending = gate(); h.pending(pending.promise);
  const starting = h.app.initializeAuthenticatedFeatures(); await flush();
  const next = { ...PARENT, id: "parent-b", family_id: "family-b" };
  authenticate(h, next); h.setMembers([next]); h.select("");
  pending.resolve({ members: [{ ...CHILD, id: "obsolete-child" }] }); await starting;
  assert.equal(h.app.planAssignees.length, 0);
  assert.ok(h.onboarding.includes("CHILD_REQUIRED"));
  assert.equal(h.onboarding.at(-1), "CHILD_REQUIRED");
  assert.deepEqual(audit.readiness, ["parent-b"]);
});

for (const outcome of ["success", "401", "logout"]) {
  test(`reward response after ${outcome === "logout" ? "logout" : "same-key family transition"} cannot publish stale data (${outcome})`, async () => {
    const nodes = new Map(), pending = gate(), timers = [], published = [];
    let auth = loginData(PARENT), clears = 0;
    const node = key => { if (!nodes.has(key)) nodes.set(key, element()); return nodes.get(key); };
    const window = Object.assign(element(), { setTimeout: fn => timers.push(fn) });
    const context = vm.createContext({
      document: { querySelector: node, addEventListener() {} }, window, performance,
      console: { info() {}, error() {} }, localStorage: storage(), sessionStorage: storage(), TOKEN_KEY: "token",
      restoreFamilyAuth: () => auth, clearFamilyAuth: () => { clears++; },
      fetch: () => pending.promise,
    });
    vm.runInContext(read("js/reward-store.js").replace(/^import .*;\r?\n/gm, "").replace(/\bexport /g, ""), context);
    // Exercise actual refresh and auth binding; presentation does not own auth state.
    context.publish = value => published.push(value);
    vm.runInContext("render=()=>{};onStickerData=publish;bind();", context);
    const loading = context.refresh();
    auth = outcome === "logout" ? null : loginData({ ...PARENT, family_id: "family-b", id: "parent-b" });
    window.dispatchEvent({ type: "family-auth-changed", detail: { authenticated: Boolean(auth) } });
    pending.resolve({ ok: outcome !== "401", status: outcome === "401" ? 401 : 200, json: async () => ({ viewer: { role: "parent" }, balance: 999 }) });
    await loading; await flush();
    assert.deepEqual(published, []);
    assert.equal(vm.runInContext("state.data", context), null);
    assert.equal(clears, 0, "an obsolete 401 must not clear a new session");
    assert.equal(timers.length, 1, "fresh refresh is scheduled after the old owner releases loading");
  });
}
