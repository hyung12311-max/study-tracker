const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("NEW_VISITOR receives Welcome instead of the default Family directory", () => {
  const app = read("js/app.js");
  const family = read("js/family-chat.js");
  const context = read("server/api/family/context.js");
  assert.match(app, /showWelcome/);
  assert.match(family, /hasFamilyContext/);
  assert.match(family, /\/api\/family\/context/);
  assert.doesNotMatch(context, /allowLegacyDefault|family_key=eq\.default/);
});

test("Welcome and registration markup is mobile-first and accessible", () => {
  const html = read("index.html");
  const css = read("css/styles.css");
  for (const id of ["onboardingView", "createFamilyButton", "existingFamilyButton", "onboardingForm", "onboardingFamilyName", "onboardingParentName", "onboardingParentPin", "onboardingParentPinConfirm", "onboardingRememberDevice", "onboardingError", "onboardingChildRequired"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(html, /inputmode="numeric"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /role="alert"/);
  assert.match(css, /@media \(max-width: 480px\)[\s\S]*onboarding-card/);
  assert.match(css, /min-height:\s*44px/);
});

test("Onboarding module validates PIN, confirmation and weak values before fetch", async () => {
  const module = await import(`../js/onboarding.js?test=${Date.now()}`);
  const valid = module.validateRegistration({ familyDisplayName: "우리 가족", parentDisplayName: "엄마", parentPin: "7392", parentPinConfirm: "7392" });
  assert.equal(valid.ok, true);
  assert.equal(module.validateRegistration({ ...valid.value, parentPinConfirm: "7393" }).code, "PIN_CONFIRMATION_MISMATCH");
  assert.equal(module.validateRegistration({ ...valid.value, parentPin: "1234", parentPinConfirm: "1234" }).code, "WEAK_PARENT_PIN");
  assert.equal(module.validateRegistration({ ...valid.value, familyDisplayName: "" }).field, "familyDisplayName");
  assert.equal(module.validateRegistration({ ...valid.value, parentDisplayName: "" }).field, "parentDisplayName");
});

test("Request ID is retained for retry and reset only for an explicit changed attempt", async () => {
  const module = await import(`../js/onboarding.js?request=${Date.now()}`);
  let sequence = 0;
  const state = module.createRequestState(() => `${++sequence}`);
  const first = state.forPayload("same");
  assert.equal(state.forPayload("same"), first);
  assert.notEqual(state.forPayload("changed"), first);
});

test("Submit and auth handoff contracts prevent duplicate POST and avoid sensitive rendering", () => {
  const source = read("js/onboarding.js");
  const app = read("js/app.js");
  assert.match(source, /if \(submitting\) return/);
  assert.match(source, /POST/);
  assert.match(source, /onboardingRequestId/);
  assert.match(source, /rememberDevice/);
  assert.match(app, /acceptRegistration/);
  assert.match(source, /CHILD_REQUIRED/);
  assert.doesNotMatch(source, /localStorage\.setItem\([^\n]*(?:parentPin|token|cookie)/);
  assert.doesNotMatch(source, /textContent\s*=\s*(?:data\.)?(?:token|realtimeToken|family_id|member_key)/);
});

test("Safe errors cover validation, conflict, rate limit and response loss", async () => {
  const module = await import(`../js/onboarding.js?errors=${Date.now()}`);
  assert.match(module.onboardingErrorMessage("ONBOARDING_VALIDATION_FAILED"), /확인/);
  assert.match(module.onboardingErrorMessage("IDEMPOTENCY_CONFLICT"), /새 등록/);
  assert.match(module.onboardingErrorMessage("ONBOARDING_RATE_LIMITED"), /잠시/);
  assert.match(module.onboardingErrorMessage("NETWORK_ERROR"), /같은 정보/);
});

test("Existing Parent and Child bypass Welcome and Parent with no Child resumes CHILD_REQUIRED", () => {
  const app = read("js/app.js");
  assert.match(app, /isAuthenticated\(\)[\s\S]*enterAuthenticatedApp/);
  assert.match(app, /role\s*===\s*["']parent["']/);
  assert.match(app, /childCount\(\)\s*===\s*0/);
  assert.match(app, /showChildRequired/);
});

function storedSession(role = "parent", exp = Math.floor(Date.now() / 1000) + 3600) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  const member = { id: "parent-id", family_id: "family-id", member_key: "parent-key", role };
  return {
    member,
    token: `${encode({ sub: member.id, family: member.family_id, key: member.member_key, role, exp })}.signature`,
    realtimeToken: `${encode({ alg: "HS256" })}.${encode({ sub: member.id, exp })}.signature`,
  };
}

async function childHarness(t, onChildCreated = async () => ({})) {
  const { initOnboarding } = await import("../js/onboarding.js");
  const { AUTH_KEY } = await import("../js/family-auth.js");
  const storage = {};
  for (const name of ["sessionStorage", "localStorage"]) {
    const original = Object.getOwnPropertyDescriptor(globalThis, name);
    const values = new Map();
    storage[name] = values;
    Object.defineProperty(globalThis, name, { configurable: true, value: {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: key => values.delete(key),
    } });
    t.after(() => {
      if (original) Object.defineProperty(globalThis, name, original);
      else delete globalThis[name];
    });
  }
  const setSession = auth => {
    if (auth === null) storage.sessionStorage.delete(AUTH_KEY);
    else storage.sessionStorage.set(AUTH_KEY, JSON.stringify(auth));
  };
  const session = storedSession();
  setSession(session);
  const nodes = new Map(), calls = [];
  function node(id) {
    if (!nodes.has(id)) nodes.set(id, {
      value: "", dataset: {}, hidden: false, disabled: false, textContent: "",
      elements: { avatarEmoji: { value: "🧒" } }, listeners: {}, attributes: {},
      addEventListener(event, handler) { this.listeners[event] = handler; },
      setAttribute(key, value) { this.attributes[key] = value; },
      removeAttribute(key) { delete this.attributes[key]; },
      focus() {}, querySelector() { return null; }, querySelectorAll() { return []; },
      replaceChildren() {}, append() {},
      reset() { node("onboardingChildName").value = ""; this.elements.avatarEmoji.value = "🧒"; },
    });
    return nodes.get(id);
  }
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", { configurable: true, value: { getElementById: node, createElement: () => ({}) } });
  t.after(() => {
    if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
    else delete globalThis.document;
  });
  let sequence = 0;
  t.mock.method(globalThis.crypto, "randomUUID", () => `10000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`);
  let attempt = async () => ({ ok: false, status: 500, json: async () => ({ code: "CHILD_CREATION_FAILED" }) });
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push({ url, options, body: JSON.parse(options.body) });
    return attempt();
  });
  const controller = initOnboarding({ onAuthenticated: async () => {}, onChildCreated });
  return {
    calls, node, session, setSession, storage, controller,
    setAttempt(value) { attempt = value; },
    async submit(name = "  Ａlice  ", avatar = "🧒") {
      node("onboardingChildName").value = name;
      node("onboardingChildForm").elements.avatarEmoji.value = avatar;
      await node("onboardingChildForm").listeners.submit({ preventDefault() {} });
    },
  };
}

const childSuccessBody = created => ({ ok: true, created, child: { id: "20000000-0000-4000-8000-000000000002", displayName: "Alice", avatarEmoji: "🧒", role: "child", isActive: true }, onboardingState: "LEARNING_SETUP_OPTIONAL" });
const childSuccess = created => ({ ok: true, status: created ? 201 : 200, json: async () => childSuccessBody(created) });

test("Product child POST reads current parent session and emits Bearer without harness injection", async t => {
  const h = await childHarness(t);
  const logs = [];
  for (const method of ["log", "info", "warn", "error", "debug", "trace"]) {
    t.mock.method(console, method, (...args) => logs.push(args));
  }
  await h.submit();
  const current = storedSession("parent", Math.floor(Date.now() / 1000) + 7200);
  h.setSession(current);
  await h.submit();
  for (const [index, token] of [h.session.token, current.token].entries()) {
    const { url, options, body } = h.calls[index];
    assert.equal(url, "/api/family/children");
    assert.equal(options.method, "POST");
    assert.equal(options.credentials, "same-origin");
    assert.equal(options.cache, "no-store");
    assert.deepEqual(options.headers, { "Content-Type": "application/json", Authorization: `Bearer ${token}` });
    assert.deepEqual(body, { clientRequestId: h.calls[0].body.clientRequestId, displayName: "Alice", avatarEmoji: "🧒" });
    assert.equal(url.includes(token), false);
    assert.equal(options.body.includes(token), false);
    assert.equal(JSON.stringify(logs).includes(token), false);
    assert.equal(h.node("onboardingChildError").textContent.includes(token), false);
  }
  assert.equal(h.storage.localStorage.size, 0);
  assert.equal(h.storage.sessionStorage.size, 1);
});

for (const invalid of ["missing", "malformed", "expired", "child", "mismatched"]) {
  test(`Child ${invalid} session rejects before fetch and recovers after parent login`, async t => {
    const h = await childHarness(t);
    const auth = storedSession(invalid === "child" ? "child" : "parent", invalid === "expired" ? 1 : undefined);
    if (invalid === "malformed") auth.token = "invalid-token";
    if (invalid === "mismatched") auth.member.id = "different-member";
    h.setSession(invalid === "missing" ? null : auth);
    await h.submit();
    assert.equal(h.calls.length, 0);
    assert.match(h.node("onboardingChildError").textContent, /인증된 부모/);
    assert.equal(h.node("onboardingChildSubmit").disabled, false);
    assert.equal(h.node("onboardingChildSubmit").attributes["aria-busy"], undefined);
    h.setSession(h.session);
    await h.submit();
    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0].options.headers.Authorization, `Bearer ${h.session.token}`);
    assert.equal(h.calls[0].body.clientRequestId, "10000000-0000-4000-8000-000000000001");
  });
}

test("Child pending retries retain ID while normalized payload changes get a new ID", async t => {
  const h = await childHarness(t);
  await h.submit();
  await h.submit("Alice", "");
  await h.submit("Bob");
  await h.submit("Bob", "🐻");
  assert.deepEqual(h.calls.map(call => call.body.clientRequestId), [1, 1, 2, 3].map(n => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`));
  assert.deepEqual(h.calls[0].body, { clientRequestId: h.calls[0].body.clientRequestId, displayName: "Alice", avatarEmoji: "🧒" });
});

for (const created of [true, false]) {
  test(`Child successful ${created ? "201 creation" : "200 replay"} consumes ID for an identical next request`, async t => {
    const h = await childHarness(t);
    await h.submit(); // Pending request failed; retain its ID for the successful retry.
    h.setAttempt(async () => childSuccess(created));
    await h.submit();
    assert.equal(h.node("onboardingView").dataset.onboardingState, "LEARNING_SETUP_OPTIONAL");
    assert.equal(h.node("onboardingChildName").value, "");
    await h.submit();
    assert.equal(h.calls[0].body.clientRequestId, h.calls[1].body.clientRequestId);
    assert.notEqual(h.calls[2].body.clientRequestId, h.calls[1].body.clientRequestId);
    assert.equal(h.calls[2].body.displayName, h.calls[0].body.displayName);
    for (const call of h.calls) {
      assert.equal(call.url, "/api/family/children");
      assert.equal(call.options.method, "POST");
      assert.equal(call.options.credentials, "same-origin");
      assert.deepEqual(Object.keys(call.body).sort(), ["avatarEmoji", "clientRequestId", "displayName"]);
    }
  });
}

for (const failure of ["network", "HTTP", "validation"]) {
  test(`Child ${failure} failure preserves the pending request ID`, async t => {
    const h = await childHarness(t, async () => { throw new Error("handoff failed"); });
    await h.submit();
    const firstId = h.calls[0].body.clientRequestId;
    if (failure === "network") h.setAttempt(async () => { throw new Error("network failed"); });
    if (failure === "validation") await h.submit("");
    else await h.submit();
    await h.submit();
    assert.equal(h.calls.length, failure === "validation" ? 2 : 3);
    assert.ok(h.calls.every(call => call.body.clientRequestId === firstId));
    assert.equal(h.node("onboardingChildSubmit").disabled, false);
    assert.equal(h.node("onboardingChildSubmit").attributes["aria-busy"], undefined);
  });
}

for (const failure of ["members", "assignees", "missing child"]) {
  test(`Real app child callback recovers from ${failure} without repeating creation`, async t => {
    const app = read("js/app.js"), family = read("js/family-chat.js");
    const extract = (source, start, end) => {
      const from = source.indexOf(start), to = source.indexOf(end, from + start.length);
      assert.ok(from >= 0 && to > from);
      return source.slice(from, to);
    };
    let failing = true;
    const refreshedChild = { id: childSuccessBody(true).child.id, display_name: "Alice", avatar_emoji: "🧒", role: "child", is_active: true };
    const selector = { value: "", disabled: false, options: [], replaceChildren() { this.options = []; }, append(option) { this.options.push(option); } };
    const context = vm.createContext({
      state: { members: [], token: "test", selectedId: "" }, planAssignees: [],
      console: { info() {}, warn() {}, error() {} },
      renderChoices() {}, renderAdmin() {}, updatePlanAssigneeSummary() {},
      $: () => selector, document: { createElement: () => ({}) },
      sessionStorage: { getItem: () => "", setItem() {} },
      restoreFamilyAuth: () => null, authGeneration: 0,
      planAssigneeStorageKey: () => "", selectedPlanAssignee: () => "", familyAuthHeaders: () => ({}),
      request: async () => {
        if (failing && failure === "members") throw new Error("members unavailable");
        return { members: failing && failure === "missing child" ? [] : [refreshedChild] };
      },
      requestJson: async url => {
        if (url === "/api/family/members") {
          if (failing && failure === "assignees") throw new Error("assignees unavailable");
          return { members: [refreshedChild] };
        }
        return { planning: [] };
      },
    });
    vm.runInContext(
      extract(app, "function authenticatedStartupContext()", "function createStartupLearningRequests()") + "\n" +
      extract(family, "let membersLoadVersion=", "async function openLogin(") + "\n" +
      extract(app, "function renderPlanAssignees(", "async function handlePlanAssigneeChange(") + "\n" +
      extract(app, "async function learningOnboardingModel(", "async function evaluateLearningOnboarding(") + "\n" +
      read("js/onboarding-learning.js").replace(/export /g, ""), context);
    context.familyChatController = {
      currentMember: () => ({ role: "parent" }), refreshMembers: context.loadMembers,
      activeChildren: () => context.state.members.filter(child => child.role === "child" && child.is_active !== false),
    };
    const callback = vm.runInContext("(" + extract(app, "onChildCreated: async (data) => {", "}, onOpenLearning:").replace("onChildCreated:", "") + "})", context);
    const h = await childHarness(t, callback);
    h.setAttempt(async () => childSuccess(true));
    await h.submit();
    assert.equal(h.node("onboardingView").dataset.onboardingState, "CHILD_CREATED_REFRESH_REQUIRED");
    if (failure === "members") assert.equal(context.state.membersError, "load-failed");
    if (failure === "assignees") {
      assert.equal(selector.disabled, true);
      assert.match(selector.options[0].textContent, /새로고침하지 못/);
      assert.doesNotMatch(selector.options[0].textContent, /활성 자녀가 없습니다/);
    }
    await h.submit();
    assert.equal(h.calls.length, 1);
    failing = false;
    await h.submit();
    assert.equal(h.calls.length, 1);
    assert.equal(h.node("onboardingView").dataset.onboardingState, "LEARNING_SETUP_OPTIONAL");
    assert.equal(context.state.members[0].id, refreshedChild.id);
    assert.equal(context.planAssignees[0].id, refreshedChild.id);
    assert.equal(selector.disabled, false);
  });
}

test("Child double-submit guard covers fetch and asynchronous success handoff", async t => {
  let finishFetch, finishHandoff, handoffStarted;
  const started = new Promise(resolve => { handoffStarted = resolve; });
  const handoff = new Promise(resolve => { finishHandoff = resolve; });
  const h = await childHarness(t, async () => { handoffStarted(); await handoff; return {}; });
  h.setAttempt(() => new Promise(resolve => { finishFetch = resolve; }));
  const pending = h.submit();
  await h.submit();
  assert.equal(h.calls.length, 1);
  assert.equal(h.node("onboardingChildSubmit").disabled, true);
  assert.equal(h.node("onboardingChildSubmit").attributes["aria-busy"], "true");
  finishFetch(childSuccess(true));
  await started;
  await h.submit();
  assert.equal(h.calls.length, 1);
  finishHandoff();
  await pending;
  assert.equal(h.node("onboardingChildSubmit").disabled, false);
  assert.equal(h.node("onboardingChildSubmit").attributes["aria-busy"], undefined);
  h.setAttempt(async () => childSuccess(true));
  await h.submit();
  assert.notEqual(h.calls[0].body.clientRequestId, h.calls[1].body.clientRequestId);
});

for (const [label, json] of [
  ["body read rejection", async () => { throw new Error("connection interrupted"); }],
  ["malformed JSON", async () => JSON.parse('{"ok":true,')],
  ["empty object", async () => ({})],
  ["null body", async () => null],
  ["missing ok", async () => ({ created: true, child: childSuccessBody(true).child })],
  ["false ok", async () => ({ ...childSuccessBody(true), ok: false })],
  ["missing created", async () => ({ ok: true, child: childSuccessBody(true).child })],
  ["non-boolean created", async () => ({ ...childSuccessBody(true), created: "true" })],
  ["missing child", async () => ({ ok: true, created: true })],
  ["missing child ID", async () => ({ ...childSuccessBody(true), child: {} })],
  ["invalid child ID", async () => ({ ...childSuccessBody(true), child: { id: "invalid" } })],
]) {
  test(`Child ${label} preserves ID until a valid retry completes`, async t => {
    let callbacks = 0;
    const h = await childHarness(t, async () => { callbacks++; return {}; });
    h.setAttempt(async () => ({ ok: true, status: 201, json }));
    await h.submit();
    assert.equal(callbacks, 0);
    assert.equal(h.node("onboardingChildName").value, "  Ａlice  ");
    assert.notEqual(h.node("onboardingView").dataset.onboardingState, "LEARNING_SETUP_OPTIONAL");
    assert.notEqual(h.node("onboardingChildError").textContent, "");
    assert.equal(h.node("onboardingChildSubmit").disabled, false);
    assert.equal(h.node("onboardingChildSubmit").attributes["aria-busy"], undefined);
    h.setAttempt(async () => childSuccess(false));
    await h.submit();
    assert.equal(callbacks, 1);
    assert.equal(h.calls[0].body.clientRequestId, h.calls[1].body.clientRequestId);
    assert.equal(h.node("onboardingView").dataset.onboardingState, "LEARNING_SETUP_OPTIONAL");
    h.setAttempt(async () => childSuccess(true));
    await h.submit();
    assert.equal(callbacks, 2);
    assert.notEqual(h.calls[1].body.clientRequestId, h.calls[2].body.clientRequestId);
  });
}

test("Child transition exception retains committed context and retries without POST", async t => {
  const h = await childHarness(t);
  h.setAttempt(async () => childSuccess(true));
  const panel = h.node("onboardingLearningSetup");
  panel.querySelector = () => { throw new Error("transition failed"); };
  await h.submit();
  assert.notEqual(h.node("onboardingChildError").textContent, "");
  assert.equal(h.node("onboardingChildSubmit").disabled, false);
  assert.equal(h.node("onboardingChildSubmit").attributes["aria-busy"], undefined);
  panel.querySelector = () => null;
  h.setAttempt(async () => childSuccess(false));
  await h.submit();
  assert.equal(h.calls.length, 1);
  assert.equal(h.node("onboardingView").dataset.onboardingState, "LEARNING_SETUP_OPTIONAL");
  await h.submit();
  assert.equal(h.calls.length, 2);
  assert.notEqual(h.calls[0].body.clientRequestId, h.calls[1].body.clientRequestId);
});

for (const failure of ["members", "assignees"]) {
  test(`Child ${failure} refresh failure keeps committed child and retries refresh only`, async t => {
    let failing = true;
    const contexts = [];
    const h = await childHarness(t, async data => {
      contexts.push(data);
      if (failing) throw new Error(`${failure} unavailable`);
      return { children: [{ id: data.child.id, display_name: data.child.displayName }], selectedChildId: data.child.id };
    });
    h.setAttempt(async () => childSuccess(true));
    await h.submit();
    assert.equal(h.calls.length, 1);
    assert.equal(h.node("onboardingView").dataset.onboardingState, "CHILD_CREATED_REFRESH_REQUIRED");
    assert.match(h.node("onboardingChildError").textContent, /추가는 완료/);
    assert.equal(h.node("onboardingChildSubmit").textContent, "목록 새로고침");
    await h.submit("Accidental second registration");
    assert.equal(h.calls.length, 1);
    assert.equal(h.node("onboardingView").dataset.onboardingState, "CHILD_CREATED_REFRESH_REQUIRED");
    failing = false;
    await h.submit();
    assert.equal(h.calls.length, 1);
    assert.equal(contexts.length, 3);
    assert.ok(contexts.every(data => data.child.id === childSuccessBody(true).child.id));
    assert.equal(h.node("onboardingView").dataset.onboardingState, "LEARNING_SETUP_OPTIONAL");
    assert.equal(h.node("onboardingChildSubmit").disabled, false);
    await h.submit();
    assert.equal(h.calls.length, 2);
    assert.notEqual(h.calls[0].body.clientRequestId, h.calls[1].body.clientRequestId);
  });
}

test("Family management offers child entry only for an active authenticated parent and preserves member rows", () => {
  const source = read("js/family-chat.js").split("\n").find(line => line.startsWith("function renderAdmin()"));
  for (const role of ["parent", "child", "inactive", "anonymous"]) {
    const elements = new Map();
    const element = () => ({ children: [], append(...items) { this.children.push(...items); }, replaceChildren() { this.children = []; }, addEventListener(type, fn) { this[type] = fn; } });
    const $ = key => { if (!elements.has(key)) elements.set(key, element()); return elements.get(key); };
    let opened = 0;
    const members = [{ id: "first", role: "child", display_name: "Existing", is_active: true }];
    const state = { member: { role: role === "child" ? "child" : "parent", is_active: role !== "inactive" }, token: role === "anonymous" ? "" : "session", realtimeToken: "realtime", members, settings: {} };
    vm.runInNewContext(`${source};renderAdmin();`, { $, state, document: { createElement: element }, onAddChild: () => opened++ });
    const add = $("#familyAdminList").children.find(node => node.id === "familyAddChildButton");
    assert.equal(Boolean(add), role === "parent");
    if (add) { assert.equal(add.textContent, "자녀 추가"); add.click(); assert.equal(opened, 1); }
    assert.equal(members.length, 1);
  }
  assert.match(read("js/app.js"), /onAddChild: \(\) => onboardingController\?\.startChildAddition\(\)/);
});

test("Parent re-entry opens without POST, cancels safely, and completed additions receive fresh IDs", async t => {
  const first = { id: "first", display_name: "Existing" };
  const children = [first];
  const h = await childHarness(t, async data => { children.push({ id: data.child.id, display_name: data.child.displayName }); return { children }; });
  assert.equal(h.controller.startChildAddition(), true);
  assert.equal(h.node("onboardingChildRegistration").hidden, false);
  assert.equal(h.calls.length, 0);
  h.node("onboardingChildBack").listeners.click();
  assert.equal(h.node("appShell").hidden, false);
  assert.equal(h.calls.length, 0);
  assert.equal(children.length, 1);
  h.controller.startChildAddition();
  h.setAttempt(async () => childSuccess(true));
  await h.submit();
  assert.equal(children[0], first);
  assert.equal(children.length, 2);
  h.controller.startChildAddition();
  assert.equal(h.node("onboardingChildName").value, "");
  await h.submit();
  assert.notEqual(h.calls[0].body.clientRequestId, h.calls[1].body.clientRequestId);
});

test("Child and missing sessions cannot open parent child-add re-entry", async t => {
  const h = await childHarness(t);
  for (const session of [storedSession("child"), null]) {
    h.setSession(session);
    assert.equal(h.controller.startChildAddition(), false);
    assert.equal(h.calls.length, 0);
  }
});

test("Re-entry and back cannot bypass committed refresh recovery", async t => {
  let fail = true;
  const h = await childHarness(t, async () => { if (fail) throw Error("refresh failed"); return {}; });
  h.controller.startChildAddition();
  h.setAttempt(async () => childSuccess(true));
  await h.submit();
  assert.equal(h.controller.startChildAddition(), false);
  h.node("onboardingChildBack").listeners.click();
  assert.equal(h.node("onboardingView").dataset.onboardingState, "CHILD_CREATED_REFRESH_REQUIRED");
  assert.equal(h.node("onboardingChildRegistration").hidden, false);
  assert.equal(h.node("onboardingChildSubmit").textContent, "목록 새로고침");
  assert.equal(h.calls.length, 1);
  fail = false;
  await h.submit();
  assert.equal(h.calls.length, 1);
  assert.equal(h.controller.startChildAddition(), true);
  await h.submit();
  assert.equal(h.calls.length, 2);
  assert.notEqual(h.calls[0].body.clientRequestId, h.calls[1].body.clientRequestId);
});
