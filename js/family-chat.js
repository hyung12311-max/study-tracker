import { createClient } from "./vendor/supabase-js.js";
import { SUPABASE_CONFIG } from "./config.js";

const MEMBER_KEY = "study-tracker-family-member-v1";
const TOKEN_KEY = "study-tracker-family-token-v1";
const REALTIME_TOKEN_KEY = "study-tracker-family-realtime-token-v1";
const $ = (selector) => document.querySelector(selector);

function storedValue(key) {
  return localStorage.getItem(key) || sessionStorage.getItem(key) || "";
}

const state = {
  members: [],
  member: null,
  token: storedValue(TOKEN_KEY),
  realtimeToken: storedValue(REALTIME_TOKEN_KEY),
  messages: [],
  active: false,
  channel: null,
  sending: false,
  selectedId: "",
  selectedKey: localStorage.getItem(MEMBER_KEY) || "",
  membersLoading: false,
  membersError: "",
  oldest: null,
  settings: null,
  pushStatus: "idle",
  restoring: Boolean(storedValue(TOKEN_KEY)),
};

const supabase = SUPABASE_CONFIG.url && SUPABASE_CONFIG.publishableKey
  ? createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.publishableKey)
  : null;

function persistSession({ token, realtimeToken, member }) {
  state.token = token || "";
  state.realtimeToken = realtimeToken || "";
  state.member = member || null;
  state.selectedKey = member?.member_key || state.selectedKey || "";
  localStorage.setItem(TOKEN_KEY, state.token);
  localStorage.setItem(REALTIME_TOKEN_KEY, state.realtimeToken);
  if (state.selectedKey) localStorage.setItem(MEMBER_KEY, state.selectedKey);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(REALTIME_TOKEN_KEY);
}

function clearStoredSession({ clearMember = false } = {}) {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REALTIME_TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(REALTIME_TOKEN_KEY);
  if (clearMember) localStorage.removeItem(MEMBER_KEY);
}

async function request(url, options = {}) {
  const { auth = true, ...fetchOptions } = options;
  const headers = { "Content-Type": "application/json", ...(fetchOptions.headers || {}) };
  if (auth && state.token) headers.Authorization = `Bearer ${state.token}`;
  const response = await fetch(url, { ...fetchOptions, headers, cache: "no-store" });
  let data = {};
  try { data = await response.json(); } catch {}
  if (!response.ok) {
    const error = new Error(data.error || data.message || "요청을 처리하지 못했어요.");
    error.status = response.status;
    error.code = data.code;
    error.lockedUntil = data.lockedUntil;
    throw error;
  }
  return data;
}

function showNotice(message, error = false) {
  const el = $("#familyChatNotice");
  if (!el) return;
  el.hidden = !message;
  el.textContent = message || "";
  el.classList.toggle("error", error);
}

function setBadge(count) {
  const el = $("#familyUnreadBadge");
  if (!el) return;
  const value = Math.max(0, Number(count) || 0);
  el.textContent = value > 99 ? "99+" : String(value);
  el.hidden = value === 0;
}

function dateLabel(value) {
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" }).format(new Date(value));
}

function timeLabel(value) {
  return new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function appendLinkedText(root, text) {
  const re = /(https?:\/\/[^\s]+)/g;
  let last = 0;
  for (const match of String(text).matchAll(re)) {
    root.append(document.createTextNode(text.slice(last, match.index)));
    try {
      const url = new URL(match[0]);
      const a = document.createElement("a");
      a.href = url.href;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = match[0];
      root.append(a);
    } catch {
      root.append(document.createTextNode(match[0]));
    }
    last = match.index + match[0].length;
  }
  root.append(document.createTextNode(text.slice(last)));
}

function renderMessages({ preserveTop = false } = {}) {
  const list = $("#familyMessageList");
  if (!list) return;
  const oldHeight = list.scrollHeight;
  list.replaceChildren();
  if (!state.messages.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = state.token ? "아직 메시지가 없어요. 첫 인사를 남겨보세요!" : "가족 구성원으로 인증하면 대화를 볼 수 있어요.";
    list.append(empty);
    return;
  }
  let day = "";
  for (const message of state.messages) {
    const current = new Date(message.created_at).toDateString();
    if (current !== day) {
      day = current;
      const divider = document.createElement("div");
      divider.className = "family-date-divider";
      divider.textContent = dateLabel(message.created_at);
      list.append(divider);
    }
    if (message.message_type === "system") {
      const system = document.createElement("div");
      system.className = "family-system-message";
      system.textContent = `🤖 ${message.content}`;
      list.append(system);
      continue;
    }
    const mine = message.sender_id === state.member?.id;
    const row = document.createElement("article");
    row.className = `family-message-row${mine ? " mine" : ""}`;
    row.dataset.messageId = message.id;
    if (!mine) {
      const avatar = document.createElement("span");
      avatar.className = "family-message-avatar";
      avatar.textContent = message.sender?.avatar_emoji || "👤";
      row.append(avatar);
    }
    const stack = document.createElement("div");
    stack.className = "family-message-stack";
    if (!mine) {
      const name = document.createElement("p");
      name.className = "family-message-name";
      name.textContent = message.sender?.display_name || "가족";
      stack.append(name);
    }
    const bubble = document.createElement("div");
    bubble.className = "family-message-bubble";
    appendLinkedText(bubble, message.content);
    stack.append(bubble);
    const time = document.createElement("time");
    time.className = "family-message-time";
    time.dateTime = message.created_at;
    time.textContent = timeLabel(message.created_at);
    stack.append(time);
    row.append(stack);
    list.append(row);
  }
  if (preserveTop) list.scrollTop = list.scrollHeight - oldHeight;
  else list.scrollTop = list.scrollHeight;
}

function mergeMessages(messages) {
  const map = new Map(state.messages.map((message) => [message.id, message]));
  for (const message of messages || []) map.set(message.id, message);
  state.messages = [...map.values()].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  state.oldest = state.messages[0]?.created_at || null;
}

async function markRead() {
  if (!state.active || !state.token) return;
  const ids = state.messages.filter((message) => message.sender_id !== state.member?.id).map((message) => message.id);
  if (!ids.length) {
    setBadge(0);
    return;
  }
  try {
    await request("/api/family/read", { method: "POST", body: JSON.stringify({ messageIds: ids.slice(-100) }) });
    setBadge(0);
  } catch (error) {
    console.warn("[family chat] read failed", error.message);
  }
}

async function loadMessages({ older = false, silent = false } = {}) {
  if (!state.token) return;
  try {
    const suffix = older && state.oldest ? `?before=${encodeURIComponent(state.oldest)}&limit=50` : "?limit=50";
    const data = await request(`/api/family/messages${suffix}`);
    mergeMessages(data.messages);
    renderMessages({ preserveTop: older });
    if (state.active) await markRead();
    else setBadge(data.unread);
    showNotice("");
  } catch (error) {
    if (error.status === 401) {
      logout(false);
      if (state.active) openLogin();
    } else if (!silent) {
      showNotice(navigator.onLine ? "메시지를 불러오지 못했어요." : "인터넷 연결을 확인해 주세요.", true);
    }
  }
}

function stopRealtime() {
  if (state.channel && supabase) supabase.removeChannel(state.channel);
  state.channel = null;
}

async function startRealtime() {
  stopRealtime();
  if (!supabase || !state.member || !state.realtimeToken) return;
  await supabase.realtime.setAuth(state.realtimeToken);
  state.channel = supabase.channel(`family-chat-${state.member.id}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "family_messages", filter: `family_id=eq.${state.member.family_id}` }, async () => {
      await loadMessages({ silent: true });
      if (state.active) await markRead();
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") showNotice("");
      if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status) && state.active) {
        showNotice("실시간 연결이 끊겼어요. 다시 연결하고 있습니다.", true);
        window.setTimeout(() => {
          if (state.active) {
            startRealtime();
            loadMessages({ silent: true });
          }
        }, 2500);
      }
    });
}

function renderMemberHeader() {
  const el = $("#familyCurrentMember");
  if (el) {
    el.textContent = state.restoring
      ? "저장된 가족 로그인을 확인하고 있어요..."
      : state.member
        ? `${state.member.avatar_emoji || "👤"} ${state.member.display_name}님으로 접속 중`
        : state.selectedKey
          ? "PIN을 입력해 다시 인증해 주세요."
          : "가족 사용자를 선택해 주세요.";
  }
  const guide = $("#familyPushGuide");
  if (guide) {
    guide.textContent = state.member?.role === "parent"
      ? "알림을 켜면 자녀 활동 및 가족방 새 메시지를 받을 수 있어요."
      : "알림을 켜면 가족방 새 메시지를 받을 수 있어요.";
  }
  const input = $("#familyMessageInput");
  const sendButton = $("#familySendButton");
  if (input) input.disabled = !state.token || state.restoring;
  if (sendButton) sendButton.disabled = !state.token || state.sending || state.restoring;
  const pinButton = $("#familySelfPinButton");
  if (pinButton) pinButton.disabled = !state.token || !state.member || state.restoring;
  const logoutButton = $("#familyLogoutButton");
  if (logoutButton) logoutButton.disabled = !state.token;
  renderPushButton();
}

function renderPushButton() {
  const button = $("#familyPushButton");
  if (!button) return;
  const supported = "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
  if (!supported) {
    button.textContent = "알림 미지원";
    button.disabled = true;
    return;
  }
  if (!state.token || state.restoring) {
    button.textContent = "🔔 알림 받기";
    button.disabled = true;
    return;
  }
  if (Notification.permission === "denied") {
    button.textContent = "🔕 알림이 차단됨";
    button.disabled = true;
    return;
  }
  button.disabled = state.pushStatus === "working";
  button.textContent = state.pushStatus === "ready" ? "🔔 알림 사용 중" : state.pushStatus === "working" ? "알림 설정 중..." : "🔔 알림 받기";
}

async function refreshPushStatus() {
  try {
    if (!state.token || !("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (Notification.permission === "denied") {
      state.pushStatus = "denied";
      renderPushButton();
      return;
    }
    if (Notification.permission !== "granted") return;
    const registration = await navigator.serviceWorker.ready;
    const sub = await registration.pushManager.getSubscription();
    state.pushStatus = sub ? "ready" : "idle";
    renderPushButton();
  } catch {}
}

function resizeMessageInput() {
  const input = $("#familyMessageInput");
  if (!input) return;
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 116)}px`;
}

function renderChoices() {
  const root = $("#familyMemberChoices");
  const status = $("#familyMemberSelectionStatus");
  if (!root || !status) return;
  root.replaceChildren();
  if (state.membersLoading) {
    status.textContent = "가족 구성원을 불러오고 있어요.";
    return;
  }
  if (state.membersError) {
    status.textContent = "가족 구성원을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "family-member-retry";
    retry.textContent = "다시 시도";
    retry.addEventListener("click", () => loadMembers());
    root.append(retry);
    return;
  }
  if (!state.members.length) {
    status.textContent = "등록된 가족 구성원이 없습니다.";
    return;
  }
  const selected = state.members.find((member) => member.id === state.selectedId || member.member_key === state.selectedKey);
  status.textContent = selected ? `${selected.avatar_emoji || "👤"} ${selected.display_name} 선택됨` : "가족 구성원을 선택해 주세요.";
  for (const member of state.members) {
    const isSelected = member.id === state.selectedId || member.member_key === state.selectedKey;
    const button = document.createElement("button");
    const avatar = document.createElement("span");
    const name = document.createElement("strong");
    const check = document.createElement("span");
    button.type = "button";
    button.className = `family-member-choice${isSelected ? " selected" : ""}`;
    button.dataset.memberId = member.id;
    button.dataset.memberKey = member.member_key;
    button.setAttribute("aria-pressed", String(isSelected));
    avatar.className = "family-member-choice-avatar";
    avatar.textContent = member.avatar_emoji || "👤";
    name.textContent = member.display_name;
    check.className = "family-member-check";
    check.textContent = isSelected ? "✓" : "";
    button.append(avatar, name, check);
    button.addEventListener("click", () => {
      state.selectedId = member.id;
      state.selectedKey = member.member_key;
      $("#familyLoginError").textContent = "";
      renderChoices();
      $("#familyPinInput").focus();
    });
    root.append(button);
  }
}

async function loadMembers() {
  state.membersLoading = true;
  state.membersError = "";
  renderChoices();
  try {
    const data = await request("/api/family/members", { auth: Boolean(state.token) });
    if (!Array.isArray(data?.members)) throw new Error("Invalid members response.");
    state.members = data.members
      .filter((member) => member && member.is_active !== false && member.id && member.member_key && member.display_name)
      .map((member) => ({
        id: member.id,
        family_id: member.family_id || null,
        member_key: String(member.member_key),
        display_name: String(member.display_name),
        avatar_emoji: String(member.avatar_emoji || "👤"),
        role: member.role,
        is_active: member.is_active !== false,
        notifications_enabled: member.notifications_enabled !== false,
        device_count: Number(member.device_count || 0),
      }));
    state.settings = data.settings || null;
    const selected = state.members.find((member) => member.member_key === state.selectedKey);
    state.selectedId = selected?.id || "";
    if (!selected && state.selectedKey) state.selectedKey = "";
  } catch (error) {
    state.members = [];
    state.selectedId = "";
    state.membersError = "load-failed";
    console.error("[family members] request failed", { status: error.status || 0, message: error.message });
  } finally {
    state.membersLoading = false;
    renderChoices();
    renderAdmin();
  }
  return state.members;
}

async function restoreSession() {
  if (!state.token) return false;
  state.restoring = true;
  renderMemberHeader();
  showNotice("저장된 가족 로그인을 확인하고 있어요.");
  try {
    const data = await request("/api/family/session");
    persistSession(data);
    await loadMembers();
    const chosen = state.members.find((member) => member.member_key === data.member.member_key);
    if (!chosen) throw new Error("MEMBER_INACTIVE");
    state.member = chosen;
    state.selectedKey = chosen.member_key;
    localStorage.setItem(MEMBER_KEY, chosen.member_key);
    await loadMessages({ silent: true });
    refreshPushStatus();
    showNotice("");
    return true;
  } catch (error) {
    console.warn("[family session] restore failed", { status: error.status || 0, code: error.code || "", message: error.message });
    clearStoredSession();
    state.token = "";
    state.realtimeToken = "";
    state.member = null;
    state.messages = [];
    renderMessages();
    return false;
  } finally {
    state.restoring = false;
    renderMemberHeader();
  }
}

async function openLogin() {
  $("#familyLoginError").textContent = "";
  $("#familyPinInput").value = "";
  const dialog = $("#familyLoginDialog");
  if (dialog.showModal && !dialog.open) dialog.showModal();
  else dialog.setAttribute("open", "");
  await loadMembers();
}

function closeDialog(dialog) {
  dialog.close?.() || dialog.removeAttribute("open");
}

async function login(event) {
  event.preventDefault();
  const pin = $("#familyPinInput").value;
  const selected = state.members.find((member) => member.id === state.selectedId && member.member_key === state.selectedKey);
  if (!selected) {
    $("#familyLoginError").textContent = "가족 사용자를 선택해 주세요.";
    return;
  }
  try {
    $("#familyLoginButton").disabled = true;
    const data = await request("/api/family/verify-pin", {
      method: "POST",
      auth: false,
      body: JSON.stringify({ memberKey: selected.member_key, pin }),
    });
    persistSession(data);
    $("#familyPinInput").value = "";
    closeDialog($("#familyLoginDialog"));
    renderMemberHeader();
    refreshPushStatus();
    await loadMembers();
    await loadMessages();
    if (state.active) startRealtime();
  } catch (error) {
    $("#familyLoginError").textContent = error.status === 423
      ? "5회 실패하여 30초 동안 잠겼어요."
      : error.status === 401 ? "PIN이 맞지 않아요." : "로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.";
    console.error("[family login] failed", { status: error.status || 0, message: error.message });
  } finally {
    $("#familyLoginButton").disabled = false;
  }
}

function logout(show = true, { clearMember = false } = {}) {
  stopRealtime();
  clearStoredSession({ clearMember });
  state.token = "";
  state.realtimeToken = "";
  state.member = null;
  state.messages = [];
  state.selectedId = "";
  if (clearMember) state.selectedKey = "";
  renderMemberHeader();
  renderMessages();
  if (show) openLogin();
}

async function send(event) {
  event.preventDefault();
  const input = $("#familyMessageInput");
  const content = input.value.trim();
  if (!content || state.sending) return;
  state.sending = true;
  renderMemberHeader();
  const clientMessageId = `web_${crypto.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
  try {
    const data = await request("/api/family/messages", { method: "POST", body: JSON.stringify({ content, clientMessageId }) });
    mergeMessages([data.message]);
    renderMessages();
    input.value = "";
    resizeMessageInput();
    await markRead();
    showNotice("");
  } catch {
    showNotice("메시지 전송에 실패했어요. 내용은 남겨두었으니 다시 전송해 주세요.", true);
  } finally {
    state.sending = false;
    renderMemberHeader();
    input.focus();
  }
}

function urlBase64ToUint8Array(value) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const raw = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

async function enablePush() {
  try {
    state.pushStatus = "working";
    renderPushButton();
    if (!window.isSecureContext && !["localhost", "127.0.0.1"].includes(location.hostname)) throw new Error("HTTPS에서만 알림을 켤 수 있어요.");
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) throw new Error("현재 브라우저는 Push 알림을 지원하지 않아요.");
    if (/iphone|ipad|ipod/i.test(navigator.userAgent) && !matchMedia("(display-mode: standalone)").matches && !navigator.standalone) {
      throw new Error("iPhone에서는 홈 화면에 앱을 설치한 후 알림을 켜 주세요.");
    }
    const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    if (permission !== "granted") throw new Error("알림 권한이 허용되지 않았어요.");
    const registration = await navigator.serviceWorker.ready;
    const key = await request("/api/notifications/public-key");
    if (!key.configured || !key.publicKey) throw new Error("알림 서버 설정이 아직 완료되지 않았어요.");
    let sub = await registration.pushManager.getSubscription();
    if (!sub) {
      sub = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key.publicKey) });
    }
    await request("/api/notifications/subscribe", {
      method: "POST",
      body: JSON.stringify({ subscription: sub.toJSON(), deviceName: navigator.platform || "브라우저" }),
    });
    state.pushStatus = "ready";
    showNotice("이 기기에서 가족방 알림을 받습니다.");
    await loadMembers();
  } catch (error) {
    state.pushStatus = ("Notification" in window && Notification.permission === "denied") ? "denied" : "idle";
    showNotice(error.message, true);
  } finally {
    renderPushButton();
  }
}

function renderAdmin() {
  const root = $("#familyAdminList");
  if (!root) return;
  root.replaceChildren();
  const global = $("#familyChatNotificationsEnabled");
  const system = $("#familySystemNotificationsEnabled");
  const parent = state.member?.role === "parent";
  global.disabled = system.disabled = !parent;
  global.checked = state.settings?.chat_notifications_enabled !== false;
  system.checked = state.settings?.system_notifications_enabled !== false;
  if (!parent) {
    const guide = document.createElement("p");
    guide.textContent = "PIN을 변경하려면 아빠 또는 엄마로 인증해 주세요.";
    const authenticate = document.createElement("button");
    authenticate.type = "button";
    authenticate.className = "primary";
    authenticate.textContent = "부모 사용자 인증하기";
    authenticate.addEventListener("click", () => document.querySelector('[data-view="family-chat"]')?.click());
    root.append(guide, authenticate);
    return;
  }
  for (const member of state.members) {
    const row = document.createElement("div");
    row.className = "family-admin-item";
    const label = document.createElement("strong");
    label.textContent = `${member.avatar_emoji || "👤"} ${member.display_name} · ${member.role === "parent" ? "부모" : "자녀"} · 기기 ${member.device_count || 0}대`;
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.textContent = member.is_active ? "활성" : "비활성";
    toggle.addEventListener("click", async () => {
      await request("/api/family/members", { method: "PATCH", body: JSON.stringify({ memberId: member.id, isActive: !member.is_active }) });
      await loadMembers();
    });
    const notification = document.createElement("button");
    notification.type = "button";
    notification.textContent = member.notifications_enabled ? "알림 켜짐" : "알림 꺼짐";
    notification.addEventListener("click", async () => {
      await request("/api/family/members", { method: "PATCH", body: JSON.stringify({ memberId: member.id, notificationsEnabled: !member.notifications_enabled }) });
      await loadMembers();
    });
    const pin = document.createElement("button");
    pin.type = "button";
    pin.textContent = "PIN 변경";
    pin.addEventListener("click", () => {
      $("#familyPinMemberId").value = member.id;
      $("#familyPinTitle").textContent = `${member.display_name} PIN 변경`;
      $("#familyPinDialog").showModal();
    });
    row.append(label, toggle, notification, pin);
    root.append(row);
  }
}

async function changePin(event) {
  event.preventDefault();
  const pin = $("#familyNewPin").value;
  const confirm = $("#familyConfirmPin").value;
  if (!/^\d{4}$/.test(pin) || pin !== confirm) {
    $("#familyPinError").textContent = "같은 4자리 PIN을 두 번 입력해 주세요.";
    return;
  }
  try {
    await request("/api/family/pin", { method: "POST", body: JSON.stringify({ memberId: $("#familyPinMemberId").value, pin }) });
    closeDialog($("#familyPinDialog"));
    showNotice("PIN을 변경했어요.");
  } catch (error) {
    $("#familyPinError").textContent = error.message;
  }
}

async function updateFamilySettings() {
  try {
    await request("/api/family/members", {
      method: "PATCH",
      body: JSON.stringify({
        familySettings: {
          chatNotificationsEnabled: $("#familyChatNotificationsEnabled").checked,
          systemNotificationsEnabled: $("#familySystemNotificationsEnabled").checked,
        },
      }),
    });
    await loadMembers();
  } catch (error) {
    showNotice(error.message, true);
  }
}

function pinValue(selector) {
  return ($(selector)?.value || "").replace(/\D/g, "").slice(0, 4);
}

function cleanPinInput(event) {
  event.currentTarget.value = event.currentTarget.value.replace(/\D/g, "").slice(0, 4);
}

function simplePin(pin) {
  return new Set(["0000", "1111", "1234", "4321"]).has(pin) || /^(\d)\1{3}$/.test(pin);
}

function openSelfPinDialog() {
  if (!state.member) return;
  $("#familySelfPinError").textContent = "";
  $("#familySelfPinMember").textContent = `${state.member.avatar_emoji || "👤"} ${state.member.display_name}`;
  for (const id of ["#familyCurrentPin", "#familySelfNewPin", "#familySelfConfirmPin"]) $(id).value = "";
  const dialog = $("#familySelfPinDialog");
  if (dialog.showModal && !dialog.open) dialog.showModal();
  else dialog.setAttribute("open", "");
  $("#familyCurrentPin").focus();
}

async function changeSelfPin(event) {
  event.preventDefault();
  if (!state.member) return;
  const current = pinValue("#familyCurrentPin");
  const next = pinValue("#familySelfNewPin");
  const confirm = pinValue("#familySelfConfirmPin");
  const error = $("#familySelfPinError");
  const button = $("#familySelfPinSubmitButton");
  error.textContent = "";
  if (!/^\d{4}$/.test(current) || !/^\d{4}$/.test(next) || !/^\d{4}$/.test(confirm)) {
    error.textContent = "PIN은 숫자 4자리로 입력해 주세요.";
    return;
  }
  if (next !== confirm) {
    error.textContent = "새 PIN과 새 PIN 확인이 일치하지 않습니다.";
    return;
  }
  if (current === next) {
    error.textContent = "새 PIN은 현재 PIN과 다르게 입력해 주세요.";
    return;
  }
  if (simplePin(next)) {
    error.textContent = "0000, 1111, 1234처럼 너무 단순한 PIN은 사용할 수 없습니다.";
    return;
  }
  button.disabled = true;
  const original = button.textContent;
  button.textContent = "변경 중...";
  try {
    const data = await request("/api/family/change-pin", {
      method: "POST",
      body: JSON.stringify({ member_key: state.member.member_key, current_pin: current, new_pin: next }),
    });
    closeDialog($("#familySelfPinDialog"));
    showNotice(`${data.message || "PIN이 변경되었습니다."} 다음 로그인부터 새 PIN을 사용해 주세요.`);
  } catch (requestError) {
    error.textContent = requestError.message || "PIN을 변경하지 못했습니다.";
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

function bind() {
  const view = $("#family-chat");
  const messageInput = $("#familyMessageInput");
  const messageForm = $("#familyMessageForm");
  const updateFamilyMode = () => document.body.classList.toggle("family-chat-mode", view?.classList.contains("active"));
  if (view) {
    new MutationObserver(updateFamilyMode).observe(view, { attributes: true, attributeFilter: ["class"] });
    updateFamilyMode();
  }
  messageInput?.addEventListener("input", resizeMessageInput);
  messageForm?.addEventListener("submit", () => [0, 250, 750, 1500, 3000].forEach((delay) => window.setTimeout(resizeMessageInput, delay)));
  $("#familyLoginForm")?.addEventListener("submit", login);
  $("#closeFamilyLoginButton")?.addEventListener("click", () => closeDialog($("#familyLoginDialog")));
  $("#familyChangeMemberButton")?.addEventListener("click", () => logout(true, { clearMember: true }));
  $("#familyLogoutButton")?.addEventListener("click", () => {
    logout(false, { clearMember: true });
    showNotice("로그아웃되었습니다.");
  });
  $("#familySelfPinButton")?.addEventListener("click", openSelfPinDialog);
  $("#familySelfPinForm")?.addEventListener("submit", changeSelfPin);
  $("#closeFamilySelfPinButton")?.addEventListener("click", () => closeDialog($("#familySelfPinDialog")));
  $("#cancelFamilySelfPinButton")?.addEventListener("click", () => closeDialog($("#familySelfPinDialog")));
  ["#familyCurrentPin", "#familySelfNewPin", "#familySelfConfirmPin"].forEach((selector) => $(selector)?.addEventListener("input", cleanPinInput));
  $("#familyMessageForm")?.addEventListener("submit", send);
  $("#familyMessageInput")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      $("#familyMessageForm").requestSubmit();
    }
  });
  $("#familyPushButton")?.addEventListener("click", enablePush);
  $("#familyPinForm")?.addEventListener("submit", changePin);
  $("#closeFamilyPinButton")?.addEventListener("click", () => closeDialog($("#familyPinDialog")));
  $("#familyChatNotificationsEnabled")?.addEventListener("change", updateFamilySettings);
  $("#familySystemNotificationsEnabled")?.addEventListener("change", updateFamilySettings);
  $("#familyMessageList")?.addEventListener("scroll", async (event) => {
    if (event.currentTarget.scrollTop < 50 && state.oldest) await loadMessages({ older: true });
  });
  window.addEventListener("online", () => {
    if (state.active) {
      startRealtime();
      loadMessages({ silent: true });
    }
  });
  window.addEventListener("offline", () => showNotice("인터넷 연결이 끊겼어요.", true));
}

export async function initFamilyChat() {
  bind();
  renderMemberHeader();
  const restored = await restoreSession();
  if (!restored) await loadMembers();
  if (state.token && state.member) {
    renderMemberHeader();
    refreshPushStatus();
    await loadMessages({ silent: true });
  }
  return {
    setActive(active) {
      state.active = active;
      if (active) {
        if (state.restoring) return;
        if (!state.token || !state.member) openLogin();
        else {
          startRealtime();
          loadMessages({ silent: true });
        }
      } else {
        stopRealtime();
      }
    },
    refreshAdmin: renderAdmin,
  };
}
