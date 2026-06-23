import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_CONFIG } from "./config.js";

const PARENT_PASSWORD = "1234";
const BUILD_VERSION = "v14";
const DEFAULT_REWARD = { goal: 10, name: "5,000원 용돈" };
const statusLabels = {
  planned: "예정",
  done: "완료",
  late: "지연",
  "예정": "예정",
  "완료": "완료",
  "지연": "지연",
};
const praises = [
  "GOOD!! 너무 잘했어!",
  "GREAT! 하겸이 최고야!",
  "PERFECT! 오늘도 멋지게 성공!",
  "WOW! 스티커 하나 더!",
  "SUPER! 끝까지 해낸 힘이 멋져!",
];

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function createSupabaseRepository(config) {
  const apiKey = config.publishableKey || config.anonKey || "";
  const configured = Boolean(config.url && apiKey);
  const client = configured ? createClient(config.url, apiKey) : null;

  function assertConfigured() {
    if (!configured) {
      throw new Error("Supabase Project URL과 Publishable Key를 js/config.js에 입력해주세요.");
    }
  }

  async function request(label, promise) {
    const { data, error, count } = await promise;
    if (error) {
      const detail = error.details ? ` (${error.details})` : "";
      throw new Error(`${label}: ${error.message}${detail}`);
    }
    return { data, count };
  }

  function sanitizePayload(payload, options = {}) {
    const { keepId = false } = options;
    return Object.fromEntries(
      Object.entries(payload).filter(([key, value]) => {
        if (key === "id" && !keepId) return false;
        return value !== undefined && value !== null && value !== "";
      })
    );
  }

  function planFromRow(row) {
    return {
      id: row.id,
      subject: row.subject,
      book: row.workbook,
      unit: row.chapter,
      lessonNo: row.lesson,
      studyDate: row.study_date,
      dayNo: row.day_label,
      content: row.content,
      target: row.goal,
      status: row.status,
    };
  }

  function rowFromPlan(plan) {
    return sanitizePayload({
      id: plan.id || undefined,
      subject: plan.subject,
      workbook: plan.book,
      chapter: plan.unit,
      lesson: plan.lessonNo,
      study_date: plan.studyDate,
      day_label: plan.dayNo,
      content: plan.content,
      goal: plan.target,
      status: plan.status,
    });
  }

  async function ensureRewardSettings() {
    const { data: settings } = await request(
      "보상 설정 확인 실패",
      client.from("reward_settings").select("id").limit(1).maybeSingle()
    );

    if (!settings) {
      await saveReward(DEFAULT_REWARD);
    }
  }

  async function load() {
    assertConfigured();
    await ensureRewardSettings();

    const [{ data: plans }, { data: reward }, { data: stickers }] = await Promise.all([
      request(
        "학습계획 불러오기 실패",
        client.from("study_plans").select("*").order("study_date", { ascending: true })
      ),
      request(
        "보상 설정 불러오기 실패",
        client.from("reward_settings").select("*").limit(1).maybeSingle()
      ),
      request(
        "스티커 이력 불러오기 실패",
        client.from("sticker_history").select("sticker_count")
      ),
    ]);

    console.log("Supabase study_plans count:", plans.length);
    console.log("Supabase study_plans rows:", plans);

    return {
      reward: reward ? { id: reward.id, goal: reward.target_stickers, name: reward.reward_name } : { ...DEFAULT_REWARD },
      stickerCount: stickers.reduce((sum, sticker) => sum + Number(sticker.sticker_count || 0), 0),
      plans: plans.map(planFromRow),
    };
  }

  async function save(data) {
    assertConfigured();
    await Promise.all([
      saveReward(data.reward),
      Promise.all(data.plans.map((plan) => upsertPlan(plan))),
    ]);
  }

  async function upsertPlan(plan) {
    assertConfigured();
    const payload = rowFromPlan(plan);
    if (plan.id) {
      const { data } = await request(
        "학습계획 수정 실패",
        client.from("study_plans").update(payload).eq("id", plan.id).select("*").single()
      );
      await syncStickerForPlan(data.id, data.status);
      return planFromRow(data);
    }

    const { data } = await request(
      "학습계획 저장 실패",
      client.from("study_plans").insert(payload).select("*").single()
    );
    await syncStickerForPlan(data.id, data.status);
    return planFromRow(data);
  }

  async function deletePlan(id) {
    assertConfigured();
    const planId = /^\d+$/.test(String(id)) ? Number(id) : id;
    await request(
      "연결된 스티커 기록 삭제 실패",
      client.from("sticker_history").delete().eq("study_plan_id", planId)
    );
    await request("학습계획 삭제 실패", client.from("study_plans").delete().eq("id", planId));
  }

  async function completePlan(id) {
    assertConfigured();
    const { data, error } = await client
      .from("study_plans")
      .update(sanitizePayload({ status: "완료" }))
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      const detail = error.details ? ` (${error.details})` : "";
      throw new Error(`완료 상태 저장 실패: ${error.message}${detail}`);
    }
    console.log("[complete-update-success]", data);

    const stickerPayload = sanitizePayload({
      study_plan_id: /^\d+$/.test(String(id)) ? Number(id) : id,
      sticker_count: 1,
    });
    const { error: stickerError } = await client.from("sticker_history").insert(stickerPayload);

    if (stickerError) {
      const detail = stickerError.details ? ` (${stickerError.details})` : "";
      throw new Error(`스티커 저장 실패: ${stickerError.message}${detail}`);
    }
    console.log("[complete-sticker-success]", stickerPayload);

    return planFromRow(data);
  }

  async function updatePlanStatus(id, status) {
    assertConfigured();
    const { data } = await request(
      "완료 상태 저장 실패",
      client
        .from("study_plans")
        .update(sanitizePayload({ status }))
        .eq("id", id)
        .select("*")
        .single()
    );

    if (isDoneStatus(status)) {
      await request(
        "스티커 저장 실패",
        client
          .from("sticker_history")
          .upsert(sanitizePayload({ study_plan_id: id, sticker_count: 1 }), { onConflict: "study_plan_id" })
      );
    } else {
      await request(
        "스티커 상태 정리 실패",
        client.from("sticker_history").delete().eq("study_plan_id", id)
      );
    }

    return planFromRow(data);
  }

  async function syncStickerForPlan(planId, status) {
    if (isDoneStatus(status)) {
      await request(
        "스티커 저장 실패",
        client
          .from("sticker_history")
          .upsert(sanitizePayload({ study_plan_id: planId, sticker_count: 1 }), { onConflict: "study_plan_id" })
      );
      return;
    }
    await request(
      "스티커 상태 정리 실패",
      client.from("sticker_history").delete().eq("study_plan_id", planId)
    );
  }

  async function saveReward(reward) {
    assertConfigured();
    const payload = sanitizePayload({
      target_stickers: Number(reward.goal),
      reward_name: reward.name,
    });
    const { data: current } = await request(
      "보상 설정 확인 실패",
      client.from("reward_settings").select("id").limit(1).maybeSingle()
    );
    if (current?.id) {
      await request("보상 설정 저장 실패", client.from("reward_settings").update(payload).eq("id", current.id));
      return;
    }
    await request("보상 설정 저장 실패", client.from("reward_settings").insert(payload));
  }

  async function markLate(planIds) {
    assertConfigured();
    if (!planIds.length) return;
    await request(
      "지연 상태 저장 실패",
      client.from("study_plans").update({ status: "지연" }).in("id", planIds)
    );
  }

  function subscribe(onChange, onError) {
    assertConfigured();
    const channel = client
      .channel("study-tracker-single-user")
      .on("postgres_changes", { event: "*", schema: "public", table: "study_plans" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "reward_settings" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "sticker_history" }, onChange)
      .subscribe((status, error) => {
        if (error && onError) onError(error);
      });
    return () => client.removeChannel(channel);
  }

  return {
    load,
    save,
    upsertPlan,
    deletePlan,
    completePlan,
    saveReward,
    markLate,
    subscribe,
  };
}

const repository = createSupabaseRepository(SUPABASE_CONFIG);
let state = { reward: { ...DEFAULT_REWARD }, stickerCount: 0, plans: [] };
state.formMode = "create";
let isParentMode = false;
let todayFilter = "today";
let isRemoteRefreshPending = false;
let installPrompt = null;

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function comparePlans(a, b) {
  return a.studyDate.localeCompare(b.studyDate) || a.subject.localeCompare(b.subject, "ko");
}

function isDoneStatus(status) {
  return status === "done" || status === "완료";
}

function isPlannedStatus(status) {
  return status === "planned" || status === "예정";
}

function isLateStatus(status) {
  return status === "late" || status === "지연";
}

function statusClass(status) {
  if (isDoneStatus(status)) return "done";
  if (isLateStatus(status)) return "late";
  return "planned";
}

function toDateInput(date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${dateString}T00:00:00`));
}

async function saveAndRender(message, operation) {
  try {
    if (operation) await operation();
    state = await repository.load();
    ensureFormMode();
    await markOverduePlans();
    render();
    setConnectionStatus("");
    if (message) showToast(message);
  } catch (error) {
    handleRepositoryError(error);
  }
}

function ensureFormMode() {
  if (!state.formMode) state.formMode = "create";
}

function completedCount() {
  return state.stickerCount || state.plans.filter((plan) => isDoneStatus(plan.status)).length;
}

function render() {
  renderDataSource();
  renderHeader();
  renderRoleControls();
  renderToday();
  renderProgress();
  renderRewards();
  renderParent();
}

function renderApp() {
  render();
}

function clearBrowserStorage() {
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch (error) {
    console.warn("Browser storage clear skipped:", error);
  }
}

function renderDataSource() {
  const source = $("#dataSource");
  if (source) source.textContent = `Data source: Supabase / Build: ${BUILD_VERSION}`;
}

function isStandaloneDisplay() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function updateInstallUI() {
  const panel = $("#installPanel");
  const button = $("#installAppButton");
  const help = $("#installHelp");
  if (!panel || !button || !help) return;

  if (isStandaloneDisplay()) {
    panel.hidden = true;
    return;
  }

  if (installPrompt) {
    panel.hidden = false;
    button.hidden = false;
    help.textContent = "설치하면 휴대폰 홈 화면에서 바로 열 수 있어요.";
    return;
  }

  if (isIosDevice()) {
    panel.hidden = false;
    button.hidden = true;
    help.textContent = "iPhone/Safari에서는 공유 버튼 → 홈 화면에 추가를 눌러주세요.";
    return;
  }

  panel.hidden = true;
  console.log("[pwa-install] beforeinstallprompt not available yet. Check HTTPS, manifest icons, and service worker.");
}

async function promptInstallApp() {
  if (!installPrompt) {
    console.log("[pwa-install] install prompt is not ready.");
    updateInstallUI();
    return;
  }
  installPrompt.prompt();
  const choice = await installPrompt.userChoice;
  console.log("[pwa-install] user choice:", choice.outcome);
  installPrompt = null;
  updateInstallUI();
}

async function markOverduePlans() {
  const today = toDateInput(new Date());
  const changedIds = [];
  state.plans = state.plans.map((plan) => {
    if (isPlannedStatus(plan.status) && plan.studyDate < today) {
      changedIds.push(plan.id);
      return { ...plan, status: "지연" };
    }
    return plan;
  });
  if (changedIds.length) {
    await repository.markLate(changedIds);
  }
}

function renderHeader() {
  $("#stickerCount").textContent = completedCount();
}

function renderRoleControls() {
  $$("[data-parent-only]").forEach((element) => {
    element.hidden = !isParentMode;
  });
  $("#parentAccessButton").hidden = isParentMode;
}

function renderToday() {
  const today = toDateInput(new Date());
  const weekEnd = toDateInput(addDays(new Date(), 6));
  $("#todayDate").textContent = formatDate(today);
  $$(".today-filter").forEach((button) => {
    button.classList.toggle("active", button.dataset.todayFilter === todayFilter);
  });

  const todayPlans = state.plans.filter((plan) => plan.studyDate === today).sort(comparePlans);
  const weekPlans = state.plans
    .filter((plan) => plan.studyDate >= today && plan.studyDate <= weekEnd && !isLateStatus(plan.status))
    .sort(comparePlans);
  const upcomingPlans = state.plans
    .filter((plan) => plan.studyDate >= today && isPlannedStatus(plan.status))
    .sort(comparePlans);
  const nearestPlan = upcomingPlans[0];

  let plans = todayPlans;
  let notice = "";

  if (todayFilter === "week") plans = weekPlans;
  if (todayFilter === "upcoming") plans = upcomingPlans;

  if (todayFilter === "today" && !todayPlans.length && nearestPlan) {
    plans = [nearestPlan];
    notice = "오늘 예정된 학습이 없어요. 이번 주 학습을 확인해볼까요?";
  }

  if (!plans.length) {
    $("#todayList").innerHTML = `<div class="empty"><h3>표시할 예정 학습이 없어요</h3><p>${isParentMode ? "부모관리 탭에서 학습을 등록하세요." : "오늘은 쉬어가는 날이에요. 스티커 에너지를 충전해요!"}</p></div>`;
    return;
  }

  $("#todayList").innerHTML = `${notice ? `<div class="today-notice">${notice}</div>` : ""}${plans.map(createStudyCard).join("")}`;
}

function createStudyCard(plan) {
  const done = isDoneStatus(plan.status);
  const normalizedStatus = statusClass(plan.status);
  const completeButtonHtml = `<button type="button" class="complete-btn" data-action="complete" data-id="${plan.id}">완료했어요!</button>`;
  if (!done) console.log("[complete-button-html]", completeButtonHtml);
  return `
    <article class="study-card ${normalizedStatus} ${done ? "completed" : ""}">
      <span class="card-status">${done ? "⭐" : "📘"} ${statusLabels[plan.status] || statusLabels[normalizedStatus]}</span>
      <h3>${escapeHtml(plan.subject)} · ${escapeHtml(plan.book)}</h3>
      <p>${escapeHtml(plan.unit)} / ${escapeHtml(plan.lessonNo)}</p>
      <div class="card-meta">
        <span>오늘 할 일: ${escapeHtml(plan.content)}</span>
        <span>목표: ${escapeHtml(plan.target)}</span>
        <span>${escapeHtml(plan.dayNo)}</span>
      </div>
      ${done
        ? `<div class="complete-done">참 잘했어요!</div>`
        : completeButtonHtml}
    </article>
  `;
}

async function handleCompletePlan(id, button) {
  if (!id || Number.isNaN(id)) {
    handleRepositoryError(new Error("완료할 학습 ID가 없습니다."));
    return;
  }
  console.log("[complete-start]", id);

  if (button) {
    button.disabled = true;
    button.textContent = "저장 중...";
  }

  try {
    await repository.completePlan(id);
    state = await repository.load();
    await markOverduePlans();
    renderApp();
    setConnectionStatus("");
    console.log("[complete-refresh-success]", id);
    launchCelebration();
    showToast("GOOD!! 너무 잘했어!");
  } catch (error) {
    if (button) {
      button.disabled = false;
      button.textContent = "완료했어요!";
    }
    handleRepositoryError(error);
  }
}

function renderProgress() {
  const sorted = [...state.plans].sort(comparePlans);
  $("#progressTable").innerHTML = sorted.map((plan) => `
    <tr class="status-${statusClass(plan.status)}">
      <td>${escapeHtml(plan.subject)}</td>
      <td>${escapeHtml(plan.book)}</td>
      <td>${escapeHtml(plan.unit)}</td>
      <td>${escapeHtml(plan.lessonNo)}</td>
      <td>${escapeHtml(plan.dayNo)}</td>
      <td>${escapeHtml(formatDate(plan.studyDate))}</td>
      <td>${escapeHtml(plan.target)}</td>
      <td><span class="status-badge status-${statusClass(plan.status)}">${statusLabels[plan.status] || statusLabels[statusClass(plan.status)]}</span></td>
    </tr>
  `).join("");
}

function renderRewards() {
  const count = completedCount();
  const reward = state.reward;
  const progress = Math.min(Math.max(count, 0), reward.goal);
  const canClaim = count >= reward.goal;
  $("#rewardPanel").innerHTML = `
    <article class="reward-card">
      <p class="eyebrow">Sticker Mission</p>
      <h3>${reward.goal}개 모으면 ${escapeHtml(reward.name)}</h3>
      <p>현재 ${count}개 완료했어요. 완료 1개마다 스티커 1개가 쌓입니다.</p>
      <progress value="${progress}" max="${reward.goal}"></progress>
      <p>${progress} / ${reward.goal}</p>
      <button class="complete-btn" id="claimRewardButton" ${canClaim ? "" : "disabled"}>
        ${canClaim ? "보상 받기!" : "조금만 더!"}
      </button>
    </article>
    <article class="reward-card">
      <p class="eyebrow">My Stickers</p>
      <div class="sticker-board">${createStickers(progress, reward.goal)}</div>
    </article>
  `;
  $("#claimRewardButton").addEventListener("click", claimReward);
}

function createStickers(count, goal) {
  return Array.from({ length: goal }, (_, index) => {
    const earned = index < count;
    return `<span class="sticker ${earned ? "" : "locked"}">${earned ? "⭐" : "☆"}</span>`;
  }).join("");
}

async function claimReward() {
  if (completedCount() < state.reward.goal) return;
  const rewardName = state.reward.name;
  launchCelebration();
  showToast(`PERFECT! ${rewardName} 보상 달성!`);
}

function renderParent() {
  const total = state.plans.length;
  const done = state.plans.filter((plan) => isDoneStatus(plan.status)).length;
  const late = state.plans.filter((plan) => isLateStatus(plan.status)).length;
  $("#totalPlans").textContent = total;
  $("#donePlans").textContent = done;
  $("#latePlans").textContent = late;
  $("#weeklyRate").textContent = `${calculateWeeklyRate()}%`;
  $("#rewardGoal").value = state.reward.goal;
  $("#rewardName").value = state.reward.name;

  $("#planList").innerHTML = [...state.plans]
    .sort((a, b) => b.studyDate.localeCompare(a.studyDate))
    .map((plan) => `
      <article class="plan-item">
        <div>
          <h4>${escapeHtml(plan.subject)} · ${escapeHtml(plan.book)} <span class="status-badge status-${statusClass(plan.status)}">${statusLabels[plan.status] || statusLabels[statusClass(plan.status)]}</span></h4>
          <p>${escapeHtml(formatDate(plan.studyDate))} · ${escapeHtml(plan.unit)} · ${escapeHtml(plan.target)}</p>
        </div>
        <div class="plan-actions">
          <button type="button" class="copy-btn" data-action="copy" data-id="${plan.id}">복사</button>
          <button type="button" class="edit-btn" data-action="edit" data-id="${plan.id}">수정</button>
          <button type="button" class="delete-btn" data-action="delete" data-id="${plan.id}">삭제</button>
        </div>
      </article>
    `).join("");
}

function calculateWeeklyRate() {
  const today = new Date();
  const start = toDateInput(addDays(today, -6));
  const end = toDateInput(today);
  const weekly = state.plans.filter((plan) => plan.studyDate >= start && plan.studyDate <= end);
  if (!weekly.length) return 0;
  return Math.round((weekly.filter((plan) => isDoneStatus(plan.status)).length / weekly.length) * 100);
}

async function handleEditPlan(id) {
  if (!isParentMode) return;
  const plan = state.plans.find((item) => Number(item.id) === Number(id));
  if (!plan) {
    handleRepositoryError(new Error("수정할 학습계획을 찾지 못했습니다."));
    return;
  }
  state.formMode = "edit";
  $("#planId").value = plan.id;
  $("#subject").value = plan.subject;
  $("#book").value = plan.book;
  $("#unit").value = plan.unit;
  $("#lessonNo").value = plan.lessonNo;
  $("#studyDate").value = plan.studyDate;
  $("#dayNo").value = plan.dayNo;
  $("#content").value = plan.content;
  $("#target").value = plan.target;
  $("#status").value = statusClass(plan.status);
  updatePlanSubmitButton();
  switchView("parent");
  $("#planForm").scrollIntoView({ behavior: "smooth", block: "start" });
  showToast("수정할 내용을 바꾸고 저장하세요.");
}

async function handleCopyPlan(id) {
  if (!isParentMode) return;
  console.log("[copy-click]", id);
  console.log("[copy-plans]", state.plans.map((plan) => plan.id));
  const plan = state.plans.find((item) => Number(item.id) === Number(id));
  if (!plan) {
    handleRepositoryError(new Error("복사할 학습계획을 찾지 못했습니다."));
    return;
  }
  state.formMode = "copy";
  $("#planId").value = "";
  $("#subject").value = plan.subject;
  $("#book").value = plan.book;
  $("#unit").value = plan.unit;
  $("#lessonNo").value = plan.lessonNo;
  $("#studyDate").value = plan.studyDate;
  $("#dayNo").value = plan.dayNo;
  $("#content").value = plan.content;
  $("#target").value = plan.target;
  $("#status").value = "planned";
  updatePlanSubmitButton();
  switchView("parent");
  $("#planForm").scrollIntoView({ behavior: "smooth", block: "start" });
  showToast("복사할 내용을 수정하고 저장하세요.");
}

async function handleDeletePlan(id) {
  if (!isParentMode) return;
  const ok = window.confirm("이 학습계획과 연결된 스티커 기록도 함께 삭제됩니다. 삭제할까요?");
  if (!ok) return;
  await saveAndRender("학습계획이 삭제되었습니다.", () => repository.deletePlan(id));
}

function resetForm() {
  $("#planForm").reset();
  $("#planId").value = "";
  $("#studyDate").value = toDateInput(new Date());
  $("#status").value = "planned";
  state.formMode = "create";
  updatePlanSubmitButton();
}

function updatePlanSubmitButton() {
  const button = $("#planSubmitButton");
  if (!button) return;
  if (state.formMode === "copy") {
    button.textContent = "복사해서 저장";
    return;
  }
  if (state.formMode === "edit") {
    button.textContent = "수정 저장";
    return;
  }
  button.textContent = "저장";
}

async function handlePlanSubmit(event) {
  event.preventDefault();
  if (!isParentMode) return;
  const formPlan = {
    id: state.formMode === "copy" ? undefined : $("#planId").value || undefined,
    subject: $("#subject").value.trim(),
    book: $("#book").value.trim(),
    unit: $("#unit").value.trim(),
    lessonNo: $("#lessonNo").value.trim(),
    studyDate: $("#studyDate").value,
    dayNo: $("#dayNo").value.trim(),
    content: $("#content").value.trim(),
    target: $("#target").value.trim(),
    status: statusLabels[$("#status").value] || $("#status").value,
  };

  const message = state.formMode === "copy" ? "복사한 학습계획이 저장되었습니다." : "학습계획을 저장했어요.";
  await saveAndRender(message, () => repository.upsertPlan(formPlan));
  resetForm();
}

async function handleRewardSubmit(event) {
  event.preventDefault();
  if (!isParentMode) return;
  const reward = {
    goal: Number($("#rewardGoal").value),
    name: $("#rewardName").value.trim(),
  };
  await saveAndRender("보상 기준을 저장했어요.", () => repository.saveReward(reward));
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2400);
}

function setConnectionStatus(message) {
  const status = $("#connectionStatus");
  status.hidden = !message;
  status.textContent = message;
}

function handleRepositoryError(error) {
  const details = error?.details ? ` (${error.details})` : "";
  const message = `${error?.message || "Supabase 연결 중 오류가 발생했습니다."}${details}`;
  setConnectionStatus(message);
  showToast(message);
}

function launchCelebration() {
  const root = $("#celebration");
  const icons = ["⭐", "🎉", "GOOD", "GREAT", "PERFECT"];
  for (let i = 0; i < 18; i += 1) {
    const pop = document.createElement("span");
    pop.className = "pop";
    pop.textContent = icons[Math.floor(Math.random() * icons.length)];
    pop.style.left = `${Math.random() * 90 + 4}%`;
    pop.style.bottom = `${Math.random() * 24 + 4}%`;
    pop.style.animationDelay = `${Math.random() * 0.25}s`;
    root.appendChild(pop);
    setTimeout(() => pop.remove(), 1500);
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function switchView(viewName) {
  if (viewName === "parent" && !isParentMode) {
    openPasswordDialog();
    return;
  }
  $$(".tab").forEach((item) => {
    item.classList.toggle("active", item.dataset.view === viewName);
  });
  $$(".view").forEach((item) => {
    item.classList.toggle("active", item.id === viewName);
  });
}

function openPasswordDialog() {
  const dialog = $("#passwordDialog");
  $("#parentPasswordInput").value = "";
  $("#passwordError").textContent = "";
  if (dialog.showModal) dialog.showModal();
  else dialog.setAttribute("open", "");
  $("#parentPasswordInput").focus();
}

function closePasswordDialog() {
  const dialog = $("#passwordDialog");
  if (dialog.close) dialog.close();
  else dialog.removeAttribute("open");
}

function enterParentMode() {
  isParentMode = true;
  closePasswordDialog();
  resetForm();
  render();
  switchView("parent");
  showToast("부모 모드로 전환했어요.");
}

function exitParentMode() {
  isParentMode = false;
  resetForm();
  render();
  switchView("today");
  showToast("아이 화면으로 돌아왔어요.");
}

function handlePasswordSubmit(event) {
  event.preventDefault();
  if ($("#parentPasswordInput").value === PARENT_PASSWORD) {
    enterParentMode();
    return;
  }
  $("#passwordError").textContent = "비밀번호가 맞지 않아요.";
  $("#parentPasswordInput").select();
}

function bindEvents() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    console.log("[pwa-install] beforeinstallprompt captured.");
    updateInstallUI();
  });

  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    $("#installPanel").hidden = true;
    console.log("[pwa-install] app installed.");
  });

  $$(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      switchView(tab.dataset.view);
    });
  });

  $$(".today-filter").forEach((button) => {
    button.addEventListener("click", () => {
      todayFilter = button.dataset.todayFilter;
      renderToday();
    });
  });

  document.addEventListener("click", async (event) => {
    const copyButton = event.target.closest('[data-action="copy"]');
    if (copyButton) {
      event.stopPropagation();
      const id = Number(copyButton.dataset.id);
      await handleCopyPlan(id);
      return;
    }

    const editButton = event.target.closest('[data-action="edit"]');
    if (editButton) {
      event.stopPropagation();
      const id = Number(editButton.dataset.id);
      await handleEditPlan(id);
      return;
    }

    const deleteButton = event.target.closest('[data-action="delete"]');
    if (deleteButton) {
      event.stopPropagation();
      const id = Number(deleteButton.dataset.id);
      await handleDeletePlan(id);
      return;
    }

    const button = event.target.closest('[data-action="complete"]');
    if (!button) return;
    event.stopPropagation();
    const currentPlans = state.plans || [];
    const rawId = button.dataset.id;
    const id = Number(rawId);
    console.log("[complete-click]");
    console.log("button id:", rawId);
    console.log("button.dataset.id:", button.dataset.id);
    console.log("typeof button.dataset.id:", typeof button.dataset.id);
    console.log("currentPlans:", currentPlans);
    console.log("[plans]", currentPlans.map((plan) => plan.id));
    console.log("[complete-click-detected]", id);
    await handleCompletePlan(id, button);
  });

  $("#parentAccessButton").addEventListener("click", openPasswordDialog);
  $("#returnChildButton").addEventListener("click", exitParentMode);
  $("#installAppButton").addEventListener("click", promptInstallApp);
  $("#passwordForm").addEventListener("submit", handlePasswordSubmit);
  $("#closePasswordButton").addEventListener("click", closePasswordDialog);
  $("#planForm").addEventListener("submit", handlePlanSubmit);
  $("#rewardForm").addEventListener("submit", handleRewardSubmit);
  $("#resetFormButton").addEventListener("click", resetForm);
}

async function reloadFromRemote() {
  if (isRemoteRefreshPending) return;
  isRemoteRefreshPending = true;
  window.setTimeout(async () => {
    try {
      state = await repository.load();
      ensureFormMode();
      await markOverduePlans();
      render();
      setConnectionStatus("");
    } catch (error) {
      handleRepositoryError(error);
    } finally {
      isRemoteRefreshPending = false;
    }
  }, 250);
}

async function init() {
  clearBrowserStorage();
  bindEvents();
  updateInstallUI();
  resetForm();
  $("#todayList").innerHTML = `<div class="empty"><h3>학습계획을 불러오는 중이에요</h3><p>Supabase에서 데이터를 가져오고 있어요.</p></div>`;
  try {
    state = await repository.load();
    ensureFormMode();
    await markOverduePlans();
    render();
    setConnectionStatus("");
    repository.subscribe(reloadFromRemote, handleRepositoryError);
  } catch (error) {
    render();
    handleRepositoryError(error);
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/service-worker.js", { scope: "/" }).catch((error) => {
      console.log("[service-worker] registration failed:", error);
    });
  }
}

init();
