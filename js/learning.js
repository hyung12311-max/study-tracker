const difficultyLabels = {
  seed: "🌱",
  leaf: "🌿",
  tree: "🌳",
  crown: "👑",
};

const stageStatusLabels = {
  locked: "잠김",
  unlocked: "학습 가능",
  passed: "통과",
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
}) {
  let generation = 0;
  let catalog = [];
  let assignments = [];
  let loading = false;
  let error = "";
  let attempt = null;
  let attemptContext = null;
  let attemptIdentity = "";
  let attemptLoading = false;
  let attemptError = "";
  let feedback = null;
  const cache = new Map();
  const attemptCache = new Map();
  const pending = new Set();

  function identity() {
    const member = currentMember();
    const assignee = member?.role === "parent" ? selectedAssignee() : member?.id;
    return member ? `${member.family_id}:${member.id}:${assignee || "unselected"}` : "signed-out";
  }

  function stageList(stages = [], assignment, parent) {
    return `<ol class="learning-stage-list">${stages.map((stage) => `
      <li class="learning-stage learning-stage-${escapeHtml(stage.status || "locked")}">
        <span>${difficultyLabels[stage.difficulty] || "📘"}</span>
        <strong>${escapeHtml(stage.title)}</strong>
        <div class="learning-stage-actions">
          <small>${stageStatusLabels[stage.status] || "잠김"}</small>
          ${parent && stage.attempt?.status === "in_progress" ? `<button type="button" class="delete-btn" data-learning-action="abandon-attempt" data-assignment-id="${assignment.id}" data-attempt-id="${stage.attempt.id}">응시 초기화</button>` : ""}
          ${!parent && assignment.status === "active" && stage.status === "unlocked" ? `<button type="button" class="primary" data-learning-action="${stage.attempt ? "resume-attempt" : "start-attempt"}" data-assignment-id="${assignment.id}" data-stage-id="${stage.id}" ${stage.attempt ? `data-attempt-id="${stage.attempt.id}"` : ""}>${stage.attempt ? "이어 풀기" : "문제 풀기"}</button>` : ""}
        </div>
      </li>
    `).join("")}</ol>`;
  }

  function renderCatalog() {
    const list = document.querySelector("#learningCatalogList");
    if (!list) return;
    if (loading) {
      list.innerHTML = '<p class="learning-empty">배정 가능한 단원을 불러오는 중입니다.</p>';
      return;
    }
    if (error) {
      list.innerHTML = `<p class="learning-error">${escapeHtml(error)}</p>`;
      return;
    }
    if (!selectedAssignee()) {
      list.innerHTML = '<p class="learning-empty">담당 자녀를 선택하면 배정 가능한 단원을 확인할 수 있어요.</p>';
      return;
    }
    if (!catalog.length) {
      list.innerHTML = '<p class="learning-empty">현재 배정 가능한 문제풀이 단원이 없습니다.</p>';
      return;
    }
    list.innerHTML = catalog.map((item) => {
      const key = `assign:${item.contentVersionId}`;
      const busy = pending.has(key);
      return `<article class="learning-card">
        <header><div><small>${escapeHtml(item.course.subjectName)} · ${escapeHtml(item.course.internalName)}</small><h4>${escapeHtml(item.unitTitle)}</h4></div><span>${item.stageCount}단계</span></header>
        ${stageList(item.stages, item, true)}
        <button type="button" class="primary" data-learning-action="assign" data-unit-id="${item.unitId}" data-version-id="${item.contentVersionId}" ${item.alreadyAssigned || busy ? "disabled" : ""}>
          ${item.alreadyAssigned ? "배정됨" : busy ? "배정 중…" : "이 단원 배정"}
        </button>
      </article>`;
    }).join("");
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
        <header><div>${parentMeta}<h4>${escapeHtml(assignment.unitTitle)}</h4></div><span class="learning-assignment-status">${escapeHtml(assignment.status)}</span></header>
        ${stageList(assignment.stages, assignment, parent)}
        ${parent && assignment.status === "active" ? `<button type="button" class="delete-btn" data-learning-action="cancel" data-assignment-id="${assignment.id}" ${busy ? "disabled" : ""}>${busy ? "취소 중…" : "배정 취소"}</button>` : ""}
      </article>`;
    }).join("");
  }

  function resultMarkup(result) {
    if (!result) return "";
    return `<div class="learning-result">
      <strong>${result.passed ? "단계를 통과했어요!" : "아쉽지만 다시 도전할 수 있어요."}</strong>
      <span>${result.correctAnswers}개 정답 · 통과 기준 ${result.requiredCorrectAnswers}개</span>
      ${result.passed ? '<small>다음 단계 해금과 보상은 아직 준비 중이에요.</small>' : `<button type="button" class="primary" data-learning-action="retry-attempt" data-assignment-id="${attemptContext?.assignmentId || ""}" data-stage-id="${attemptContext?.stageId || ""}">다시 도전</button>`}
    </div>`;
  }

  function renderAttempt() {
    const panel = document.querySelector("#childLearningAttemptPanel");
    const member = currentMember();
    if (!panel) return;
    if (member?.role !== "child" || (!attempt && !attemptLoading && !attemptError)) {
      panel.hidden = true;
      panel.innerHTML = "";
      return;
    }
    panel.hidden = false;
    if (attemptLoading) {
      panel.innerHTML = '<p class="learning-empty">문제를 불러오는 중입니다.</p>';
      return;
    }
    if (attemptError) {
      panel.innerHTML = `<p class="learning-error">${escapeHtml(attemptError)}</p>${attempt?.id ? `<button type="button" data-learning-action="reload-attempt" data-attempt-id="${attempt.id}">다시 불러오기</button>` : ""}`;
      return;
    }
    if (!attempt) return;
    const progress = `<p class="learning-attempt-progress">${attempt.answeredCount} / ${attempt.totalQuestions} 문제 완료</p>`;
    if (feedback) {
      panel.innerHTML = `${progress}<div class="learning-feedback ${feedback.isCorrect ? "" : "incorrect"}">
        <strong>${feedback.isCorrect ? "정답이에요!" : "다시 기억해 보아요."}</strong>
        ${feedback.isCorrect ? "" : `<p>정답: ${escapeHtml(feedback.correctOptionText)}</p>`}
        <p>${escapeHtml(feedback.explanation || "해설이 없습니다.")}</p>
      </div>${feedback.hasRemaining ? '<button type="button" class="primary" data-learning-action="next-question">다음 문제</button>' : resultMarkup(attempt.result)}`;
      return;
    }
    if (attempt.result) {
      panel.innerHTML = progress + resultMarkup(attempt.result);
      return;
    }
    const question = attempt.currentQuestion;
    if (!question) {
      panel.innerHTML = `${progress}<button type="button" data-learning-action="finalize-attempt">결과 확인</button>`;
      return;
    }
    panel.innerHTML = `${progress}<div class="learning-question">
      <h4>${question.order}. ${escapeHtml(question.prompt)}</h4>
      <fieldset class="learning-options" aria-label="답 선택">
        ${question.options.map((option) => `<label class="learning-option"><input type="radio" name="learningAnswer" value="${option.id}"><span>${escapeHtml(option.text)}</span></label>`).join("")}
      </fieldset>
      <button type="button" class="primary" data-learning-action="submit-answer" data-question-id="${question.id}">답 제출</button>
    </div>`;
  }

  function render() {
    const member = currentMember();
    const parent = member?.role === "parent";
    const childSection = document.querySelector("#childLearningSection");
    if (childSection) childSection.hidden = member?.role !== "child";
    renderCatalog();
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
    feedback = null;
    attemptContext = context;
    attemptIdentity = requestIdentity;
    renderAttempt();
    try {
      const data = await requestJson(`/api/learning/attempts/${encodeURIComponent(attemptId)}`, {
        headers: authHeaders(),
        cache: "no-store",
      });
      if (requestGeneration !== generation || requestIdentity !== identity()) return;
      attempt = data.attempt;
      attemptCache.set(`${requestIdentity}:${attemptId}`, data.attempt);
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
    feedback = null;
    attemptContext = { assignmentId, stageId };
    attemptIdentity = requestIdentity;
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

  async function submitAnswer(button) {
    if (!attempt?.id || feedback) return;
    const selected = document.querySelector('#childLearningAttemptPanel input[name="learningAnswer"]:checked');
    if (!selected) {
      showToast("답을 하나 선택해 주세요.");
      return;
    }
    const key = `answer:${attempt.id}:${button.dataset.questionId}`;
    if (pending.has(key)) return;
    const requestGeneration = generation;
    const requestIdentity = identity();
    pending.add(key);
    renderAttempt();
    try {
      const data = await requestJson(`/api/learning/attempts/${encodeURIComponent(attempt.id)}/answers`, {
        method: "POST",
        headers: { ...authHeaders(), "X-Study-CSRF": "1" },
        body: JSON.stringify({
          questionId: button.dataset.questionId,
          optionId: selected.value,
          requestId: requestId(),
        }),
      });
      if (requestGeneration !== generation || requestIdentity !== identity()) return;
      feedback = data.feedback;
      attempt = data.attempt;
      attemptCache.set(`${requestIdentity}:${attempt.id}`, attempt);
    } catch (cause) {
      if (requestGeneration !== generation || requestIdentity !== identity()) return;
      attemptError = cause.message || "답안을 제출하지 못했습니다.";
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
      attempt = data.attempt;
      feedback = null;
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
    catalog = [];
    assignments = [];
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
            requestJson(`/api/learning/catalog${query}`, { headers: authHeaders(), cache: "no-store" }),
            requestJson(`/api/learning/assignments${query}`, { headers: authHeaders(), cache: "no-store" }),
          ]
        : [Promise.resolve({ catalog: [] }), requestJson("/api/learning/assignments", {
            headers: authHeaders(),
            cache: "no-store",
          })];
      const [catalogData, assignmentData] = await Promise.all(requests);
      if (requestGeneration !== generation || requestIdentity !== identity()) return;
      catalog = catalogData.catalog || [];
      assignments = assignmentData.assignments || [];
      cache.set(requestIdentity, { catalog, assignments });
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
    if (button.dataset.learningAction === "resume-attempt") loadAttempt(button.dataset.attemptId, { assignmentId: button.dataset.assignmentId, stageId: button.dataset.stageId });
    if (button.dataset.learningAction === "reload-attempt") loadAttempt(button.dataset.attemptId);
    if (button.dataset.learningAction === "submit-answer") submitAnswer(button);
    if (button.dataset.learningAction === "next-question") loadAttempt(attempt.id);
    if (button.dataset.learningAction === "finalize-attempt") finalizeAttempt();
    if (button.dataset.learningAction === "abandon-attempt") abandonAttempt(button);
  });

  return {
    refresh,
    render,
    reset() {
      generation += 1;
      catalog = [];
      assignments = [];
      loading = false;
      error = "";
      pending.clear();
      attempt = null;
      attemptContext = null;
      attemptIdentity = "";
      attemptLoading = false;
      attemptError = "";
      feedback = null;
      attemptCache.clear();
      render();
    },
  };
}
