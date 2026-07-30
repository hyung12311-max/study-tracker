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
  const cache = new Map();
  const pending = new Set();

  function identity() {
    const member = currentMember();
    const assignee = member?.role === "parent" ? selectedAssignee() : member?.id;
    return member ? `${member.family_id}:${member.id}:${assignee || "unselected"}` : "signed-out";
  }

  function stageList(stages = []) {
    return `<ol class="learning-stage-list">${stages.map((stage) => `
      <li class="learning-stage learning-stage-${escapeHtml(stage.status || "locked")}">
        <span>${difficultyLabels[stage.difficulty] || "📘"}</span>
        <strong>${escapeHtml(stage.title)}</strong>
        <small>${stageStatusLabels[stage.status] || "잠김"}</small>
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
        ${stageList(item.stages)}
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
        ${stageList(assignment.stages)}
        ${parent && assignment.status === "active" ? `<button type="button" class="delete-btn" data-learning-action="cancel" data-assignment-id="${assignment.id}" ${busy ? "disabled" : ""}>${busy ? "취소 중…" : "배정 취소"}</button>` : ""}
        ${parent ? "" : '<button type="button" disabled>문제풀이 기능 준비 중</button>'}
      </article>`;
    }).join("");
  }

  function render() {
    const member = currentMember();
    const parent = member?.role === "parent";
    const childSection = document.querySelector("#childLearningSection");
    if (childSection) childSection.hidden = member?.role !== "child";
    renderCatalog();
    renderAssignments(true);
    renderAssignments(false);
    const parentPanel = document.querySelector("#parentPanelLearning");
    if (parentPanel) parentPanel.dataset.viewerRole = parent ? "parent" : "hidden";
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
      render();
    },
  };
}
