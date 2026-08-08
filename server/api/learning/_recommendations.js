const analysis = require("./_analysis");
const learning = require("./_utils");

const RECOMMENDATION_POLICY = Object.freeze({
  version: "weak-skill-published-content-v1",
  maximumItems: 10,
  preferUncompletedContent: true,
  preferPrimaryMappings: true,
});

function reasonFor(skill) {
  return skill.attemptCount >= 3
    ? "여러 번 풀었지만 정확도가 낮아 복습이 필요합니다."
    : "최근 정답률이 낮아 복습이 필요합니다.";
}

function buildRecommendations({ skills, mappings, questions, stages, versions, units, courses, assignments }) {
  const weakSkills = (skills || []).filter((skill) => skill.weak).sort((left, right) => (
    left.accuracyPercent - right.accuracyPercent
    || right.attemptedQuestions - left.attemptedQuestions
    || left.skillCode.localeCompare(right.skillCode)
  ));
  const questionById = new Map((questions || []).map((row) => [String(row.id), row]));
  const stageById = new Map((stages || []).map((row) => [String(row.id), row]));
  const versionById = new Map((versions || [])
    .filter((row) => row.status === "published")
    .map((row) => [String(row.id), row]));
  const unitById = new Map((units || []).map((row) => [String(row.id), row]));
  const publishedCourseIds = new Set((courses || [])
    .filter((row) => row.status === "published")
    .map((row) => String(row.id)));
  const completedVersions = new Set((assignments || [])
    .filter((row) => row.status === "completed")
    .map((row) => String(row.content_version_id)));
  const mappingsBySkill = new Map();
  for (const mapping of mappings || []) {
    if (!mappingsBySkill.has(mapping.skill_code)) mappingsBySkill.set(mapping.skill_code, []);
    mappingsBySkill.get(mapping.skill_code).push(mapping);
  }

  const ranked = [];
  for (const skill of weakSkills) {
    const candidates = new Map();
    for (const mapping of mappingsBySkill.get(skill.skillCode) || []) {
      const question = questionById.get(String(mapping.question_id));
      const stage = question && stageById.get(String(question.stage_id));
      const version = stage && versionById.get(String(stage.content_version_id));
      const unit = version && unitById.get(String(version.unit_id));
      if (!question || !stage || !version || !unit || !publishedCourseIds.has(String(unit.course_id))) continue;
      const key = String(version.id);
      if (!candidates.has(key)) candidates.set(key, {
        version,
        unit,
        mappedQuestionIds: new Set(),
        primaryQuestionIds: new Set(),
        previouslyCompleted: completedVersions.has(key),
      });
      const candidate = candidates.get(key);
      candidate.mappedQuestionIds.add(String(question.id));
      if (mapping.is_primary === true) candidate.primaryQuestionIds.add(String(question.id));
    }
    const candidate = [...candidates.values()].sort((left, right) => (
      Number(left.previouslyCompleted) - Number(right.previouslyCompleted)
      || right.primaryQuestionIds.size - left.primaryQuestionIds.size
      || right.mappedQuestionIds.size - left.mappedQuestionIds.size
      || Number(right.version.version_no) - Number(left.version.version_no)
      || String(left.unit.display_title).localeCompare(String(right.unit.display_title), "ko")
    ))[0];
    if (!candidate) continue;
    ranked.push({
      skillCode: skill.skillCode,
      skillName: skill.skillName,
      accuracy: skill.accuracyPercent,
      attemptedQuestionCount: skill.attemptedQuestions,
      correctCount: skill.correct,
      reason: reasonFor(skill),
      recommendedUnit: {
        code: candidate.unit.unit_code,
        title: candidate.unit.display_title,
      },
      recommendedContentVersion: {
        versionNumber: Number(candidate.version.version_no),
      },
      mappedQuestionCount: candidate.mappedQuestionIds.size,
      previouslyCompleted: candidate.previouslyCompleted,
    });
  }
  return ranked.slice(0, RECOMMENDATION_POLICY.maximumItems)
    .map((item, index) => ({ ...item, priority: index + 1 }));
}

async function load(request) {
  const data = await analysis.load(request);
  const skills = analysis.skillSummaries(data);
  if (!data.attempts.length || !skills.length) {
    return { state: "insufficient_history", recommendations: [] };
  }
  const weakSkills = skills.filter((skill) => skill.weak);
  if (!weakSkills.length) return { state: "no_weak_skills", recommendations: [] };

  const skillCodes = weakSkills.map((skill) => skill.skillCode);
  const mappings = await learning.u.supabaseFetch(
    `learning_question_skills?select=question_id,skill_code,is_primary&skill_code=in.(${learning.inFilter(skillCodes)})`
  ) || [];
  if (!mappings.length) return { state: "no_mapped_content", recommendations: [] };
  const questionIds = learning.idList(mappings, "question_id");
  const questions = await learning.u.supabaseFetch(
    `learning_questions?select=id,stage_id&id=in.(${learning.inFilter(questionIds)})`
  ) || [];
  const stageIds = learning.idList(questions, "stage_id");
  const stages = stageIds.length ? await learning.u.supabaseFetch(
    `learning_stages?select=id,content_version_id&id=in.(${learning.inFilter(stageIds)})`
  ) || [] : [];
  const versionIds = learning.idList(stages, "content_version_id");
  const versions = versionIds.length ? await learning.u.supabaseFetch(
    `learning_content_versions?select=id,unit_id,version_no,status&id=in.(${learning.inFilter(versionIds)})&status=eq.published&retired_at=is.null`
  ) || [] : [];
  const unitIds = learning.idList(versions, "unit_id");
  const units = unitIds.length ? await learning.u.supabaseFetch(
    `learning_units?select=id,course_id,unit_code,display_title&id=in.(${learning.inFilter(unitIds)})`
  ) || [] : [];
  const courseIds = learning.idList(units, "course_id");
  const courses = courseIds.length ? await learning.u.supabaseFetch(
    `learning_courses?select=id,status&id=in.(${learning.inFilter(courseIds)})&status=eq.published`
  ) || [] : [];
  const recommendations = buildRecommendations({
    skills: weakSkills,
    mappings,
    questions,
    stages,
    versions,
    units,
    courses,
    assignments: [...data.assignmentById.values()],
  });
  return {
    state: recommendations.length ? "ready" : "no_mapped_content",
    recommendations,
  };
}

module.exports = { RECOMMENDATION_POLICY, buildRecommendations, load, reasonFor };
