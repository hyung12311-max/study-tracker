const learning = require("./_utils");

async function listForScope(claims, assignedMemberId, viewerRole) {
  const assignments = await learning.u.supabaseFetch(
    `learning_assignments?select=id,unit_id,content_version_id,status,assigned_at,completed_at,cancelled_at&family_id=eq.${encodeURIComponent(claims.family)}&assigned_member_id=eq.${encodeURIComponent(assignedMemberId)}&order=assigned_at.desc`
  ) || [];
  if (!assignments.length) return [];

  const unitIds = learning.idList(assignments, "unit_id");
  const versionIds = learning.idList(assignments, "content_version_id");
  const assignmentIds = learning.idList(assignments);
  const [units, stages, progress] = await Promise.all([
    learning.u.supabaseFetch(
      `learning_units?select=id,course_id,display_title&id=in.(${learning.inFilter(unitIds)})`
    ),
    learning.u.supabaseFetch(
      `learning_stages?select=id,content_version_id,display_order,display_title,difficulty&content_version_id=in.(${learning.inFilter(versionIds)})&order=display_order.asc`
    ),
    learning.u.supabaseFetch(
      `learning_stage_progress?select=assignment_id,stage_id,status,unlocked_at,passed_at&family_id=eq.${encodeURIComponent(claims.family)}&assigned_member_id=eq.${encodeURIComponent(assignedMemberId)}&assignment_id=in.(${learning.inFilter(assignmentIds)})`
    ),
  ]);
  const courseIds = learning.idList(units, "course_id");
  const courses = courseIds.length ? await learning.u.supabaseFetch(
    `learning_courses?select=id,internal_name,subject_name&id=in.(${learning.inFilter(courseIds)})`
  ) : [];
  const unitById = new Map((units || []).map((row) => [String(row.id), row]));
  const courseById = new Map((courses || []).map((row) => [String(row.id), row]));
  const progressByKey = new Map((progress || []).map(
    (row) => [`${row.assignment_id}:${row.stage_id}`, row]
  ));

  return assignments.map((assignment) => {
    const unit = unitById.get(String(assignment.unit_id));
    const course = unit && courseById.get(String(unit.course_id));
    const dto = {
      id: String(assignment.id),
      unitId: String(assignment.unit_id),
      unitTitle: unit?.display_title || "단원",
      status: assignment.status,
      assignedAt: assignment.assigned_at,
      completedAt: assignment.completed_at,
      cancelledAt: assignment.cancelled_at,
      stages: (stages || [])
        .filter((stage) => String(stage.content_version_id) === String(assignment.content_version_id))
        .map((stage) => {
          const stageProgress = progressByKey.get(`${assignment.id}:${stage.id}`);
          return {
            id: String(stage.id),
            title: stage.display_title,
            difficulty: stage.difficulty,
            order: Number(stage.display_order),
            status: stageProgress?.status || "locked",
            unlockedAt: stageProgress?.unlocked_at || null,
            passedAt: stageProgress?.passed_at || null,
          };
        }),
    };
    if (viewerRole === "parent") {
      dto.contentVersionId = String(assignment.content_version_id);
      dto.course = {
        internalName: course?.internal_name || "",
        subjectName: course?.subject_name || "",
      };
    }
    return dto;
  });
}

async function listAssignments(request) {
  const scope = await learning.assignmentReadScope(request);
  return listForScope(scope.claims, scope.assignedMemberId, scope.viewerRole);
}

async function createAssignment(request) {
  learning.requireMutationGuard(request);
  const body = learning.exactBody(
    await learning.u.readJson(request),
    new Set(["assignedMemberId", "unitId", "contentVersionId"])
  );
  const { claims, assignedMemberId } = await learning.parentScope(request, body.assignedMemberId);
  const unitId = learning.uuid(body.unitId, "INVALID_UNIT_ID");
  const contentVersionId = learning.uuid(body.contentVersionId, "INVALID_CONTENT_VERSION_ID");
  const version = (await learning.u.supabaseFetch(
    `learning_content_versions?select=id,unit_id,status&id=eq.${encodeURIComponent(contentVersionId)}&unit_id=eq.${encodeURIComponent(unitId)}&status=eq.published&limit=1`
  ))?.[0];
  if (!version) {
    throw learning.u.err("배정할 단원을 찾을 수 없습니다.", 404, "LEARNING_CONTENT_NOT_FOUND");
  }
  const rows = await learning.u.supabaseFetch("rpc/create_learning_assignment", {
    method: "POST",
    body: JSON.stringify({
      p_family_id: claims.family,
      p_actor_member_id: claims.sub,
      p_assigned_member_id: assignedMemberId,
      p_content_version_id: contentVersionId,
    }),
  });
  const createdId = String((rows?.[0] || rows)?.assignment_id || "");
  if (!createdId) {
    throw learning.u.err("문제풀이 학습을 배정하지 못했습니다.", 500, "ASSIGNMENT_CREATE_FAILED");
  }
  const assignments = await listForScope(claims, assignedMemberId, "parent");
  const assignment = assignments.find((row) => row.id === createdId);
  if (!assignment) {
    throw learning.u.err("생성된 문제풀이 학습을 확인하지 못했습니다.", 500, "ASSIGNMENT_READBACK_FAILED");
  }
  return assignment;
}

module.exports = async function learningAssignments(request, response) {
  if (!["GET", "POST"].includes(request.method)) return learning.u.allow(response, ["GET", "POST"]);
  try {
    if (request.method === "GET") {
      return learning.send(response, 200, { ok: true, assignments: await listAssignments(request) });
    }
    return learning.send(response, 201, { ok: true, assignment: await createAssignment(request) });
  } catch (error) {
    return learning.safeError(response, error);
  }
};

module.exports.listForScope = listForScope;
