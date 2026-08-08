function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const PRIORITY_LABELS = Object.freeze({
  repeated_wrong: "반복 오답 우선",
  unreviewed: "첫 복습",
  retried_wrong: "재도전 필요",
  resolved: "숙련 유지",
});

function dueLabel(item) {
  if (item.action?.type === "resume") return "진행 중인 복습";
  const dueAt = new Date(item.effectiveDueAt);
  if (!Number.isFinite(dueAt.getTime())) return "일정 확인 필요";
  if (item.due) return "오늘 복습";
  return `${dueAt.toLocaleDateString("ko-KR", { month: "short", day: "numeric" })} 예정`;
}

export function initLearningReviewQueue({
  requestJson,
  authHeaders,
  currentMember,
  selectedAssignee,
  openReview,
}) {
  let generation = 0;
  let queue = [];
  let loading = false;
  let failed = false;
  let busyKey = "";

  function identity() {
    const member = currentMember();
    if (!member) return "signed-out";
    return `${member.id}:${member.role === "parent" ? selectedAssignee() || "unselected" : member.id}`;
  }

  function target() {
    const member = currentMember();
    return member?.role === "parent"
      ? document.querySelector("#parentLearningReviewQueue")
      : member?.role === "child"
        ? document.querySelector("#childLearningReviewQueue")
        : null;
  }

  function card(item, index) {
    const member = currentMember();
    const action = item.action?.type;
    const actionButton = action === "resume"
      ? `<button type="button" class="primary" data-review-queue-open="${index}">복습 이어서 하기</button>`
      : action === "start"
        ? `<button type="button" class="primary" data-review-queue-open="${index}">복습 시작</button>`
        : '<span class="learning-review-queue-wait">예정된 복습</span>';
    const schedule = member?.role === "parent"
      ? `<div class="learning-review-schedule-actions" aria-label="${escapeHtml(item.skill?.name || item.skill?.code)} 복습 일정">
          <span>미루기</span>
          ${[1, 3, 7].map((days) => `<button type="button" data-review-queue-snooze="${days}" data-review-queue-index="${index}" ${busyKey ? "disabled" : ""}>${days}일</button>`).join("")}
          ${item.scheduleSource === "override" ? `<button type="button" data-review-queue-clear data-review-queue-index="${index}" ${busyKey ? "disabled" : ""}>기본 일정</button>` : ""}
        </div>`
      : "";
    return `<article class="learning-review-queue-card" data-schedule-source="${escapeHtml(item.scheduleSource)}">
      <header><span class="learning-review-priority">${escapeHtml(PRIORITY_LABELS[item.priorityStatus] || "복습")}</span><strong>${escapeHtml(dueLabel(item))}</strong></header>
      <h5>${escapeHtml(item.unit?.title || "학습 단원")}</h5>
      <p><strong>${escapeHtml(item.skill?.name || item.skill?.code || "개념")}</strong> · ${escapeHtml(item.dueQuestionCount)} / ${escapeHtml(item.questionCount)}문항</p>
      <footer>${actionButton}${schedule}</footer>
    </article>`;
  }

  function group(title, items) {
    return `<section class="learning-review-queue-group"><h5>${escapeHtml(title)} <span>${items.length}</span></h5><div class="learning-review-queue-list">${items.map(({ item, index }) => card(item, index)).join("")}</div></section>`;
  }

  function render() {
    const parentSection = document.querySelector("#parentLearningReviewQueueSection");
    const childSection = document.querySelector("#childLearningReviewQueueSection");
    const member = currentMember();
    if (parentSection) parentSection.hidden = member?.role !== "parent";
    if (childSection) childSection.hidden = member?.role !== "child";
    const container = target();
    if (!container) return;
    container.closest(".learning-review-queue-section")?.setAttribute("aria-busy", String(loading));
    if (member.role === "parent" && !selectedAssignee()) {
      container.innerHTML = '<p class="learning-analysis-empty">담당 자녀를 선택하면 복습 일정을 확인할 수 있어요.</p>';
      return;
    }
    if (loading) {
      container.innerHTML = '<p class="learning-analysis-loading">복습 일정을 불러오는 중입니다.</p>';
      return;
    }
    if (failed) {
      container.innerHTML = '<p class="learning-analysis-error">복습 일정을 불러오지 못했습니다.</p>';
      return;
    }
    if (!queue.length) {
      container.innerHTML = '<p class="learning-analysis-empty">현재 복습할 문제가 없습니다.</p>';
      return;
    }
    const indexed = queue.map((item, index) => ({ item, index }));
    const today = indexed.filter(({ item }) => item.due || item.action?.type === "resume");
    const upcoming = indexed.filter(({ item }) => !item.due && item.action?.type !== "resume");
    container.innerHTML = `${group("오늘 복습", today)}${group("예정 복습", upcoming)}`;
  }

  async function refresh() {
    const member = currentMember();
    const assignedMemberId = member?.role === "parent" ? selectedAssignee() : "";
    const requestGeneration = ++generation;
    const requestIdentity = identity();
    queue = [];
    failed = false;
    if (!member || (member.role === "parent" && !assignedMemberId)) {
      loading = false;
      render();
      return;
    }
    loading = true;
    render();
    try {
      const query = assignedMemberId ? `?assignedMemberId=${encodeURIComponent(assignedMemberId)}` : "";
      const data = await requestJson(`/api/learning/review-queue${query}`, {
        headers: authHeaders(),
        cache: "no-store",
      });
      if (requestGeneration !== generation || requestIdentity !== identity()) return;
      queue = Array.isArray(data.queue) ? data.queue : [];
    } catch {
      if (requestGeneration !== generation || requestIdentity !== identity()) return;
      failed = true;
    } finally {
      if (requestGeneration === generation && requestIdentity === identity()) {
        loading = false;
        render();
      }
    }
  }

  async function changeSchedule(index, action, durationDays) {
    const member = currentMember();
    const item = queue[index];
    const assignedMemberId = selectedAssignee();
    if (member?.role !== "parent" || !assignedMemberId || !item || busyKey) return;
    const requestGeneration = generation;
    const requestIdentity = identity();
    const requestKey = `${item.assignmentId}:${item.skill?.code}`;
    busyKey = requestKey;
    failed = false;
    render();
    try {
      await requestJson("/api/learning/review-schedule", {
        method: "PUT",
        headers: { ...authHeaders(), "X-Study-CSRF": "1", "Content-Type": "application/json" },
        body: JSON.stringify({
          assignedMemberId,
          assignmentId: item.assignmentId,
          skillCode: item.skill.code,
          action,
          ...(action === "snooze" ? { durationDays } : {}),
          requestId: crypto.randomUUID(),
        }),
      });
      if (requestGeneration !== generation || requestIdentity !== identity() || requestKey !== busyKey) return;
      busyKey = "";
      await refresh();
    } catch {
      if (requestGeneration !== generation || requestIdentity !== identity() || requestKey !== busyKey) return;
      busyKey = "";
      failed = true;
      render();
    }
  }

  document.addEventListener("click", (event) => {
    const openButton = event.target.closest("[data-review-queue-open]");
    if (openButton) {
      const item = queue[Number(openButton.dataset.reviewQueueOpen)];
      if (item) openReview(item);
      return;
    }
    const snoozeButton = event.target.closest("[data-review-queue-snooze]");
    if (snoozeButton) {
      changeSchedule(Number(snoozeButton.dataset.reviewQueueIndex), "snooze", Number(snoozeButton.dataset.reviewQueueSnooze));
      return;
    }
    const clearButton = event.target.closest("[data-review-queue-clear]");
    if (clearButton) changeSchedule(Number(clearButton.dataset.reviewQueueIndex), "clear", null);
  });

  return {
    refresh,
    render,
    reset() {
      generation += 1;
      queue = [];
      loading = false;
      failed = false;
      busyKey = "";
      render();
    },
  };
}
