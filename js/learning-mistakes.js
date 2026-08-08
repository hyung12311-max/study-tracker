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

const REVIEW_STATUS_LABELS = Object.freeze({
  unreviewed: "미복습",
  retried_wrong: "재오답",
  resolved: "해결",
  repeated_wrong: "반복 오답",
});

export function initLearningMistakes({ requestJson, authHeaders, currentMember, selectedAssignee }) {
  let generation = 0;
  let assignmentId = "";
  let assignmentTitle = "";
  let mistakes = [];
  let loading = false;
  let failed = false;
  let revealFailed = false;
  let review = null;
  let reviewLoading = false;
  let reviewFailed = false;
  let reviewSubmitting = false;
  let selectedReviewOptionId = "";
  let reviewFeedback = null;
  let reviewFeedbackItemId = "";
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

  function activeReviewItem() {
    if (!review?.items?.length) return null;
    return review.items.find((item) => !item.reviewAnswer) || review.items.at(-1);
  }

  function renderReview(parent) {
    const actions = document.querySelector("#learningReviewActions");
    const workspace = document.querySelector("#learningReviewWorkspace");
    const content = document.querySelector("#learningReviewContent");
    const abandonButton = document.querySelector("#learningReviewAbandon");
    if (!actions || !workspace || !content || !abandonButton) return;
    actions.hidden = !parent || !assignmentId || loading || failed || mistakes.length === 0;
    workspace.hidden = !parent || (!review && !reviewLoading && !reviewFailed);
    workspace.setAttribute("aria-busy", String(reviewLoading || reviewSubmitting));
    if (workspace.hidden) return;
    abandonButton.hidden = !review || review.status !== "in_progress";
    abandonButton.disabled = reviewSubmitting;
    if (reviewLoading) {
      content.innerHTML = '<p class="learning-analysis-loading">오답 복습을 준비하는 중입니다.</p>';
      return;
    }
    if (reviewFailed) {
      content.innerHTML = '<div class="learning-review-card"><p class="learning-analysis-error">오답 복습을 진행하지 못했습니다.</p><footer><button type="button" data-learning-review-close>닫기</button></footer></div>';
      return;
    }
    if (!review?.items?.length) {
      content.innerHTML = '<div class="learning-review-card"><p class="learning-analysis-empty">복습할 오답이 없습니다.</p><footer><button type="button" data-learning-review-close>닫기</button></footer></div>';
      return;
    }
    if (review.status === "completed" || review.status === "abandoned") {
      const completed = review.status === "completed";
      const feedback = reviewFeedback ? `<div class="learning-review-result ${reviewFeedback.isCorrect ? "" : "is-wrong"}"><strong>${reviewFeedback.isCorrect ? "정답입니다." : "다시 확인해 보세요."}</strong><p>정답: ${escapeHtml(reviewFeedback.correctAnswer)}</p><p>${escapeHtml(reviewFeedback.explanation)}</p></div>` : "";
      content.innerHTML = `<article class="learning-review-card"><span class="learning-review-status">${completed ? "복습 완료" : "복습 중단"}</span><h5>${completed ? "오답 복습을 마쳤습니다." : "오답 복습을 중단했습니다."}</h5>${feedback}<p>복습 결과는 공식 점수·진도·보상을 변경하지 않습니다.</p><footer><button type="button" data-learning-review-close>오답노트로 돌아가기</button></footer></article>`;
      return;
    }
    const item = activeReviewItem();
    const answeredCount = review.items.filter((entry) => entry.reviewAnswer).length;
    const status = REVIEW_STATUS_LABELS[item.resolutionStatus] || REVIEW_STATUS_LABELS.unreviewed;
    const options = Array.isArray(item.options) ? item.options : [];
    const feedback = reviewFeedback && reviewFeedbackItemId === item.id
      ? `<div class="learning-review-result ${reviewFeedback.isCorrect ? "" : "is-wrong"}"><strong>${reviewFeedback.isCorrect ? "정답입니다." : "다시 확인해 보세요."}</strong><p>정답: ${escapeHtml(reviewFeedback.correctAnswer)}</p><p>${escapeHtml(reviewFeedback.explanation)}</p></div>`
      : item.reviewAnswer && item.solution
        ? `<div class="learning-review-result ${item.reviewAnswer.correct ? "" : "is-wrong"}"><strong>${item.reviewAnswer.correct ? "정답입니다." : "재오답입니다."}</strong><p>정답: ${escapeHtml(item.solution.correctAnswer)}</p><p>${escapeHtml(item.solution.explanation)}</p></div>`
        : "";
    content.innerHTML = `<article class="learning-review-card">
      <div class="learning-review-progress"><span>${answeredCount + (item.reviewAnswer ? 0 : 1)} / ${review.items.length}</span><span class="learning-review-status">${escapeHtml(status)}</span></div>
      <h5>${escapeHtml(item.stage?.title || "단계")} · ${escapeHtml(item.order)}번</h5>
      <p>${escapeHtml(item.prompt)}</p>
      <ol class="learning-review-options">${options.map((option, index) => `<li><label><input type="radio" name="learningReviewOption" value="${index}" data-learning-review-option="${index}" ${selectedReviewOptionId === option.id ? "checked" : ""} ${item.reviewAnswer || reviewSubmitting ? "disabled" : ""}><span>${escapeHtml(option.order)}. ${escapeHtml(option.text)}</span></label></li>`).join("")}</ol>
      ${feedback}
      <footer>${item.reviewAnswer ? '<button type="button" class="primary" data-learning-review-next>다음 문제</button>' : `<button type="button" class="primary" data-learning-review-submit ${selectedReviewOptionId && !reviewSubmitting ? "" : "disabled"}>${reviewSubmitting ? "답안을 확인하는 중…" : "답안 제출"}</button>`}</footer>
    </article>`;
  }

  function render() {
    const section = document.querySelector("#learningMistakesSection");
    const context = document.querySelector("#learningMistakesContext");
    const list = document.querySelector("#learningMistakesList");
    if (!section || !context || !list) return;
    const parent = currentMember()?.role === "parent";
    section.hidden = !parent;
    renderReview(parent);
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
    review = null;
    reviewLoading = false;
    reviewFailed = false;
    reviewSubmitting = false;
    selectedReviewOptionId = "";
    reviewFeedback = null;
    reviewFeedbackItemId = "";
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

  async function startReview() {
    const assignedMemberId = selectedAssignee();
    if (!assignmentId || !assignedMemberId || reviewLoading) return;
    const requestGeneration = ++generation;
    const requestIdentity = identity();
    const requestAssignmentId = assignmentId;
    review = null;
    reviewLoading = true;
    reviewFailed = false;
    reviewFeedback = null;
    selectedReviewOptionId = "";
    render();
    try {
      const body = {
        assignedMemberId,
        status: ["unreviewed", "reviewed"].includes(filters.status) ? filters.status : "all",
        stageId: filters.stage || null,
        skillCode: filters.skill || null,
        requestId: crypto.randomUUID(),
      };
      const data = await requestJson(
        `/api/learning/assignments/${encodeURIComponent(requestAssignmentId)}/mistake-reviews`,
        {
          method: "POST",
          headers: { ...authHeaders(), "X-Study-CSRF": "1", "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      if (requestGeneration !== generation || requestIdentity !== identity() || requestAssignmentId !== assignmentId) return;
      review = data.review || null;
    } catch {
      if (requestGeneration !== generation || requestIdentity !== identity() || requestAssignmentId !== assignmentId) return;
      reviewFailed = true;
    } finally {
      if (requestGeneration === generation && requestIdentity === identity() && requestAssignmentId === assignmentId) {
        reviewLoading = false;
        render();
      }
    }
  }

  async function submitReviewAnswer() {
    const item = activeReviewItem();
    if (!review || !item || item.reviewAnswer || !selectedReviewOptionId || reviewSubmitting) return;
    const requestGeneration = generation;
    const requestIdentity = identity();
    const requestReviewId = review.id;
    const requestItemId = item.id;
    reviewSubmitting = true;
    reviewFailed = false;
    render();
    try {
      const data = await requestJson(
        `/api/learning/mistake-reviews/${encodeURIComponent(requestReviewId)}/items/${encodeURIComponent(requestItemId)}/answers`,
        {
          method: "POST",
          headers: { ...authHeaders(), "X-Study-CSRF": "1", "Content-Type": "application/json" },
          body: JSON.stringify({ optionId: selectedReviewOptionId, requestId: crypto.randomUUID() }),
        }
      );
      const refreshed = await requestJson(
        `/api/learning/mistake-reviews/${encodeURIComponent(requestReviewId)}`,
        { headers: authHeaders(), cache: "no-store" }
      );
      if (requestGeneration !== generation || requestIdentity !== identity() || requestReviewId !== review?.id) return;
      review = refreshed.review;
      reviewFeedback = data.feedback;
      reviewFeedbackItemId = requestItemId;
    } catch {
      if (requestGeneration !== generation || requestIdentity !== identity() || requestReviewId !== review?.id) return;
      reviewFailed = true;
    } finally {
      if (requestGeneration === generation && requestIdentity === identity() && requestReviewId === review?.id) {
        reviewSubmitting = false;
        render();
      }
    }
  }

  async function abandonReview() {
    if (!review || review.status !== "in_progress" || reviewSubmitting) return;
    if (!window.confirm("진행 중인 오답 복습을 중단할까요?")) return;
    const requestGeneration = generation;
    const requestIdentity = identity();
    const requestReviewId = review.id;
    reviewSubmitting = true;
    render();
    try {
      const data = await requestJson(
        `/api/learning/mistake-reviews/${encodeURIComponent(requestReviewId)}/abandon`,
        {
          method: "POST",
          headers: { ...authHeaders(), "X-Study-CSRF": "1", "Content-Type": "application/json" },
          body: JSON.stringify({ requestId: crypto.randomUUID() }),
        }
      );
      if (requestGeneration !== generation || requestIdentity !== identity() || requestReviewId !== review?.id) return;
      review = { ...review, ...data.review };
    } catch {
      if (requestGeneration !== generation || requestIdentity !== identity() || requestReviewId !== review?.id) return;
      reviewFailed = true;
    } finally {
      if (requestGeneration === generation && requestIdentity === identity() && requestReviewId === review?.id) {
        reviewSubmitting = false;
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
    if (event.target.closest("#learningReviewStart")) {
      startReview();
      return;
    }
    if (event.target.closest("[data-learning-review-submit]")) {
      submitReviewAnswer();
      return;
    }
    if (event.target.closest("[data-learning-review-next]")) {
      reviewFeedback = null;
      reviewFeedbackItemId = "";
      selectedReviewOptionId = "";
      render();
      return;
    }
    if (event.target.closest("#learningReviewAbandon")) {
      abandonReview();
      return;
    }
    if (event.target.closest("[data-learning-review-close]")) {
      generation += 1;
      review = null;
      reviewFailed = false;
      reviewFeedback = null;
      selectedReviewOptionId = "";
      render();
      return;
    }
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
    const reviewOption = event.target.closest("[data-learning-review-option]");
    if (reviewOption) {
      const item = activeReviewItem();
      selectedReviewOptionId = item?.options?.[Number(reviewOption.dataset.learningReviewOption)]?.id || "";
      render();
      return;
    }
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
      review = null;
      reviewLoading = false;
      reviewFailed = false;
      reviewSubmitting = false;
      selectedReviewOptionId = "";
      reviewFeedback = null;
      reviewFeedbackItemId = "";
      filters.stage = "";
      filters.skill = "";
      filters.status = "";
      render();
    },
  };
}
