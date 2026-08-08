function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function uniqueOptions(items, readValues, fallback) {
  const values = new Map();
  for (const item of items) {
    for (const value of readValues(item)) {
      if (value?.id && !values.has(String(value.id))) values.set(String(value.id), value.label || fallback);
    }
  }
  return [...values.entries()].sort((left, right) => String(left[1]).localeCompare(String(right[1]), "ko"));
}

export function initLearningMistakes({ requestJson, authHeaders, currentMember, selectedAssignee }) {
  let generation = 0;
  let assignmentId = "";
  let assignmentTitle = "";
  let mistakes = [];
  let loading = false;
  let failed = false;
  let revealFailed = false;
  const revealing = new Set();
  const filters = { stage: "", skill: "", status: "" };

  function identity() {
    const member = currentMember();
    return member ? `${member.id}:${selectedAssignee() || "unselected"}` : "signed-out";
  }

  function selectOptions(select, values, selectedValue) {
    if (!select) return;
    const label = select.options[0]?.textContent || "전체";
    select.innerHTML = `<option value="">${escapeHtml(label)}</option>${values.map(([value, text]) => (
      `<option value="${escapeHtml(value)}" ${value === selectedValue ? "selected" : ""}>${escapeHtml(text)}</option>`
    )).join("")}`;
  }

  function filteredMistakes() {
    return mistakes.filter((item) => (
      (!filters.stage || item.stage?.id === filters.stage)
      && (!filters.skill || (item.skills || []).some((skill) => skill.code === filters.skill))
      && (!filters.status || item.status === filters.status)
    ));
  }

  function renderFilters() {
    const wrapper = document.querySelector("#learningMistakesFilters");
    if (!wrapper) return;
    wrapper.hidden = !assignmentId || loading || failed || mistakes.length === 0;
    if (wrapper.hidden) return;
    selectOptions(
      document.querySelector("#learningMistakesStageFilter"),
      uniqueOptions(mistakes, (item) => [{ id: item.stage?.id, label: item.stage?.title || "단계" }], "단계"),
      filters.stage
    );
    selectOptions(
      document.querySelector("#learningMistakesSkillFilter"),
      uniqueOptions(mistakes, (item) => (item.skills || []).map((skill) => ({ id: skill.code, label: skill.name || skill.code })), "개념"),
      filters.skill
    );
    const status = document.querySelector("#learningMistakesStatusFilter");
    if (status) status.value = filters.status;
  }

  function mistakeCard(item, index) {
    const options = Array.isArray(item.options) ? item.options : [];
    const skills = Array.isArray(item.skills) ? item.skills : [];
    return `<article class="learning-mistake-card">
      <header><span>${escapeHtml(item.stage?.title || "단계")}</span><span>${item.status === "unreviewed" ? "미복습" : escapeHtml(item.status)}</span></header>
      <h5>${escapeHtml(item.questionOrder)}. ${escapeHtml(item.prompt)}</h5>
      <ol class="learning-mistake-options">${options.map((option) => `<li class="${option.selected ? "is-selected" : ""}"><span>${escapeHtml(option.order)}</span><span>${escapeHtml(option.text)}</span>${option.selected ? "<strong>내가 고른 답</strong>" : ""}</li>`).join("")}</ol>
      <p class="learning-mistake-selection">선택했던 답: <strong>${escapeHtml(item.selectedAnswer?.text || "-")}</strong></p>
      <ul class="learning-mistake-skills">${skills.length ? skills.map((skill) => `<li>${escapeHtml(skill.name || skill.code)}</li>`).join("") : "<li>분류된 개념 없음</li>"}</ul>
      ${item.solution ? `<section class="learning-mistake-solution"><strong>정답: ${escapeHtml(item.solution.correctAnswer)}</strong><p>${escapeHtml(item.solution.explanation)}</p></section>` : `<button type="button" data-learning-mistake-reveal="${index}" ${revealing.has(item.attemptQuestionId) ? "disabled" : ""}>${revealing.has(item.attemptQuestionId) ? "불러오는 중…" : "정답과 해설 보기"}</button>`}
    </article>`;
  }

  function render() {
    const section = document.querySelector("#learningMistakesSection");
    const context = document.querySelector("#learningMistakesContext");
    const list = document.querySelector("#learningMistakesList");
    if (!section || !context || !list) return;
    const parent = currentMember()?.role === "parent";
    section.hidden = !parent;
    if (!parent) return;
    section.setAttribute("aria-busy", String(loading));
    if (!selectedAssignee()) {
      context.textContent = "담당 자녀를 선택해 주세요.";
      list.innerHTML = '<p class="learning-analysis-empty">담당 자녀를 선택하면 오답노트를 확인할 수 있어요.</p>';
      renderFilters();
      return;
    }
    if (!assignmentId) {
      context.textContent = "완료한 단원에서 오답노트를 선택해 주세요.";
      list.innerHTML = '<p class="learning-analysis-empty">확인할 단원을 선택해 주세요.</p>';
      renderFilters();
      return;
    }
    context.textContent = `${assignmentTitle || "선택한 단원"} 오답`;
    if (loading) {
      list.innerHTML = '<p class="learning-analysis-loading">오답 데이터를 불러오는 중입니다.</p>';
      renderFilters();
      return;
    }
    if (failed) {
      list.innerHTML = '<p class="learning-analysis-error">오답노트를 불러오지 못했습니다.</p>';
      renderFilters();
      return;
    }
    if (!mistakes.length) {
      list.innerHTML = '<p class="learning-analysis-empty">이번 학습에서 틀린 문제가 없습니다.</p>';
      renderFilters();
      return;
    }
    renderFilters();
    const visible = filteredMistakes();
    const revealError = revealFailed ? '<p class="learning-analysis-error">정답과 해설을 불러오지 못했습니다.</p>' : "";
    list.innerHTML = visible.length
      ? `${revealError}<div class="learning-mistake-list">${visible.map(mistakeCard).join("")}</div>`
      : '<p class="learning-analysis-empty">선택한 조건에 해당하는 오답이 없습니다.</p>';
  }

  async function open(nextAssignmentId, nextTitle) {
    const member = currentMember();
    if (member?.role !== "parent") return;
    const assignedMemberId = selectedAssignee();
    if (!assignedMemberId || !nextAssignmentId) return;
    const requestGeneration = ++generation;
    const requestIdentity = identity();
    assignmentId = String(nextAssignmentId);
    assignmentTitle = String(nextTitle || "");
    mistakes = [];
    failed = false;
    revealFailed = false;
    revealing.clear();
    filters.stage = "";
    filters.skill = "";
    filters.status = "";
    loading = true;
    render();
    try {
      const data = await requestJson(
        `/api/learning/assignments/${encodeURIComponent(assignmentId)}/mistakes?assignedMemberId=${encodeURIComponent(assignedMemberId)}`,
        { headers: authHeaders(), cache: "no-store" }
      );
      if (requestGeneration !== generation || requestIdentity !== identity() || assignmentId !== String(nextAssignmentId)) return;
      mistakes = Array.isArray(data.mistakes) ? data.mistakes : [];
    } catch {
      if (requestGeneration !== generation || requestIdentity !== identity() || assignmentId !== String(nextAssignmentId)) return;
      failed = true;
    } finally {
      if (requestGeneration === generation && requestIdentity === identity() && assignmentId === String(nextAssignmentId)) {
        loading = false;
        render();
      }
    }
  }

  async function reveal(item) {
    if (!item || item.solution || revealing.has(item.attemptQuestionId)) return;
    if (!window.confirm("이 오답의 정답과 해설을 확인할까요?")) return;
    const requestGeneration = generation;
    const requestIdentity = identity();
    const requestAssignmentId = assignmentId;
    revealing.add(item.attemptQuestionId);
    revealFailed = false;
    render();
    try {
      const data = await requestJson(
        `/api/learning/assignments/${encodeURIComponent(requestAssignmentId)}/mistakes/${encodeURIComponent(item.attemptQuestionId)}/reveal`,
        {
          method: "POST",
          headers: { ...authHeaders(), "X-Study-CSRF": "1", "Content-Type": "application/json" },
          body: JSON.stringify({ requestId: crypto.randomUUID() }),
        }
      );
      if (requestGeneration !== generation || requestIdentity !== identity() || requestAssignmentId !== assignmentId) return;
      item.solution = data.solution;
      item.status = "reviewed";
    } catch {
      if (requestGeneration !== generation || requestIdentity !== identity() || requestAssignmentId !== assignmentId) return;
      revealFailed = true;
    } finally {
      revealing.delete(item.attemptQuestionId);
      if (requestGeneration === generation && requestIdentity === identity() && requestAssignmentId === assignmentId) render();
    }
  }

  document.addEventListener("click", (event) => {
    const revealButton = event.target.closest("[data-learning-mistake-reveal]");
    if (revealButton) {
      reveal(filteredMistakes()[Number(revealButton.dataset.learningMistakeReveal)]);
      return;
    }
    const button = event.target.closest("[data-learning-mistakes-assignment]");
    if (!button) return;
    open(button.dataset.learningMistakesAssignment, button.dataset.learningMistakesTitle);
    document.querySelector("#learningMistakesSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  document.addEventListener("change", (event) => {
    const names = {
      learningMistakesStageFilter: "stage",
      learningMistakesSkillFilter: "skill",
      learningMistakesStatusFilter: "status",
    };
    const name = names[event.target?.id];
    if (!name) return;
    filters[name] = event.target.value || "";
    render();
  });

  return {
    open,
    render,
    reset() {
      generation += 1;
      assignmentId = "";
      assignmentTitle = "";
      mistakes = [];
      loading = false;
      failed = false;
      revealFailed = false;
      revealing.clear();
      filters.stage = "";
      filters.skill = "";
      filters.status = "";
      render();
    },
  };
}
