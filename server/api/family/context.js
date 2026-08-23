const u = require("./_utils");
module.exports = async function familyContext(request, response) {
  if (request.method !== "GET") return u.allow(response, ["GET"]);
  response.setHeader("Cache-Control", "no-store");
  try {
    await u.trustedFamilyScope(request, response);
    return u.json(response, 200, { hasFamilyContext: true });
  } catch (error) {
    if (["FAMILY_CONTEXT_REQUIRED", "FAMILY_CONTEXT_INVALID", "FAMILY_CONTEXT_EXPIRED"].includes(error.code)) return u.json(response, 200, { hasFamilyContext: false });
    return u.json(response, 500, { hasFamilyContext: false, code: "FAMILY_CONTEXT_CHECK_FAILED" });
  }
};
