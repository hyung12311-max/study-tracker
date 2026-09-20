const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const message = (id, extra = {}) => ({ id, sender_id: 'other', content: 'Message ' + id + '\nwith variable height', created_at: new Date(1700000000000 + Number(id) * 1000).toISOString(), ...extra });
function element() {
  const listeners = new Map();
  return { children: [], dataset: {}, style: {}, value: '', disabled: false, hidden: false,
    addEventListener(name, callback) { listeners.set(name, callback); },
    async fire(name) { await listeners.get(name)?.(); },
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    setAttribute() {}, focus() {}, querySelector() { return null; },
    append(...nodes) { this.children.push(...nodes); }, replaceChildren() { this.children = []; },
  };
}
async function harness() {
  const nodes = new Map(), requests = [], writes = [];
  const node = key => { if (!nodes.has(key)) nodes.set(key, element()); return nodes.get(key); };
  const list = node('#familyMessageList'); let top = 0, visible = true, receive, response = { messages: [] }, post;
  Object.defineProperties(list, {
    clientHeight: { get: () => visible ? 200 : 0 },
    scrollHeight: { get: () => visible ? list.children.length * 80 : 0 },
    scrollTop: { get: () => top, set(value) { top = Math.max(0, Math.min(value, list.scrollHeight - list.clientHeight)); writes.push({ top, height: list.scrollHeight, rows: list.children.length }); } },
  });
  const channel = { on(_kind, _filter, callback) { receive = callback; return this; }, subscribe() { return this; } };
  const storage = { getItem() { return null; }, setItem() {}, removeItem() {} };
  const context = vm.createContext({
    document: { querySelector: node, createElement: element, createTextNode: text => ({ text }), documentElement: element() },
    window: { location: { href: 'https://example.test/', search: '' }, innerHeight: 800 },
    sessionStorage: storage, localStorage: storage, restoreFamilyAuth: () => null,
    DEVICE_SESSION_KEY: 'device', LAST_MEMBER_KEY: 'last', MEMBER_KEY: 'member', TOKEN_KEY: 'token', REALTIME_TOKEN_KEY: 'realtime',
    SUPABASE_CONFIG: { url: 'synthetic', publishableKey: 'synthetic' },
    createClient: () => ({ realtime: { async setAuth() {} }, channel: () => channel, removeChannel() {} }),
    console: { info() {}, warn() {}, error() {} }, navigator: { onLine: true },
    URL, URLSearchParams, Intl, Date, performance, crypto: { randomUUID: () => 'synthetic-client-id' },
    setTimeout: () => 1, clearTimeout() {}, requestAnimationFrame: fn => fn(),
    history: { replaceState() {} },
  });
  vm.runInContext(read('js/family-chat.js').replace(/^import .*;\r?\n/gm, '').replace(/export /g, ''), context);
  context.transport = async (url, options = {}) => { requests.push({ url, options }); if (options.method === 'POST' && url === '/api/family/messages') return post(); if (!url.startsWith('/api/family/messages')) return {}; return typeof response === 'function' ? response() : response; };
  // Isolate authentication/push presentation; rendering, merging, loading, sending,
  // realtime handlers and the returned Product navigation controller remain real.
  vm.runInContext(`request=transport;bind=()=>{};renderMemberHeader=()=>{};renderDeviceSession=()=>{};refreshPushStatus=()=>{};saveAuth=()=>{};
    restoreDeviceSession=async()=>true;loadMembers=async()=>state.members;mergePublicMemberIdentity=(a)=>a;
    state.token='synthetic';state.realtimeToken='synthetic';state.member={id:'me',family_id:'family',role:'child'};state.members=[state.member];`, context);
  const controller = await context.initFamilyChat();
  context.bindMessageScrolling();
  const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
  return { node, list, writes, requests, context, controller, flush,
    setResponse: value => { response = value; }, setPost: value => { post = value; }, setVisible: value => { visible = value; },
    run: source => vm.runInContext(source, context),
    async open() { visible = true; controller.setActive(true); await flush(); },
    async receive(row) { await receive({ new: row }); },
    atBottom() { assert.equal(list.scrollTop, Math.max(0, list.scrollHeight - list.clientHeight)); },
  };
}
const history = () => Array.from({ length: 12 }, (_, i) => message(i + 1));

for (const userScroll of [false, true]) test(`Delayed actual entry respects user scroll = ${userScroll}, then a fresh entry reaches latest`, async () => {
  const h = await harness(); h.setResponse({ messages: history() }); await h.open();
  h.controller.setActive(false);
  let finish; h.setResponse(() => new Promise(resolve => { finish = resolve; }));
  h.controller.setActive(true); await h.flush();
  if (userScroll) { h.list.scrollTop = 140; await h.list.fire('scroll'); }
  finish({ messages: [message(13)] }); await h.flush();
  if (userScroll) assert.equal(h.list.scrollTop, 140); else h.atBottom();
  h.controller.setActive(false); h.setResponse({ messages: [message(14)] }); await h.open(); h.atBottom();
});

test('Programmatic bottom scroll events do not cancel a pending entry latest intent', async () => {
  const h = await harness(); h.setResponse({ messages: history() }); await h.open();
  h.list.scrollTop = 120; await h.list.fire('scroll');
  let finish; h.setResponse(() => new Promise(resolve => { finish = resolve; }));
  h.controller.setActive(true); await h.flush();
  h.context.scrollMessagesToBottom(); await h.list.fire('scroll');
  finish({ messages: [message(13)] }); await h.flush(); h.atBottom();
});

test('User scroll wins even within the near-bottom threshold during entry load', async () => {
  const h = await harness(); h.setResponse({ messages: history() }); await h.open();
  let finish; h.setResponse(() => new Promise(resolve => { finish = resolve; }));
  h.controller.setActive(true); await h.flush();
  h.list.scrollTop -= 60; const selected = h.list.scrollTop; await h.list.fire('scroll');
  finish({ messages: [message(13)] }); await h.flush();
  assert.equal(h.list.scrollTop, selected);
});

test('A stale entry response cannot override the current entry reading position', async () => {
  const h = await harness(); h.setResponse({ messages: history() }); await h.open();
  let finish; h.setResponse(() => new Promise(resolve => { finish = resolve; }));
  h.controller.setActive(true); await h.flush();
  h.controller.setActive(false); h.setResponse({ messages: [message(13)] }); await h.open();
  h.list.scrollTop = 130; await h.list.fire('scroll');
  finish({ messages: [message(14)] }); await h.flush();
  assert.equal(h.list.scrollTop, 130);
  assert.equal(h.run('state.messages.some(item=>item.id===14)'), false);
});

test('First visible chat entry reaches bottom after hidden preloading and DOM rendering', async () => {
  const h = await harness(); h.setVisible(false); h.setResponse({ messages: history() });
  await h.context.loadMessages();
  assert.equal(h.run('state.initialScrollDone'), false);
  await h.open(); h.atBottom();
  assert.ok(h.writes.at(-1).rows >= 12);
});
test('Empty chat entry renders safely', async () => {
  const h = await harness(); await h.open(); h.atBottom();
  assert.equal(h.list.children[0].className, 'empty');
});
for (const near of [true, false]) test(`Incoming realtime respects pre-render position: near bottom = ${near}`, async () => {
  const h = await harness(); h.setResponse({ messages: history() }); await h.open();
  h.list.scrollTop = near ? h.list.scrollHeight - h.list.clientHeight - 60 : 120;
  const before = h.list.scrollTop, height = h.list.scrollHeight;
  await h.receive(message(13));
  assert.ok(h.list.scrollHeight > height);
  if (near) h.atBottom(); else assert.equal(h.list.scrollTop, before);
});
test('Realtime duplicate and update preserve a reader position without another bottom jump', async () => {
  const h = await harness(); h.setResponse({ messages: history() }); await h.open();
  h.list.scrollTop -= 60; const before = h.list.scrollTop;
  await h.receive(message(12)); assert.equal(h.list.scrollTop, before);
  await h.receive(message(12, { content: 'Updated\ntext' })); assert.equal(h.list.scrollTop, before);
  assert.equal(h.run('state.messages.length'), 12);
});
test('Reload measures reading position after network wait, before DOM growth', async () => {
  const h = await harness(); h.setResponse({ messages: history() }); await h.open();
  let finish; h.setResponse(() => new Promise(resolve => { finish = resolve; }));
  const pending = h.context.loadMessages(); h.list.scrollTop = 100;
  finish({ messages: [message(13)] }); await pending;
  assert.equal(h.list.scrollTop, 100);
});
test('Older history prepend preserves the visible reading offset', async () => {
  const h = await harness(); h.setResponse({ messages: history() }); await h.open();
  h.list.scrollTop = 80; const height = h.list.scrollHeight;
  h.setResponse({ messages: [message(0)] }); await h.context.loadMessages({ older: true });
  assert.equal(h.list.scrollTop, 80 + h.list.scrollHeight - height);
  assert.ok(h.requests.some(item => item.url.includes('?before=')));
});
for (const realtimeFirst of [true, false]) test(`Own send reaches latest and acknowledgement is reconciled once: realtime first = ${realtimeFirst}`, async () => {
  const h = await harness(); h.setResponse({ messages: history() }); await h.open();
  let finish; h.setPost(() => new Promise(resolve => { finish = resolve; }));
  h.list.scrollTop = 100; h.node('#familyMessageInput').value = 'My message';
  h.context.send({ preventDefault() {} }); h.atBottom();
  const sent = message(14, { sender_id: 'me', client_message_id: 'synthetic-client-id', content: 'My message' });
  h.list.scrollTop = 100;
  if (realtimeFirst) await h.receive(sent); else { finish({ message: sent }); await h.flush(); }
  h.atBottom();
  h.list.scrollTop = 120;
  if (realtimeFirst) { finish({ message: sent }); await h.flush(); } else await h.receive(sent);
  assert.equal(h.list.scrollTop, 120);
  assert.equal(h.run('state.messages.length'), 13);
  assert.equal(h.requests.filter(item => item.options.method === 'POST' && item.url === '/api/family/messages').length, 1);
});

for (const existing of [true, false]) for (const userScroll of [false, true]) test(`Delayed notification entry: existing window = ${existing}, user scroll = ${userScroll}`, async () => {
  const h = await harness(); h.setResponse({ messages: history() }); await h.open();
  h.controller.setActive(false); h.list.scrollTop = 100;
  let target, completion; const handlers = {};
  const origin = 'https://example.test';
  const client = { url: origin + '/?tab=today', async focus() { return this; }, async navigate(url) { target = url; } };
  vm.runInNewContext(read('service-worker.js'), {
    self: { location: { origin }, addEventListener: (name, callback) => { handlers[name] = callback; } }, URL,
    clients: { async matchAll() { return existing ? [client] : []; }, async openWindow(url) { target = url; } },
  });
  handlers.notificationclick({ notification: { data: { url: '/?tab=family-chat' }, close() {} }, waitUntil(p) { completion = p; } });
  await completion;
  h.context.window.location = { href: target, search: new URL(target).search };
  Object.assign(h.context, { familyChatController: h.controller, onboardingController: { hide() {} },
    authGeneration: 0, authenticatedFeaturesTransition: null, completedAuthGeneration: -1, authMembersRefreshRequired: false,
    familyAuthHeaders: () => ({ Authorization: 'test-session' }),
    learningController: {}, learningAnalysisController: {}, learningMistakesController: {}, learningReviewQueueController: {}, rewardStoreController: null,
    startupMetrics: {}, enterAuthenticatedApp: async () => {}, ensureLearningAnalysis: async () => {}, appReady: false, $$: () => [], isParentMode: false });
  const app = read('js/app.js');
  vm.runInContext(app.slice(app.indexOf('function authenticatedStartupContext('), app.indexOf('function createStartupLearningRequests(')), h.context);
  vm.runInContext(app.slice(app.indexOf('function switchView('), app.indexOf('function enterParentMode(')), h.context);
  vm.runInContext(app.slice(app.indexOf('async function initializeAuthenticatedFeatures('), app.indexOf('async function learningOnboardingModel(')), h.context);
  let finish; h.setResponse(() => new Promise(resolve => { finish = resolve; }));
  await h.context.initializeAuthenticatedFeatures(); await h.flush();
  if (userScroll) { h.list.scrollTop = 150; await h.list.fire('scroll'); }
  finish({ messages: [message(13)] }); await h.flush();
  if (userScroll) assert.equal(h.list.scrollTop, 150); else h.atBottom();
  assert.equal(new URL(target).searchParams.get('tab'), 'family-chat');
});
