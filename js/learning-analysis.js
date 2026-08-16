import { deriveCanonicalProgress } from "./learning-progress.js";

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
  let assignments = [];
  let reviewSummary = {};
  let learningRewardEarned = null;
  let progressError = false;

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

  function percentLabel(value) {
    return value === null || value === undefined ? "N/A" : `${value}%`;
  }

  function renderProgress(container) {
    if (loading) {
      container.innerHTML = stateMessage("현재 학습 진행을 불러오는 중입니다.", "learning-analysis-loading");
      return;
    }
    if (progressError) {
      container.innerHTML = stateMessage("현재 학습 진행을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.", "learning-analysis-error");
      return;
    }
    const progress = deriveCanonicalProgress({ assignments, attemptHistory, reviewSummary, learningRewardEarned });
    if (!progress.current.length) {
      container.innerHTML = stateMessage("현재 진행 중인 문제풀이 단원이 없습니다.");
      return;
    }
    const overview = `<dl class="learning-progress-overall">
      <div><dt>진행 중인 단원</dt><dd>${progress.current.length}개</dd></div>
      <div><dt>지금 복습할 개념</dt><dd>${progress.overall.reviewDue}개</dd></div>
      <div><dt>학습으로 받은 스티커</dt><dd>${progress.overall.learningRewardEarned === null ? "N/A" : `${progress.overall.learningRewardEarned}개`}</dd></div>
    </dl>`;
    const cards = progress.current.map((item) => `<article class="learning-progress-card">
      <header><div><strong>${escapeHtml(item.unitTitle)}</strong><small>${escapeHtml(item.currentStage?.title || "현재 단계 없음")}</small></div><span>진행률 ${escapeHtml(percentLabel(item.completionPercent))}</span></header>
      <dl>
        <div><dt>단계 완료</dt><dd>${item.passedStages}/${item.totalStages}</dd></div>
        <div><dt>최근 정답률</dt><dd>${escapeHtml(percentLabel(item.correctnessPercent))}<small>${item.scoredCount ? `${item.correctCount}/${item.scoredCount} 정답` : "완료 응시 없음"}</small></dd></div>
        <div><dt>최근 응시</dt><dd>${item.latestAttemptStatus === "passed" ? "통과" : item.latestAttemptStatus === "failed" ? "재도전 필요" : "기록 없음"}</dd></div>
        <div><dt>완료 응시</dt><dd>${item.attemptCount}회</dd></div>
        <div><dt>기록된 오답</dt><dd>${item.historicalMistakes}개</dd></div>
        <div><dt>해결 전 오답</dt><dd>${item.unresolvedMistakes}개</dd></div>
        <div><dt>복습 대기 개념</dt><dd>${item.reviewDue}개</dd></div>
        <div><dt>완료한 복습</dt><dd>${item.reviewCompleted}회</dd></div>
      </dl>
    </article>`).join("");
    container.innerHTML = `${overview}<div class="learning-progress-list">${cards}</div>`;
  }

  function render() {
    const section = document.querySelector("#learningAnalysisSection");
    const scoreContainer = document.querySelector("#learningScoreSummary");
    const historyContainer = document.querySelector("#learningAttemptHistory");
    const skillContainer = document.querySelector("#learningSkillSummary");
    const recommendationContainer = document.querySelector("#learningRecommendationSummary");
    const progressContainer = document.querySelector("#learningProgressSummary");
    if (!section || !scoreContainer || !historyContainer || !skillContainer || !recommendationContainer || !progressContainer) return;
    const parent = currentMember()?.role === "parent";
    section.hidden = !parent;
    if (!parent) return;
    if (!selectedAssignee()) {
      const prompt = "담당 자녀를 선택하면 성취 분석을 확인할 수 있어요.";
      scoreContainer.innerHTML = stateMessage(prompt);
      historyContainer.innerHTML = stateMessage(prompt);
      skillContainer.innerHTML = stateMessage(prompt);
      recommendationContainer.innerHTML = stateMessage(prompt);
      progressContainer.innerHTML = stateMessage(prompt);
      section.setAttribute("aria-busy", "false");
      return;
    }
    section.setAttribute("aria-busy", String(loading));
    renderScores(scoreContainer);
    renderHistory(historyContainer);
    renderSkills(skillContainer);
    renderRecommendations(recommendationContainer);
    renderProgress(progressContainer);
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
    assignments = [];
    reviewSummary = {};
    learningRewardEarned = null;
    progressError = false;
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
      const [analysisResult, recommendationResult, assignmentResult, queueResult, rewardResult] = await Promise.allSettled([
        Promise.all([
          requestJson(`/api/learning/scores${query}`, options),
          requestJson(`/api/learning/attempt-history${query}`, options),
          requestJson(`/api/learning/skills${query}`, options),
        ]),
        requestJson(`/api/learning/recommendations${query}`, options),
        requestJson(`/api/learning/assignments${query}`, options),
        requestJson(`/api/learning/review-queue${query}`, options),
        requestJson(`/api/rewards?memberId=${encodeURIComponent(assignedMemberId)}`, options),
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
      if (assignmentResult.status === "fulfilled") {
        assignments = Array.isArray(assignmentResult.value.assignments) ? assignmentResult.value.assignments : [];
      } else {
        progressError = true;
      }
      if (queueResult.status === "fulfilled") reviewSummary = queueResult.value.summary || {};
      if (rewardResult.status === "fulfilled") {
        learningRewardEarned = Number(rewardResult.value.learningRewardEarned || 0);
      }
    } catch {
      if (requestGeneration !== generation || requestIdentity !== identity()) return;
      error = true;
      recommendationError = true;
      progressError = true;
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
      assignments = [];
      reviewSummary = {};
      learningRewardEarned = null;
      progressError = false;
      render();
    },
  };
}
