const u = require("../_utils");
const OPAQUE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

module.exports = async function provisionUatFamilyV2(request, response) {
  if (request.method !== "POST") return u.allow(response);
  try {
    u.requireMutationGuard(request);
    u.requireAdmin(request);
    const input = u.provisioningRequestV2(await u.push.readJson(request));
    const result = await u.push.supabaseFetch("rpc/provision_uat_family_v2", {
      method: "POST",
      body: JSON.stringify({
        p_request_id: input.requestId,
        p_request_digest: input.digest,
        p_family_key: input.familyKey,
        p_family_display_name: input.familyDisplayName,
        p_parent_member_key: input.parent.memberKey,
        p_parent_display_name: input.parent.displayName,
        p_parent_pin: input.parent.pin,
        p_children: input.children.map((child) => ({
          member_key: child.memberKey,
          display_name: child.displayName,
          pin: child.pin,
        })),
      }),
    });
    const provisioned = Array.isArray(result) ? result[0] : result;
    if (!provisioned
      || provisioned.created !== true
      || !OPAQUE_ID.test(provisioned.family_id || "")
      || !OPAQUE_ID.test(provisioned.parent_member_id || "")
      || !Array.isArray(provisioned.children)) {
      throw new Error("Provisioning response was invalid.");
    }
    if (provisioned.children.length !== input.children.length) throw new Error("Provisioning child count was invalid.");
    if (provisioned.children.some((child, index) => !OPAQUE_ID.test(child?.id || "")
      || child.member_key !== input.children[index].memberKey)) {
      throw new Error("Provisioning child identity was invalid.");
    }
    return u.send(response, 201, {
      ok: true,
      created: true,
      family: { id: provisioned.family_id, key: input.familyKey },
      parent: {
        id: provisioned.parent_member_id,
        memberKey: input.parent.memberKey,
        displayName: input.parent.displayName,
        loginReady: true,
      },
      children: input.children.map((child, index) => ({
        id: provisioned.children[index].id,
        memberKey: child.memberKey,
        displayName: child.displayName,
        loginReady: true,
      })),
    });
  } catch (error) {
    return u.safeError(response, error);
  }
};
