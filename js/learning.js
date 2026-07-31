const difficultyLabels = {
  seed: "입문",
  leaf: "기초",
  tree: "심화",
  crown: "최상위 도전!",
};

const difficultyRewards = { seed: 1, leaf: 2, tree: 3, crown: 5 };

const stageStatusLabels = {
  locked: "잠김",
  unlocked: "학습 가능",
  passed: "통과",
};

const assignmentStatusLabels = {
  active: "학습 중",
  completed: "단원 완료",
  cancelled: "배정 취소",
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function initLearning({
  requestJson,
  authHeaders,
  currentMember,
  selectedAssignee,
  requireSelectedAssignee,
  showToast,
  refreshStickerWallet = async () => {},
}) {
  let generation = 0;
  let catalog = [];
  let assignments = [];
  let profile = null;
  let profileReady = false;
  let loading = false;
  let error = "";
  let attempt = null;
  let attemptContext = null;
  let attemptIdentity = "";
  let attemptLoading = false;
  let attemptError = "";
  let attemptViewOpen = false;
  const selectedAnswers = new Map();
  const cache = new Map();
  const attemptCache = new Map();
  const pending = new Set();
  const announcedRewardAttempts = new Set();

  function identity() {
    const member = currentMember();
    const assignee = member?.role === "parent" ? selectedAssignee() : member?.id;
    return member ? `${member.family_id}:${member.id}:${assignee || "unselected"}` : "signed-out";
  }

  function stageList(stages = [], assignment, parent) {
    return `<ol class="learning-stage-list">${stages.map((stage) => `
      <li class="learning-stage learning-stage-${escapeHtml(stage.status || "locked")}">
        <span>${escapeHtml(difficultyLabels[stage.difficulty] || "단계")}</span>
        <strong>${escapeHtml(stage.title)}</strong>
        <div class="learning-stage-actions">
          <small>${stageStatusLabels[stage.status] || "잠김"}</small>
          ${parent && stage.attempt?.status === "in_progress" ? `<button type="button" class="delete-btn" data-learning-action="abandon-attempt" data-assignment-id="${assignment.id}" data-attempt-id="${stage.attempt.id}">응시 초기화</button>` : ""}
          ${!parent && assignment.status === "active" && stage.status === "unlocked" ? `<button type="button" class="primary" data-learning-action="${stage.attempt ? "resume-attempt" : "start-attempt"}" data-assignment-id="${assignment.id}" data-stage-id="${stage.id}" data-unit-title="${escapeHtml(assignment.unitTitle)}" data-stage-title="${escapeHtml(stage.title)}" data-stage-difficulty="${escapeHtml(stage.difficulty)}" data-stage-order="${stage.order}" ${stage.attempt ? `data-attempt-id="${stage.attempt.id}"` : ""}>${stage.attempt ? "문제풀이로 이동" : "문제풀이로 이동"}</button>` : ""}
        </div>
      </li>
    `).join("")}</ol>`;
  }

  function catalogCard(item) {
    const key = `assign:${item.contentVersionId}`;
    const busy = pending.has(key);
    return `<article class="learning-card">
      <header><div><small>${escapeHtml(item.course.subjectName)} · ${escapeHtml(item.course.internalName)}</small><h4>${escapeHtml(item.unitTitle)}</h4></div><span class="${item.recommended ? "learning-recommendation-badge" : ""}">${item.recommended ? "추천" : `${item.stageCount}단계`}</span></header>
      ${stageList(item.stages, item, true)}
      <button type="button" class="primary" data-learning-action="assign" data-unit-id="${item.unitId}" data-version-id="${item.contentVersionId}" ${item.alreadyAssigned || busy ? "disabled" : ""}>
        ${item.alreadyAssigned ? "배정됨" : busy ? "배정 중…" : "이 단원 배정"}
      </button>
    </article>`;
  }

  function renderProfile() {
    const form = document.querySelector("#learningProfileForm");
    const select = document.querySelector("#learningProfileLevel");
    const status = document.querySelector("#learningProfileStatus");
    const save = document.querySelector("#learningProfileSave");
    if (!form || !select || !status || !save) return;
    const parent = currentMember()?.role === "parent";
    form.hidden = !parent;
    if (!parent) return;
    const selected = selectedAssignee();
    const saving = pending.has(`profile:${identity()}`);
    select.disabled = !selected || loading || saving;
    save.disabled = !selected || loading || saving;
    if (!selected) {
      select.value = "";
      status.textContent = "담당 자녀를 선택해 주세요.";
    } else if (!profileReady && loading) {
      select.value = "";
      status.textContent = "학습 기준을 불러오는 중입니다.";
    } else {
      select.value = profile?.level || "";
      status.textContent = profile ? `${profile.subject} · ${profile.level} 기준으로 추천합니다.` : "설정 전입니다. 부모님이 시작 기준을 선택해 주세요.";
    }
    save.textContent = saving ? "저장 중…" : "저장";
  }

  function renderCatalog() {
    const list = document.querySelector("#learningCatalogList");
    const recommendedList = document.querySelector("#learningRecommendedList");
    if (!list || !recommendedList) return;
    if (loading) {
      list.innerHTML = '<p class="learning-empty">배정 가능한 단원을 불러오는 중입니다.</p>';
      recommendedList.innerHTML = '<p class="learning-empty">추천 단원을 확인하는 중입니다.</p>';
      return;
    }
    if (error) {
      list.innerHTML = `<p class="learning-error">${escapeHtml(error)}</p>`;
      recommendedList.innerHTML = "";
      return;
    }
    if (!selectedAssignee()) {
      list.innerHTML = '<p class="learning-empty">담당 자녀를 선택하면 배정 가능한 단원을 확인할 수 있어요.</p>';
      recommendedList.innerHTML = '<p class="learning-empty">담당 자녀를 선택해 주세요.</p>';
      return;
    }
    if (!catalog.length) {
      list.innerHTML = '<p class="learning-empty">현재 배정 가능한 문제풀이 단원이 없습니다.</p>';
      recommendedList.innerHTML = '<p class="learning-empty">현재 추천 가능한 단원이 없습니다.</p>';
      return;
    }
    const recommended = catalog.filter((item) => item.recommended);
    const others = catalog.filter((item) => !item.recommended);
    recommendedList.innerHTML = recommended.length
      ? recommended.map(catalogCard).join("")
      : `<p class="learning-empty">${profile ? "현재 기준에 맞는 추천 단원이 없습니다." : "학습 기준을 설정하면 추천 단원을 먼저 보여 드려요."}</p>`;
    list.innerHTML = others.length
      ? others.map(catalogCard).join("")
      : '<p class="learning-empty">추천 외 다른 단원이 없습니다.</p>';
  }

  function renderAssignments(parent) {
    const list = document.querySelector(parent ? "#learningAssignmentList" : "#childLearningAssignmentList");
    if (!list) return;
    if (loading) {
      list.innerHTML = '<p class="learning-empty">배정된 단원을 불러오는 중입니다.</p>';
      return;
    }
    if (error) {
      list.innerHTML = `<p class="learning-error">${escapeHtml(error)}</p>`;
      return;
    }
    if (parent && !selectedAssignee()) {
      list.innerHTML = '<p class="learning-empty">담당 자녀를 선택하면 배정 현황을 확인할 수 있어요.</p>';
      return;
    }
    if (!assignments.length) {
      list.innerHTML = '<p class="learning-empty">아직 배정된 문제풀이 단원이 없습니다.</p>';
      return;
    }
    list.innerHTML = assignments.map((assignment) => {
      const key = `cancel:${assignment.id}`;
      const busy = pending.has(key);
      const parentMeta = parent && assignment.course
        ? `<small>${escapeHtml(assignment.course.subjectName)} · ${escapeHtml(assignment.course.internalName)}</small>`
        : "";
      return `<article class="learning-card learning-assignment-card">
        <header><div>${parentMeta}<h4>${escapeHtml(assignment.unitTitle)}</h4></div><span class="learning-assignment-status">${escapeHtml(assignmentStatusLabels[assignment.status] || assignment.status)}</span></header>
        ${stageList(assignment.stages, assignment, parent)}
        ${parent && assignment.status === "active" ? `<button type="button" class="delete-btn" data-learning-action="cancel" data-assignment-id="${assignment.id}" ${busy ? "disabled" : ""}>${busy ? "취소 중…" : "배정 취소"}</button>` : ""}
      </article>`;
    }).join("");
  }

  function resultMarkup(result) {
    if (!result) return "";
    const reward = result.passed && result.rewardGranted === true && result.rewardAmount > 0
      ? `<small class="learning-reward">최초 통과 보상 · 스티커 +${result.rewardAmount}</small>`
      : result.passed && result.firstPass === false
        ? '<small>이 단계의 최초 통과 보상은 이미 받았어요.</small>'
        : "";
    const progression = result.passed && result.assignmentCompleted === true
      ? '<small class="learning-unlock">단원의 모든 단계를 완료했어요!</small>'
      : result.passed && result.unlockedStageId
        ? '<small class="learning-unlock">다음 단계가 열렸어요!</small>'
        : "";
    const nextStage = result.passed && !result.assignmentCompleted ? nextUnlockedStage() : null;
    return `<div class="learning-result">
      <strong>${result.passed ? "단계를 통과했어요!" : "아쉽지만 다시 도전할 수 있어요."}</strong>
      <span>${result.correctAnswers}개 정답 · 통과 기준 ${result.requiredCorrectAnswers}개</span>
      ${result.passed ? `${reward}${progression}${nextStage ? `<button type="button" class="primary" data-learning-action="start-attempt" data-assignment-id="${escapeHtml(attemptContext?.assignmentId || "")}" data-stage-id="${escapeHtml(nextStage.id)}" data-unit-title="${escapeHtml(attemptContext?.unitTitle || "")}" data-stage-title="${escapeHtml(nextStage.title)}" data-stage-difficulty="${escapeHtml(nextStage.difficulty)}" data-stage-order="${nextStage.order}">다음 단계</button>` : result.assignmentCompleted ? '<strong class="learning-unit-complete">단원 완료</strong>' : ""}` : `<button type="button" class="primary" data-learning-action="retry-attempt" data-assignment-id="${attemptContext?.assignmentId || ""}" data-stage-id="${attemptContext?.stageId || ""}" data-unit-title="${escapeHtml(attemptContext?.unitTitle || "")}" data-stage-title="${escapeHtml(attemptContext?.stageTitle || "")}" data-stage-difficulty="${escapeHtml(attemptContext?.difficulty || "")}" data-stage-order="${attemptContext?.stageOrder || ""}">다시 도전</button>`}
    </div>`;
  }

  function nextUnlockedStage() {
    const assignment = assignments.find((item) => item.id === attemptContext?.assignmentId);
    if (!assignment) return null;
    const currentOrder = Number(attemptContext?.stageOrder || 0);
    return assignment.stages.find((stage) => stage.order === currentOrder + 1 && stage.status === "unlocked") || null;
  }

  async function applyAttemptResult(nextAttempt, requestIdentity, { announceReward = false } = {}) {
    attempt = nextAttempt;
    attemptIdentity = requestIdentity;
    attemptCache.set(`${requestIdentity}:${attempt.id}`, attempt);
    const result = attempt.result;
    if (!result?.passed || requestIdentity !== identity()) return;

    cache.delete(requestIdentity);
    const refreshTasks = [refresh({ force: true })];
    if (result.rewardGranted === true && result.rewardAmount > 0) {
      const announcementKey = `${requestIdentity}:${attempt.id}`;
      if (announceReward && !announcedRewardAttempts.has(announcementKey)) {
        announcedRewardAttempts.add(announcementKey);
        showToast(`최초 통과 보상으로 스티커 +${result.rewardAmount}을 받았어요!`);
      }
      refreshTasks.push(Promise.resolve().then(() => refreshStickerWallet()));
    }
    const refreshResults = await Promise.allSettled(refreshTasks);
    if (refreshResults.some((item) => item.status === "rejected")) {
      console.warn("[learning reward] follow-up refresh failed");
    }
  }

  function renderAttempt() {
    const legacyPanel = document.querySelector("#childLearningAttemptPanel");
    const view = document.querySelector("#learningAttemptView");
    const panel = document.querySelector("#learningAttemptFullscreenPanel");
    const member = currentMember();
    if (!panel || !view) return;
    if (legacyPanel) {
      legacyPanel.hidden = true;
      legacyPanel.innerHTML = "";
    }
    if (member?.role !== "child" || !attemptViewOpen) {
      view.hidden = true;
      document.body.classList.remove("learning-attempt-open");
      panel.innerHTML = "";
      return;
    }
    view.hidden = false;
    document.body.classList.add("learning-attempt-open");
    const title = document.querySelector("#learningAttemptTitle");
    const stageName = document.querySelector("#learningAttemptStageName");
    const stageProgress = document.querySelector("#learningAttemptStageProgress");
    if (title) title.textContent = attemptContext?.unitTitle || "문제풀이";
    if (stageName) stageName.textContent = `${difficultyLabels[attemptContext?.difficulty] || "단계"} · 최초 통과 +${difficultyRewards[attemptContext?.difficulty] || 0}`;
    if (stageProgress) stageProgress.innerHTML = [1, 2, 3, 4].map((order) => `<span class="${order < Number(attemptContext?.stageOrder) ? "complete" : order === Number(attemptContext?.stageOrder) ? "current" : ""}">${order}</span>`).join("");
    if (attemptLoading) {
      panel.innerHTML = '<p class="learning-empty">문제를 불러오는 중입니다.</p>';
      return;
    }
    if (attemptError && !attempt) {
      panel.innerHTML = `<p class="learning-error">${escapeHtml(attemptError)}</p>${attempt?.id ? `<button type="button" data-learning-action="reload-attempt" data-attempt-id="${attempt.id}">다시 불러오기</button>` : ""}`;
      return;
    }
    if (!attempt) return;
    const questions = Array.isArray(attempt.questions) ? attempt.questions : [];
    const unanswered = questions.filter((question) => !question.answer);
    const allSelected = unanswered.length > 0 && unanswered.every((question) => selectedAnswers.has(question.id));
    const submitting = pending.has(`answers:${attempt.id}`);
    const progress = `<p class="learning-attempt-progress">${attempt.answeredCount} / ${attempt.totalQuestions} 문제 완료</p>`;
    const questionMarkup = questions.map((question) => {
      const selectedId = question.answer?.selectedOptionId || selectedAnswers.get(question.id) || "";
      const feedbackClass = question.answer ? (question.answer.isCorrect ? "is-correct" : "is-incorrect") : "";
      return `<article class="learning-question-card ${feedbackClass}" data-question-id="${question.id}">
        <h3>${question.order}. ${escapeHtml(question.prompt)}</h3>
        <fieldset class="learning-options" aria-label="${question.order}번 답 선택" ${question.answer || submitting ? "disabled" : ""}>
          ${question.options.map((option) => {
            const checked = option.id === selectedId;
            const isCorrect = question.answer && option.text === question.answer.correctOptionText;
            const isWrongSelection = question.answer && checked && !question.answer.isCorrect;
            const state = isCorrect ? "correct" : isWrongSelection ? "incorrect" : "";
            const stateText = isCorrect ? '<em>✓ 정답</em>' : isWrongSelection ? '<em>✕ 선택한 답</em>' : "";
            return `<label class="learning-option ${state}"><input type="radio" name="learningAnswer-${question.id}" value="${option.id}" data-question-id="${question.id}" ${checked ? "checked" : ""}><span class="learning-option-indicator" aria-hidden="true"></span><span class="learning-option-text">${escapeHtml(option.text)}</span>${stateText}</label>`;
          }).join("")}
        </fieldset>
        ${question.answer ? `<div class="learning-feedback ${question.answer.isCorrect ? "" : "incorrect"}"><strong>${question.answer.isCorrect ? "✓ 정답" : `✕ 오답 · 정답 ${escapeHtml(question.answer.correctOptionText)}`}</strong><p>${escapeHtml(question.answer.explanation || "해설이 없습니다.")}</p></div>` : ""}
      </article>`;
    }).join("");
    const action = attempt.result
      ? resultMarkup(attempt.result)
      : `<button type="button" class="primary learning-submit-all" data-learning-action="submit-all-answers" ${allSelected && !submitting ? "" : "disabled"}>${submitting ? "답안을 저장하는 중…" : "답안 제출"}</button>`;
    panel.innerHTML = `${progress}${attemptError ? `<p class="learning-error">${escapeHtml(attemptError)}</p>` : ""}<div class="learning-question-list">${questionMarkup}</div>${action}`;
  }

  function render() {
    const member = currentMember();
    const parent = member?.role === "parent";
    const childSection = document.querySelector("#childLearningSection");
    if (childSection) childSection.hidden = member?.role !== "child";
    renderCatalog();
    renderProfile();
    renderAssignments(true);
    renderAssignments(false);
    renderAttempt();
    const parentPanel = document.querySelector("#parentPanelLearning");
    if (parentPanel) parentPanel.dataset.viewerRole = parent ? "parent" : "hidden";
  }

  function requestId() {
    return crypto.randomUUID();
  }

  async function loadAttempt(attemptId, context = attemptContext) {
    const requestGeneration = generation;
    const requestIdentity = identity();
    attemptLoading = true;
    attemptError = "";
    attemptContext = context;
    attemptIdentity = requestIdentity;
    attemptViewOpen = true;
    renderAttempt();
    try {
      const data = await requestJson(`/api/learning/attempts/${encodeURIComponent(attemptId)}`, {
        headers: authHeaders(),
        cache: "no-store",
      });
      if (requestGeneration !== generation || requestIdentity !== identity()) return;
      attemptLoading = false;
      await applyAttemptResult(data.attempt, requestIdentity);
    } catch (cause) {
      if (requestGeneration !== generation || requestIdentity !== identity()) return;
      attemptError = cause.message || "문제를 불러오지 못했습니다.";
    } finally {
      if (requestGeneration === generation && requestIdentity === identity()) {
        attemptLoading = false;
        renderAttempt();
      }
    }
  }

  async function startAttempt(button) {
    const member = currentMember();
    if (member?.role !== "child") return;
    const assignmentId = button.dataset.assignmentId;
    const stageId = button.dataset.stageId;
    const key = `attempt-start:${assignmentId}:${stageId}`;
    if (pending.has(key)) return;
    const requestGeneration = generation;
    const requestIdentity = identity();
    pending.add(key);
    attemptLoading = true;
    attemptError = "";
    selectedAnswers.clear();
    attemptContext = {
      assignmentId,
      stageId,
      unitTitle: button.dataset.unitTitle || "문제풀이",
      stageTitle: button.dataset.stageTitle || "",
      difficulty: button.dataset.stageDifficulty || "",
      stageOrder: Number(button.dataset.stageOrder || 0),
    };
    attemptIdentity = requestIdentity;
    attemptViewOpen = true;
    render();
    try {
      const data = await requestJson(`/api/learning/assignments/${encodeURIComponent(assignmentId)}/stages/${encodeURIComponent(stageId)}/attempts`, {
        method: "POST",
        headers: { ...authHeaders(), "X-Study-CSRF": "1" },
        body: JSON.stringify({ requestId: requestId() }),
      });
      if (requestGeneration !== generation || requestIdentity !== identity()) return;
      attempt = data.attempt;
      attemptCache.set(`${requestIdentity}:${attempt.id}`, attempt);
    } catch (cause) {
      if (requestGeneration !== generation || requestIdentity !== identity()) return;
      attemptError = cause.message || "응시를 시작하지 못했습니다.";
    } finally {
      pending.delete(key);
      if (requestGeneration === generation && requestIdentity === identity()) {
        attemptLoading = false;
        render();
      }
    }
  }

  async function submitAllAnswers() {
    if (!attempt?.id || attempt.result) return;
    const unanswered = (attempt.questions || []).filter((question) => !question.answer);
    if (!unanswered.length || unanswered.some((question) => !selectedAnswers.has(question.id))) {
      showToast("모든 문제의 답을 선택해 주세요.");
      return;
    }
    const key = `answers:${attempt.id}`;
    if (pending.has(key)) return;
    const requestGeneration = generation;
    const requestIdentity = identity();
    pending.add(key);
    attemptError = "";
    renderAttempt();
    try {
      for (const question of unanswered.sort((a, b) => a.order - b.order)) {
        const data = await requestJson(`/api/learning/attempts/${encodeURIComponent(attempt.id)}/answers`, {
          method: "POST",
          headers: { ...authHeaders(), "X-Study-CSRF": "1" },
          body: JSON.stringify({
            questionId: question.id,
            optionId: selectedAnswers.get(question.id),
            requestId: requestId(),
          }),
        });
        if (requestGeneration !== generation || requestIdentity !== identity()) return;
        selectedAnswers.delete(question.id);
        await applyAttemptResult(data.attempt, requestIdentity, { announceReward: true });
      }
    } catch (cause) {
      if (requestGeneration !== generation || requestIdentity !== identity()) return;
      const message = cause.message || "일부 답안을 저장하지 못했습니다. 저장된 답은 유지됩니다.";
      try {
        const data = await requestJson(`/api/learning/attempts/${encodeURIComponent(attempt.id)}`, {
          headers: authHeaders(),
          cache: "no-store",
        });
        if (requestGeneration === generation && requestIdentity === identity()) attempt = data.attempt;
      } catch {}
      attemptError = message;
    } finally {
      pending.delete(key);
      if (requestGeneration === generation && requestIdentity === identity()) renderAttempt();
    }
  }

  async function finalizeAttempt() {
    if (!attempt?.id) return;
    const key = `finalize:${attempt.id}`;
    if (pending.has(key)) return;
    const requestGeneration = generation;
    const requestIdentity = identity();
    pending.add(key);
    try {
      const data = await requestJson(`/api/learning/attempts/${encodeURIComponent(attempt.id)}/finalize`, {
        method: "POST",
        headers: { ...authHeaders(), "X-Study-CSRF": "1" },
        body: JSON.stringify({ requestId: requestId() }),
      });
      if (requestGeneration !== generation || requestIdentity !== identity()) return;
      await applyAttemptResult(data.attempt, requestIdentity, { announceReward: true });
    } catch (cause) {
      if (requestGeneration !== generation || requestIdentity !== identity()) return;
      attemptError = cause.message || "결과를 확인하지 못했습니다.";
    } finally {
      pending.delete(key);
      if (requestGeneration === generation && requestIdentity === identity()) renderAttempt();
    }
  }

  async function abandonAttempt(button) {
    const assignedMemberId = requireSelectedAssignee();
    if (!confirm("진행 중인 응시를 초기화할까요? 기존 답안 기록은 보존됩니다.")) return;
    const requestIdentity = identity();
    const requestGeneration = generation;
    const key = `abandon:${button.dataset.attemptId}`;
    if (pending.has(key)) return;
    pending.add(key);
    render();
    try {
      await requestJson(`/api/learning/attempts/${encodeURIComponent(button.dataset.attemptId)}/abandon`, {
        method: "POST",
        headers: { ...authHeaders(), "X-Study-CSRF": "1" },
        body: JSON.stringify({ assignedMemberId, assignmentId: button.dataset.assignmentId }),
      });
      cache.delete(requestIdentity);
      if (requestGeneration === generation && requestIdentity === identity()) {
        showToast("진행 중인 응시를 초기화했어요.");
        await refresh({ force: true });
      }
    } catch (cause) {
      if (requestGeneration === generation && requestIdentity === identity()) {
        error = cause.message;
      }
    } finally {
      pending.delete(key);
      if (requestGeneration === generation && requestIdentity === identity()) render();
    }
  }

  async function refresh({ force = false } = {}) {
    const member = currentMember();
    const requestIdentity = identity();
    const requestGeneration = ++generation;
    if (attemptIdentity && attemptIdentity !== requestIdentity) {
      attempt = null;
      attemptContext = null;
      attemptIdentity = "";
      attemptLoading = false;
      attemptError = "";
      attemptViewOpen = false;
      selectedAnswers.clear();
      announcedRewardAttempts.clear();
    }
    catalog = [];
    assignments = [];
    profile = null;
    profileReady = false;
    error = "";
    if (!member) {
      loading = false;
      render();
      return;
    }
    const assignedMemberId = member.role === "parent" ? selectedAssignee() : "";
    if (member.role === "parent" && !assignedMemberId) {
      loading = false;
      render();
      return;
    }
    const cached = !force && cache.get(requestIdentity);
    if (cached) {
      catalog = cached.catalog;
      assignments = cached.assignments;
      profile = cached.profile;
      profileReady = true;
      loading = false;
      render();
    } else {
      loading = true;
      render();
    }
    try {
      const query = assignedMemberId ? `?assignedMemberId=${encodeURIComponent(assignedMemberId)}` : "";
      const requests = member.role === "parent"
          ? [
            requestJson(`/api/learning/profile${query}`, { headers: authHeaders(), cache: "no-store" }),
            requestJson(`/api/learning/catalog${query}`, { headers: authHeaders(), cache: "no-store" }),
            requestJson(`/api/learning/assignments${query}`, { headers: authHeaders(), cache: "no-store" }),
          ]
        : [Promise.resolve({ profile: null }), Promise.resolve({ catalog: [] }), requestJson("/api/learning/assignments", {
            headers: authHeaders(),
            cache: "no-store",
          })];
      const [profileData, catalogData, assignmentData] = await Promise.all(requests);
      if (requestGeneration !== generation || requestIdentity !== identity()) return;
      catalog = catalogData.catalog || [];
      assignments = assignmentData.assignments || [];
      profile = profileData.profile || null;
      profileReady = true;
      cache.set(requestIdentity, { catalog, assignments, profile });
      error = "";
    } catch (cause) {
      if (requestGeneration !== generation || requestIdentity !== identity()) return;
      catalog = [];
      assignments = [];
      error = cause.message || "문제풀이 학습 정보를 불러오지 못했습니다.";
    } finally {
      if (requestGeneration === generation && requestIdentity === identity()) {
        loading = false;
        render();
      }
    }
  }

  async function assign(button) {
    const assignedMemberId = requireSelectedAssignee();
    const requestIdentity = identity();
    const key = `assign:${button.dataset.versionId}`;
    if (pending.has(key)) return;
    pending.add(key);
    render();
    try {
      await requestJson("/api/learning/assignments", {
        method: "POST",
        headers: { ...authHeaders(), "X-Study-CSRF": "1" },
        body: JSON.stringify({
          assignedMemberId,
          unitId: button.dataset.unitId,
          contentVersionId: button.dataset.versionId,
        }),
      });
      cache.delete(requestIdentity);
      if (requestIdentity === identity()) {
        showToast("문제풀이 단원을 배정했어요.");
        await refresh({ force: true });
      }
    } catch (cause) {
      if (requestIdentity === identity()) {
        error = cause.message;
        render();
      }
    } finally {
      pending.delete(key);
      if (requestIdentity === identity()) render();
    }
  }

  async function saveProfile() {
    const assignedMemberId = requireSelectedAssignee();
    const level = document.querySelector("#learningProfileLevel")?.value || "";
    if (!level) {
      showToast("학습 기준을 선택해 주세요.");
      return;
    }
    const requestIdentity = identity();
    const requestGeneration = generation;
    const key = `profile:${requestIdentity}`;
    if (pending.has(key)) return;
    pending.add(key);
    render();
    try {
      const data = await requestJson("/api/learning/profile", {
        method: "PUT",
        headers: { ...authHeaders(), "X-Study-CSRF": "1" },
        body: JSON.stringify({ assignedMemberId, subject: "수학", level }),
      });
      if (requestGeneration !== generation || requestIdentity !== identity()) return;
      profile = data.profile;
      profileReady = true;
      cache.delete(requestIdentity);
      showToast("수학 학습 기준을 저장했어요.");
      pending.delete(key);
      await refresh({ force: true });
    } catch (cause) {
      if (requestGeneration === generation && requestIdentity === identity()) {
        error = cause.message;
      }
    } finally {
      pending.delete(key);
      if (requestGeneration === generation && requestIdentity === identity()) render();
    }
  }

  async function cancel(button) {
    const assignedMemberId = requireSelectedAssignee();
    const requestIdentity = identity();
    const assignmentId = button.dataset.assignmentId;
    const key = `cancel:${assignmentId}`;
    if (pending.has(key)) return;
    pending.add(key);
    render();
    try {
      await requestJson(`/api/learning/assignments/${encodeURIComponent(assignmentId)}/cancel`, {
        method: "POST",
        headers: { ...authHeaders(), "X-Study-CSRF": "1" },
        body: JSON.stringify({ assignedMemberId }),
      });
      cache.delete(requestIdentity);
      if (requestIdentity === identity()) {
        showToast("문제풀이 배정을 취소했어요.");
        await refresh({ force: true });
      }
    } catch (cause) {
      if (requestIdentity === identity()) {
        error = cause.message;
        render();
      }
    } finally {
      pending.delete(key);
      if (requestIdentity === identity()) render();
    }
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-learning-action]");
    if (!button || button.disabled) return;
    if (button.dataset.learningAction === "assign") assign(button);
    if (button.dataset.learningAction === "cancel") cancel(button);
    if (button.dataset.learningAction === "start-attempt" || button.dataset.learningAction === "retry-attempt") startAttempt(button);
    if (button.dataset.learningAction === "resume-attempt") loadAttempt(button.dataset.attemptId, {
      assignmentId: button.dataset.assignmentId,
      stageId: button.dataset.stageId,
      unitTitle: button.dataset.unitTitle,
      stageTitle: button.dataset.stageTitle,
      difficulty: button.dataset.stageDifficulty,
      stageOrder: Number(button.dataset.stageOrder || 0),
    });
    if (button.dataset.learningAction === "reload-attempt") loadAttempt(button.dataset.attemptId);
    if (button.dataset.learningAction === "submit-all-answers") submitAllAnswers();
    if (button.dataset.learningAction === "finalize-attempt") finalizeAttempt();
    if (button.dataset.learningAction === "abandon-attempt") abandonAttempt(button);
    if (button.dataset.learningAction === "close-attempt") {
      attemptViewOpen = false;
      selectedAnswers.clear();
      attemptError = "";
      renderAttempt();
    }
  });

  document.addEventListener("change", (event) => {
    const input = event.target.closest('#learningAttemptFullscreenPanel input[type="radio"][data-question-id]');
    if (!input || input.disabled || !attemptViewOpen) return;
    selectedAnswers.set(input.dataset.questionId, input.value);
    renderAttempt();
  });

  document.addEventListener("submit", (event) => {
    if (event.target?.id !== "learningProfileForm") return;
    event.preventDefault();
    saveProfile();
  });

  return {
    refresh,
    render,
    reset() {
      generation += 1;
      catalog = [];
      assignments = [];
      profile = null;
      profileReady = false;
      loading = false;
      error = "";
      pending.clear();
      attempt = null;
      attemptContext = null;
      attemptIdentity = "";
      attemptLoading = false;
      attemptError = "";
      attemptViewOpen = false;
      selectedAnswers.clear();
      attemptCache.clear();
      announcedRewardAttempts.clear();
      render();
    },
  };
}
