const u = require("../_utils");

module.exports = async function provisionUatFamily(request, response) {
  if (request.method !== "POST") return u.allow(response);
  try {
    u.requireMutationGuard(request);
    u.requireAdmin(request);
    const input = u.provisioningRequest(await u.push.readJson(request));
    const result = await u.push.supabaseFetch("rpc/provision_uat_family", {
      method: "POST",
      body: JSON.stringify({
        p_request_id: input.requestId,
        p_request_digest: input.digest,
        p_family_key: input.familyKey,
        p_family_display_name: input.familyDisplayName,
        p_parent_member_key: input.parent.memberKey,
        p_parent_display_name: input.parent.displayName,
        p_parent_pin: input.parent.pin,
        p_child_member_key: input.child.memberKey,
        p_child_display_name: input.child.displayName,
        p_child_pin: input.child.pin,
      }),
    });
    const provisioned = Array.isArray(result) ? result[0] : result;
    if (!provisioned || typeof provisioned.created !== "boolean") throw new Error("Provisioning response was invalid.");
    return u.send(response, provisioned.created ? 201 : 200, {
      ok: true,
      created: provisioned.created,
      family: { key: input.familyKey },
      parent: { memberKey: input.parent.memberKey, displayName: input.parent.displayName, loginReady: true },
      child: { memberKey: input.child.memberKey, displayName: input.child.displayName, loginReady: true },
    });
  } catch (error) {
    return u.safeError(response, error);
  }
};
