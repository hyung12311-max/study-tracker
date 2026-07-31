const learning = require("./_utils");

async function catalog(request) {
  const url = new URL(request.url || "/api/learning/catalog", "http://localhost");
  const { claims, assignedMemberId } = await learning.parentScope(
    request,
    url.searchParams.get("assignedMemberId")
  );
  const versions = await learning.u.supabaseFetch(
    "learning_content_versions?select=id,unit_id,version_no&status=eq.published&order=unit_id.asc,version_no.desc"
  ) || [];
  const latestVersions = [];
  const seenUnits = new Set();
  for (const version of versions) {
    const unitId = String(version.unit_id);
    if (seenUnits.has(unitId)) continue;
    seenUnits.add(unitId);
    latestVersions.push(version);
  }
  if (!latestVersions.length) return [];

  const unitIds = learning.idList(latestVersions, "unit_id");
  const versionIds = learning.idList(latestVersions);
  const [units, stages, activeAssignments, profileRows, recommendationRows] = await Promise.all([
    learning.u.supabaseFetch(
      `learning_units?select=id,course_id,display_title,sort_order&id=in.(${learning.inFilter(unitIds)})&order=sort_order.asc`
    ),
    learning.u.supabaseFetch(
      `learning_stages?select=id,content_version_id,display_order,display_title,difficulty&content_version_id=in.(${learning.inFilter(versionIds)})&order=display_order.asc`
    ),
    learning.u.supabaseFetch(
      `learning_assignments?select=unit_id,content_version_id&family_id=eq.${encodeURIComponent(claims.family)}&assigned_member_id=eq.${encodeURIComponent(assignedMemberId)}&status=eq.active`
    ),
    learning.u.supabaseFetch(
      `learning_member_subject_profiles?select=subject,level_code&family_id=eq.${encodeURIComponent(claims.family)}&member_id=eq.${encodeURIComponent(assignedMemberId)}&subject=eq.math&limit=1`
    ),
    learning.u.supabaseFetch(
      `learning_unit_recommendation_metadata?select=unit_id,subject,recommended_start_level_code,recommended_end_level_code,parent_sort_order&unit_id=in.(${learning.inFilter(unitIds)})`
    ),
  ]);
  const courseIds = learning.idList(units, "course_id");
  const courses = courseIds.length ? await learning.u.supabaseFetch(
    `learning_courses?select=id,internal_name,subject_name,status&id=in.(${learning.inFilter(courseIds)})&status=eq.published`
  ) : [];
  const unitById = new Map((units || []).map((row) => [String(row.id), row]));
  const courseById = new Map((courses || []).map((row) => [String(row.id), row]));
  const assignedUnits = new Set((activeAssignments || []).map((row) => String(row.unit_id)));
  const profile = (profileRows || [])[0] || null;
  const recommendationByUnit = new Map((recommendationRows || []).map((row) => [String(row.unit_id), row]));

  return latestVersions.map((version) => {
    const unit = unitById.get(String(version.unit_id));
    const course = unit && courseById.get(String(unit.course_id));
    if (!unit || !course) return null;
    const versionStages = (stages || [])
      .filter((stage) => String(stage.content_version_id) === String(version.id))
      .map((stage) => ({
        id: String(stage.id),
        title: stage.display_title,
        difficulty: stage.difficulty,
        order: Number(stage.display_order),
      }));
    const recommendation = recommendationByUnit.get(String(unit.id));
    const recommended = Boolean(
      profile && recommendation
      && profile.subject === recommendation.subject
      && profile.level_code === recommendation.recommended_start_level_code
      && (!recommendation.recommended_end_level_code
        || profile.level_code === recommendation.recommended_end_level_code)
    );
    return {
      course: {
        internalName: course.internal_name,
        subjectName: course.subject_name,
      },
      unitId: String(unit.id),
      contentVersionId: String(version.id),
      unitTitle: unit.display_title,
      stageCount: versionStages.length,
      stages: versionStages,
      alreadyAssigned: assignedUnits.has(String(unit.id)),
      recommended,
      recommendationOrder: recommended ? Number(recommendation.parent_sort_order) : null,
    };
  }).filter(Boolean).sort((left, right) => {
    if (left.recommended !== right.recommended) return left.recommended ? -1 : 1;
    if (left.recommended && right.recommended) {
      return left.recommendationOrder - right.recommendationOrder;
    }
    return left.unitTitle.localeCompare(right.unitTitle, "ko");
  }).map(({ recommendationOrder, ...item }) => item);
}

module.exports = async function learningCatalog(request, response) {
  if (request.method !== "GET") return learning.u.allow(response, ["GET"]);
  try {
    return learning.send(response, 200, { ok: true, catalog: await catalog(request) });
  } catch (error) {
    return learning.safeError(response, error);
  }
};
