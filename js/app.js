const STORAGE_KEY = "hagyeom-study-tracker-v1";
const PARENT_PASSWORD = "1234";
const statusLabels = {
  planned: "예정",
  done: "완료",
  late: "지연",
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

const localStore = {
  load() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
    const seeded = createSeedData();
    this.save(seeded);
    return seeded;
  },
  save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },
};

// Supabase 연동 시 이 객체와 같은 메서드(load/save)를 가진 어댑터로 교체하면 됩니다.
const repository = localStore;
let state = repository.load();
let isParentMode = false;

function createSeedData() {
  const today = toDateInput(new Date());
  const tomorrow = toDateInput(addDays(new Date(), 1));
  const yesterday = toDateInput(addDays(new Date(), -1));
  return {
    reward: { goal: 10, name: "5,000원 용돈" },
    claimedRewards: 0,
    plans: [
      {
        id: crypto.randomUUID(),
        subject: "수학",
        book: "최상위 수학",
        unit: "분수의 덧셈",
        lessonNo: "1차시",
        studyDate: today,
        dayNo: "1일차",
        content: "개념 읽고 확인문제 풀기",
        target: "12-15쪽",
        status: "planned",
      },
      {
        id: crypto.randomUUID(),
        subject: "국어",
        book: "독해력 자신감",
        unit: "중심 문장 찾기",
        lessonNo: "2차시",
        studyDate: today,
        dayNo: "1일차",
        content: "지문 2개 읽고 문제 풀기",
        target: "8문제",
        status: "planned",
      },
      {
        id: crypto.randomUUID(),
        subject: "영어",
        book: "초등 영단어",
        unit: "Daily Words",
        lessonNo: "3차시",
        studyDate: yesterday,
        dayNo: "전날",
        content: "단어 쓰기와 소리 내어 읽기",
        target: "20개",
        status: "late",
      },
      {
        id: crypto.randomUUID(),
        subject: "과학",
        book: "우등생 과학",
        unit: "식물의 한살이",
        lessonNo: "4차시",
        studyDate: tomorrow,
        dayNo: "2일차",
        content: "개념 정리와 실험 관찰",
        target: "22-25쪽",
        status: "planned",
      },
    ],
  };
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
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

function saveAndRender(message) {
  repository.save(state);
  render();
  if (message) showToast(message);
}

function completedCount() {
  return state.plans.filter((plan) => plan.status === "done").length;
}

function render() {
  markOverduePlans();
  renderHeader();
  renderRoleControls();
  renderToday();
  renderProgress();
  renderRewards();
  renderParent();
}

function markOverduePlans() {
  const today = toDateInput(new Date());
  let changed = false;
  state.plans = state.plans.map((plan) => {
    if (plan.status === "planned" && plan.studyDate < today) {
      changed = true;
      return { ...plan, status: "late" };
    }
    return plan;
  });
  if (changed) repository.save(state);
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
  $("#todayDate").textContent = formatDate(today);
  const todayPlans = state.plans
    .filter((plan) => plan.studyDate === today)
    .sort((a, b) => a.subject.localeCompare(b.subject, "ko"));

  if (!todayPlans.length) {
    $("#todayList").innerHTML = `<div class="empty"><h3>오늘 계획이 아직 없어요</h3><p>${isParentMode ? "부모관리 탭에서 오늘 학습을 등록하세요." : "오늘은 쉬어가는 날이에요. 스티커 에너지를 충전해요!"}</p></div>`;
    return;
  }

  $("#todayList").innerHTML = todayPlans.map(createStudyCard).join("");
  $$(".complete-btn").forEach((button) => {
    button.addEventListener("click", () => completePlan(button.dataset.id));
  });
}

function createStudyCard(plan) {
  const done = plan.status === "done";
  return `
    <article class="study-card ${plan.status}">
      <span class="card-status">${done ? "⭐" : "📘"} ${statusLabels[plan.status]}</span>
      <h3>${escapeHtml(plan.subject)} · ${escapeHtml(plan.book)}</h3>
      <p>${escapeHtml(plan.unit)} / ${escapeHtml(plan.lessonNo)}</p>
      <div class="card-meta">
        <span>오늘 할 일: ${escapeHtml(plan.content)}</span>
        <span>목표: ${escapeHtml(plan.target)}</span>
        <span>${escapeHtml(plan.dayNo)}</span>
      </div>
      <button class="complete-btn" data-id="${plan.id}" ${done ? "disabled" : ""}>
        ${done ? "완료했어요! ⭐" : "완료했어요!"}
      </button>
    </article>
  `;
}

function completePlan(id) {
  const plan = state.plans.find((item) => item.id === id);
  if (!plan || plan.status === "done") return;
  plan.status = "done";
  const praise = praises[Math.floor(Math.random() * praises.length)];
  launchCelebration();
  saveAndRender(praise);
}

function renderProgress() {
  const sorted = [...state.plans].sort((a, b) => {
    return a.studyDate.localeCompare(b.studyDate) || a.subject.localeCompare(b.subject, "ko");
  });
  $("#progressTable").innerHTML = sorted.map((plan) => `
    <tr class="status-${plan.status}">
      <td>${escapeHtml(plan.subject)}</td>
      <td>${escapeHtml(plan.book)}</td>
      <td>${escapeHtml(plan.unit)}</td>
      <td>${escapeHtml(plan.lessonNo)}</td>
      <td>${escapeHtml(plan.dayNo)}</td>
      <td>${escapeHtml(formatDate(plan.studyDate))}</td>
      <td>${escapeHtml(plan.target)}</td>
      <td><span class="status-badge status-${plan.status}">${statusLabels[plan.status]}</span></td>
    </tr>
  `).join("");
}

function renderRewards() {
  const count = completedCount();
  const reward = state.reward;
  const cycleCount = count - state.claimedRewards * reward.goal;
  const progress = Math.min(cycleCount, reward.goal);
  const canClaim = count >= reward.goal * (state.claimedRewards + 1);
  const nextGoal = reward.goal * (state.claimedRewards + 1);
  $("#rewardPanel").innerHTML = `
    <article class="reward-card">
      <p class="eyebrow">Sticker Mission</p>
      <h3>${nextGoal}개 모으면 ${escapeHtml(reward.name)}</h3>
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
    const earned = index < count % goal || (count > 0 && count % goal === 0 && count >= goal);
    return `<span class="sticker ${earned ? "" : "locked"}">${earned ? "⭐" : "☆"}</span>`;
  }).join("");
}

function claimReward() {
  const nextGoal = state.reward.goal * (state.claimedRewards + 1);
  if (completedCount() < nextGoal) return;
  state.claimedRewards += 1;
  launchCelebration();
  saveAndRender(`PERFECT! ${state.reward.name} 보상 달성!`);
}

function renderParent() {
  const total = state.plans.length;
  const done = completedCount();
  const late = state.plans.filter((plan) => plan.status === "late").length;
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
          <h4>${escapeHtml(plan.subject)} · ${escapeHtml(plan.book)} <span class="status-badge status-${plan.status}">${statusLabels[plan.status]}</span></h4>
          <p>${escapeHtml(formatDate(plan.studyDate))} · ${escapeHtml(plan.unit)} · ${escapeHtml(plan.target)}</p>
        </div>
        <div class="plan-actions">
          <button data-edit="${plan.id}">수정</button>
          <button data-delete="${plan.id}">삭제</button>
        </div>
      </article>
    `).join("");

  $$("[data-edit]").forEach((button) => button.addEventListener("click", () => editPlan(button.dataset.edit)));
  $$("[data-delete]").forEach((button) => button.addEventListener("click", () => deletePlan(button.dataset.delete)));
}

function calculateWeeklyRate() {
  const today = new Date();
  const start = toDateInput(addDays(today, -6));
  const end = toDateInput(today);
  const weekly = state.plans.filter((plan) => plan.studyDate >= start && plan.studyDate <= end);
  if (!weekly.length) return 0;
  return Math.round((weekly.filter((plan) => plan.status === "done").length / weekly.length) * 100);
}

function editPlan(id) {
  if (!isParentMode) return;
  const plan = state.plans.find((item) => item.id === id);
  if (!plan) return;
  $("#planId").value = plan.id;
  $("#subject").value = plan.subject;
  $("#book").value = plan.book;
  $("#unit").value = plan.unit;
  $("#lessonNo").value = plan.lessonNo;
  $("#studyDate").value = plan.studyDate;
  $("#dayNo").value = plan.dayNo;
  $("#content").value = plan.content;
  $("#target").value = plan.target;
  $("#status").value = plan.status;
  showToast("수정할 내용을 바꾸고 저장하세요.");
}

function deletePlan(id) {
  if (!isParentMode) return;
  state.plans = state.plans.filter((plan) => plan.id !== id);
  saveAndRender("학습계획을 삭제했어요.");
}

function resetForm() {
  $("#planForm").reset();
  $("#planId").value = "";
  $("#studyDate").value = toDateInput(new Date());
  $("#status").value = "planned";
}

function handlePlanSubmit(event) {
  event.preventDefault();
  if (!isParentMode) return;
  const formPlan = {
    id: $("#planId").value || crypto.randomUUID(),
    subject: $("#subject").value.trim(),
    book: $("#book").value.trim(),
    unit: $("#unit").value.trim(),
    lessonNo: $("#lessonNo").value.trim(),
    studyDate: $("#studyDate").value,
    dayNo: $("#dayNo").value.trim(),
    content: $("#content").value.trim(),
    target: $("#target").value.trim(),
    status: $("#status").value,
  };

  const index = state.plans.findIndex((plan) => plan.id === formPlan.id);
  if (index >= 0) state.plans[index] = formPlan;
  else state.plans.push(formPlan);
  resetForm();
  saveAndRender("학습계획을 저장했어요.");
}

function handleRewardSubmit(event) {
  event.preventDefault();
  if (!isParentMode) return;
  state.reward = {
    goal: Number($("#rewardGoal").value),
    name: $("#rewardName").value.trim(),
  };
  saveAndRender("보상 기준을 저장했어요.");
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2400);
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
  $$(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      switchView(tab.dataset.view);
    });
  });

  $("#parentAccessButton").addEventListener("click", openPasswordDialog);
  $("#returnChildButton").addEventListener("click", exitParentMode);
  $("#passwordForm").addEventListener("submit", handlePasswordSubmit);
  $("#closePasswordButton").addEventListener("click", closePasswordDialog);
  $("#planForm").addEventListener("submit", handlePlanSubmit);
  $("#rewardForm").addEventListener("submit", handleRewardSubmit);
  $("#resetFormButton").addEventListener("click", resetForm);
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js").catch(() => {});
}

bindEvents();
resetForm();
render();
