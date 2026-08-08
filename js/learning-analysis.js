function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatCompletedAt(value) {
  if (!value) return "완료 시각 없음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "완료 시각 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(date);
}

function scoreValue(point) {
  return point ? `${point.accuracyPercent ?? 0}점` : "-";
}

function scoreDetail(point) {
  return point ? `${point.correct}/${point.total} 정답` : "완료 기록 없음";
}

export function initLearningAnalysis({ requestJson, authHeaders, currentMember, selectedAssignee }) {
  let generation = 0;
  let loading = false;
  let error = false;
  let scores = [];
  let attemptHistory = [];
  let skills = [];
  let recommendationState = "insufficient_history";
  let recommendations = [];
  let recommendationError = false;

  function identity() {
    const member = currentMember();
    return member ? `${member.id}:${selectedAssignee() || "unselected"}` : "signed-out";
  }

  function stateMessage(message, className = "learning-analysis-empty") {
    return `<p class="${className}">${escapeHtml(message)}</p>`;
  }

  function renderScores(container) {
    if (loading) {
      container.innerHTML = stateMessage("점수 요약을 불러오는 중입니다.", "learning-analysis-loading");
      return;
    }
    if (error) {
      container.innerHTML = stateMessage("성취 분석을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.", "learning-analysis-error");
      return;
    }
    if (!scores.length) {
      container.innerHTML = stateMessage("아직 완료한 학습이 없습니다.");
      return;
    }
    container.innerHTML = scores.map((summary) => `<article class="learning-score-summary">
      <header><strong>${escapeHtml(summary.unitTitle || "문제풀이 단원")}</strong><small>버전 ${escapeHtml(summary.contentVersionNumber || "-")}</small></header>
      <dl>
        <div><dt>최근 점수</dt><dd>${scoreValue(summary.latest)}<small>${scoreDetail(summary.latest)}</small></dd></div>
        <div><dt>최고 점수</dt><dd>${scoreValue(summary.best)}<small>${scoreDetail(summary.best)}</small></dd></div>
        <div><dt>최초 점수</dt><dd>${scoreValue(summary.first)}<small>${scoreDetail(summary.first)}</small></dd></div>
      </dl>
    </article>`).join("");
  }

  function renderHistory(container) {
    if (loading) {
      container.innerHTML = stateMessage("최근 응시 이력을 불러오는 중입니다.", "learning-analysis-loading");
      return;
    }
    if (error) {
      container.innerHTML = stateMessage("성취 분석을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.", "learning-analysis-error");
      return;
    }
    if (!attemptHistory.length) {
      container.innerHTML = stateMessage("아직 분석할 응시 기록이 없습니다.");
      return;
    }
    container.innerHTML = `<ol class="learning-attempt-history">${attemptHistory.map((attempt) => `<li>
      <div><strong>${escapeHtml(attempt.unitTitle || "문제풀이 단원")}</strong><small>${escapeHtml(formatCompletedAt(attempt.completedAt))}</small></div>
      <div><b>${escapeHtml(attempt.accuracyPercent ?? 0)}점</b><span>${escapeHtml(attempt.correct)}/${escapeHtml(attempt.total)} 정답</span></div>
    </li>`).join("")}</ol>`;
  }

  function renderSkills(container) {
    if (loading) {
      container.innerHTML = stateMessage("취약 개념을 분석하는 중입니다.", "learning-analysis-loading");
      return;
    }
    if (error) {
      container.innerHTML = stateMessage("성취 분석을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.", "learning-analysis-error");
      return;
    }
    if (!skills.length) {
      container.innerHTML = stateMessage("충분한 학습 기록이 쌓이면 취약 개념을 확인할 수 있습니다.");
      return;
    }
    container.innerHTML = `<ul class="learning-skill-summary">${skills.map((skill) => `<li class="${skill.weak ? "is-weak" : ""}">
      <div><strong>${escapeHtml(skill.skillName || skill.skillCode)}</strong><span>${skill.weak ? "취약" : "관찰 중"}</span></div>
      <p><b>${escapeHtml(skill.accuracyPercent ?? 0)}%</b> · ${escapeHtml(skill.attemptedQuestions)}문항 · ${escapeHtml(skill.attemptCount)}회 응시</p>
    </li>`).join("")}</ul>`;
  }

  function renderRecommendations(container) {
    if (loading) {
      container.innerHTML = stateMessage("보완 학습 추천을 찾는 중입니다.", "learning-analysis-loading");
      return;
    }
    if (recommendationError) {
      container.innerHTML = stateMessage("보완 학습 추천을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.", "learning-analysis-error");
      return;
    }
    const emptyMessages = {
      no_weak_skills: "현재 확인된 취약 개념이 없습니다.",
      insufficient_history: "학습 기록이 더 쌓이면 보완 학습을 추천해 드립니다.",
      no_mapped_content: "현재 연결된 보완 학습 콘텐츠가 없습니다.",
    };
    if (!recommendations.length) {
      container.innerHTML = stateMessage(emptyMessages[recommendationState] || emptyMessages.insufficient_history);
      return;
    }
    container.innerHTML = `<ol class="learning-recommendation-list">${recommendations.map((item) => `<li>
      <span class="learning-recommendation-priority">우선순위 ${escapeHtml(item.priority)}</span>
      <div><strong>${escapeHtml(item.skillName)}</strong><small>현재 정확도 ${escapeHtml(item.accuracy)}%</small></div>
      <p><b>${escapeHtml(item.recommendedUnit?.title || "보완 학습 단원")}</b><span>${escapeHtml(item.reason)}</span></p>
      <small>${escapeHtml(item.mappedQuestionCount)}개 문항 연결 · 콘텐츠 버전 ${escapeHtml(item.recommendedContentVersion?.versionNumber || "-")}</small>
    </li>`).join("")}</ol>`;
  }

  function render() {
    const section = document.querySelector("#learningAnalysisSection");
    const scoreContainer = document.querySelector("#learningScoreSummary");
    const historyContainer = document.querySelector("#learningAttemptHistory");
    const skillContainer = document.querySelector("#learningSkillSummary");
    const recommendationContainer = document.querySelector("#learningRecommendationSummary");
    if (!section || !scoreContainer || !historyContainer || !skillContainer || !recommendationContainer) return;
    const parent = currentMember()?.role === "parent";
    section.hidden = !parent;
    if (!parent) return;
    if (!selectedAssignee()) {
      const prompt = "담당 자녀를 선택하면 성취 분석을 확인할 수 있어요.";
      scoreContainer.innerHTML = stateMessage(prompt);
      historyContainer.innerHTML = stateMessage(prompt);
      skillContainer.innerHTML = stateMessage(prompt);
      recommendationContainer.innerHTML = stateMessage(prompt);
      section.setAttribute("aria-busy", "false");
      return;
    }
    section.setAttribute("aria-busy", String(loading));
    renderScores(scoreContainer);
    renderHistory(historyContainer);
    renderSkills(skillContainer);
    renderRecommendations(recommendationContainer);
  }

  async function refresh() {
    const member = currentMember();
    const assignedMemberId = member?.role === "parent" ? selectedAssignee() : "";
    const requestGeneration = ++generation;
    const requestIdentity = identity();
    scores = [];
    attemptHistory = [];
    skills = [];
    recommendationState = "insufficient_history";
    recommendations = [];
    recommendationError = false;
    error = false;
    if (!member || member.role !== "parent" || !assignedMemberId) {
      loading = false;
      render();
      return;
    }
    loading = true;
    render();
    const query = `?assignedMemberId=${encodeURIComponent(assignedMemberId)}`;
    try {
      const options = { headers: authHeaders(), cache: "no-store" };
      const [analysisResult, recommendationResult] = await Promise.allSettled([
        Promise.all([
          requestJson(`/api/learning/scores${query}`, options),
          requestJson(`/api/learning/attempt-history${query}`, options),
          requestJson(`/api/learning/skills${query}`, options),
        ]),
        requestJson(`/api/learning/recommendations${query}`, options),
      ]);
      if (requestGeneration !== generation || requestIdentity !== identity()) return;
      if (analysisResult.status === "fulfilled") {
        const [scoreData, historyData, skillData] = analysisResult.value;
        scores = Array.isArray(scoreData.scores) ? scoreData.scores : [];
        attemptHistory = Array.isArray(historyData.attemptHistory) ? historyData.attemptHistory : [];
        skills = Array.isArray(skillData.skills) ? skillData.skills : [];
      } else {
        error = true;
      }
      if (recommendationResult.status === "fulfilled") {
        recommendationState = recommendationResult.value.state || "insufficient_history";
        recommendations = Array.isArray(recommendationResult.value.recommendations)
          ? recommendationResult.value.recommendations
          : [];
      } else {
        recommendationError = true;
      }
    } catch {
      if (requestGeneration !== generation || requestIdentity !== identity()) return;
      error = true;
      recommendationError = true;
    } finally {
      if (requestGeneration === generation && requestIdentity === identity()) {
        loading = false;
        render();
      }
    }
  }

  return {
    refresh,
    render,
    reset() {
      generation += 1;
      loading = false;
      error = false;
      scores = [];
      attemptHistory = [];
      skills = [];
      recommendationState = "insufficient_history";
      recommendations = [];
      recommendationError = false;
      render();
    },
  };
}
