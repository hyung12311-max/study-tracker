const curriculum = require("../../../content/learning/curriculum/math/grade-2-2022.json");
const learning = require("./_utils");

const PREPARATION_UNIT_CODES = Object.freeze(["make-ten"]);
const ASSIGNMENT_STATE_RANK = Object.freeze({ active: 1, completed: 2 });

function latestPublishedVersions(rows) {
  const latest = new Map();
  for (const row of rows || []) {
    const unitId = String(row.unit_id);
    if (!latest.has(unitId)) latest.set(unitId, row);
  }
  return latest;
}

function assignmentStates(rows) {
  const states = new Map();
  for (const row of rows || []) {
    const unitId = String(row.unit_id);
    const status = String(row.status || "");
    if (!ASSIGNMENT_STATE_RANK[status]) continue;
    const current = states.get(unitId);
    if (!current || ASSIGNMENT_STATE_RANK[status] > ASSIGNMENT_STATE_RANK[current]) {
      states.set(unitId, status);
    }
  }
  return states;
}

function representativeAssignments(rows) {
  const assignments = new Map();
  for (const row of rows || []) {
    const unitId = String(row.unit_id);
    const status = String(row.status || "");
    if (!ASSIGNMENT_STATE_RANK[status]) continue;
    const current = assignments.get(unitId);
    if (!current || ASSIGNMENT_STATE_RANK[status] > ASSIGNMENT_STATE_RANK[current.status]) {
      assignments.set(unitId, row);
    }
  }
  return assignments;
}

function publishedVersionDto(version, stageCount) {
  if (!version) return null;
  return {
    contentVersionId: String(version.id),
    versionNumber: Number(version.version_no),
    stageCount,
  };
}

function userStatus(version, assignmentState) {
  if (!version) return "preparing";
  if (assignmentState === "completed") return "completed";
  if (assignmentState === "active") return "assigned";
  return "available";
}

async function roadmap(request) {
  const url = new URL(request.url || "/api/learning/roadmap", "http://localhost");
  const { claims, assignedMemberId } = await learning.parentScope(
    request,
    url.searchParams.get("assignedMemberId")
  );
  const courseId = curriculum.course.id;
  const course = (await learning.u.supabaseFetch(
    `learning_courses?select=id,course_code,internal_name,subject_name,status&id=eq.${encodeURIComponent(courseId)}&course_code=eq.${encodeURIComponent(curriculum.course.slug)}&status=eq.published&limit=1`
  ))?.[0];
  if (
    !course
    || String(course.id) !== courseId
    || course.course_code !== curriculum.course.slug
    || course.internal_name !== curriculum.course.internalName
    || course.subject_name !== curriculum.course.subject
  ) {
    throw learning.u.err(
      "교육 단원 맵을 불러오지 못했습니다.",
      500,
      "LEARNING_ROADMAP_COURSE_MISMATCH"
    );
  }

  const units = await learning.u.supabaseFetch(
    `learning_units?select=id,course_id,unit_code,display_title,sort_order&course_id=eq.${encodeURIComponent(courseId)}&order=sort_order.asc`
  ) || [];
  const unitIds = learning.idList(units);
  const [versions, assignments] = unitIds.length ? await Promise.all([
    learning.u.supabaseFetch(
      `learning_content_versions?select=id,unit_id,version_no&unit_id=in.(${learning.inFilter(unitIds)})&status=eq.published&order=unit_id.asc,version_no.desc`
    ),
    learning.u.supabaseFetch(
      `learning_assignments?select=id,unit_id,status,completed_at&family_id=eq.${encodeURIComponent(claims.family)}&assigned_member_id=eq.${encodeURIComponent(assignedMemberId)}&unit_id=in.(${learning.inFilter(unitIds)})&order=assigned_at.desc`
    ),
  ]) : [[], []];
  const latestByUnit = latestPublishedVersions(versions);
  const latestVersionIds = learning.idList([...latestByUnit.values()]);
  const stages = latestVersionIds.length ? await learning.u.supabaseFetch(
    `learning_stages?select=content_version_id&content_version_id=in.(${learning.inFilter(latestVersionIds)})`
  ) : [];
  const stageCounts = new Map();
  for (const stage of stages || []) {
    const versionId = String(stage.content_version_id);
    stageCounts.set(versionId, (stageCounts.get(versionId) || 0) + 1);
  }
  const unitByCode = new Map(units.map((unit) => [String(unit.unit_code), unit]));
  const assignmentByUnit = assignmentStates(assignments);
  const assignmentRecordByUnit = representativeAssignments(assignments);
  const assignmentIds = learning.idList(assignments);
  const plans = assignmentIds.length ? await learning.u.supabaseFetch(
    `learning_assignment_plans?select=assignment_id,plan_state,planned_start_date,target_completion_date,revision&` +
    `family_id=eq.${encodeURIComponent(claims.family)}&assigned_member_id=eq.${encodeURIComponent(assignedMemberId)}` +
    `&assignment_id=in.(${learning.inFilter(assignmentIds)})`
  ) : [];
  const planByAssignment = new Map((plans || []).map((plan) => [String(plan.assignment_id), plan]));

  function dbState(unit) {
    const version = unit && latestByUnit.get(String(unit.id));
    const assignmentState = unit ? assignmentByUnit.get(String(unit.id)) || "unassigned" : "unassigned";
    const assignment = unit ? assignmentRecordByUnit.get(String(unit.id)) : null;
    const plan = assignment && planByAssignment.get(String(assignment.id));
    const status = userStatus(version, assignmentState);
    return {
      unitId: unit ? String(unit.id) : null,
      availability: version ? "published" : "preparing",
      publishedVersion: publishedVersionDto(
        version,
        version ? stageCounts.get(String(version.id)) || 0 : 0
      ),
      assignmentState,
      userStatus: plan?.plan_state === "paused" && assignmentState === "active" ? "paused" : status,
      hasPlan: Boolean(plan),
      planState: plan?.plan_state || null,
      plannedStartDate: plan?.planned_start_date || null,
      unitTargetCompletionDate: plan?.target_completion_date || null,
      currentRevision: plan ? Number(plan.revision) : null,
      targetStatus: plan
        ? (assignmentState === "completed" ? "completed" : plan.plan_state)
        : (assignment ? "legacy" : null),
    };
  }

  const preparationUnits = PREPARATION_UNIT_CODES.map((unitCode) => {
    const unit = unitByCode.get(unitCode);
    if (!unit) return null;
    return {
      ...dbState(unit),
      unitCode,
      displayTitle: unit.display_title,
      position: "before-curriculum",
    };
  }).filter(Boolean);

  const curriculumUnits = curriculum.units.map((unit) => ({
    ...dbState(unitByCode.get(unit.slug)),
    curriculumOrder: unit.catalogOrder,
    unitCode: unit.slug,
    displayTitle: unit.title,
    prerequisiteUnitCodes: [...unit.prerequisiteUnitSlugs],
    recommendationLevel: unit.recommendationLevel,
  }));

  return {
    course: {
      courseId: String(course.id),
      slug: course.course_code,
      displayName: course.internal_name,
      subject: course.subject_name,
    },
    preparationUnits,
    curriculumUnits,
  };
}

module.exports = async function learningRoadmap(request, response) {
  if (request.method !== "GET") return learning.allow(response, ["GET"]);
  try {
    return learning.send(response, 200, { ok: true, roadmap: await roadmap(request) });
  } catch (error) {
    return learning.safeError(response, error);
  }
};

module.exports.roadmap = roadmap;
module.exports.assignmentStates = assignmentStates;
module.exports.representativeAssignments = representativeAssignments;
module.exports.userStatus = userStatus;
