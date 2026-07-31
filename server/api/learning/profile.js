const learning = require("./_utils");

async function readProfile(request) {
  const url = new URL(request.url || "/api/learning/profile", "http://localhost");
  const { claims, assignedMemberId } = await learning.parentScope(
    request,
    url.searchParams.get("assignedMemberId")
  );
  const row = (await learning.u.supabaseFetch(
    `learning_member_subject_profiles?select=subject,level_code&family_id=eq.${encodeURIComponent(claims.family)}&member_id=eq.${encodeURIComponent(assignedMemberId)}&subject=eq.math&limit=1`
  ))?.[0];
  return learning.profileDto(row);
}

async function writeProfile(request) {
  learning.requireMutationGuard(request);
  const body = learning.exactBody(await learning.u.readJson(request), new Set([
    "assignedMemberId", "subject", "level",
  ]));
  const { claims, assignedMemberId } = await learning.parentScope(request, body.assignedMemberId);
  const subject = learning.subjectCode(body.subject);
  const level = learning.levelCode(body.level);
  const result = await learning.u.supabaseFetch("rpc/upsert_learning_member_subject_profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      p_family_id: claims.family,
      p_actor_member_id: claims.sub,
      p_member_id: assignedMemberId,
      p_subject: subject,
      p_level_code: level,
    }),
  });
  const row = Array.isArray(result) ? result[0] : result;
  return learning.profileDto(row);
}

module.exports = async function learningProfile(request, response) {
  if (!new Set(["GET", "PUT"]).has(request.method)) {
    return learning.allow(response, ["GET", "PUT"]);
  }
  try {
    const profile = request.method === "GET"
      ? await readProfile(request)
      : await writeProfile(request);
    return learning.send(response, 200, { ok: true, profile });
  } catch (error) {
    return learning.safeError(response, error);
  }
};
