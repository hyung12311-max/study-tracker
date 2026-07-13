const u = require("./_utils");

function isDevelopment() {
  return process.env.VERCEL_ENV !== "production" && process.env.NODE_ENV !== "production";
}

function errorDetails(error) {
  return {
    name: error?.name || "Error",
    message: error?.message || "Unknown error",
    code: error?.code || null,
    statusCode: error?.statusCode || 500,
    supabaseStatus: error?.supabaseStatus || null,
    supabaseCode: error?.supabaseCode || null,
    supabaseMessage: error?.supabaseMessage || null,
    missingEnvironmentVariables: error?.missingEnvironmentVariables || [],
    stack: error?.stack || null,
  };
}

function publicError(error) {
  const code = error?.code || error?.supabaseCode || "PIN_VERIFICATION_FAILED";
  const response = {
    ok: false,
    error: error?.statusCode ? error.message : "PIN verification failed.",
    code,
  };
  if (isDevelopment()) {
    response.details = {
      statusCode: error?.statusCode || 500,
      supabaseStatus: error?.supabaseStatus || null,
      supabaseCode: error?.supabaseCode || null,
      supabaseMessage: error?.supabaseMessage || null,
      missingEnvironmentVariables: error?.missingEnvironmentVariables || [],
    };
  }
  return response;
}

module.exports = async function verifyFamilyPin(request, response) {
  if (request.method !== "POST") return u.allow(response, ["POST"]);

  try {
    const body = await u.readJson(request);
    const memberKey = String(body.memberKey || body.member_key || "");
    const pin = String(body.pin || "");
    if (!/^[a-z0-9_-]{2,40}$/.test(memberKey) || !/^\d{4}$/.test(pin)) {
      throw u.err("Select a member and enter a 4-digit PIN.", 400, "PIN_INPUT_INVALID");
    }

    const rpcResult = await u.supabaseFetch("rpc/verify_family_member_pin", {
      method: "POST",
      body: JSON.stringify({ p_member_key: memberKey, p_pin: pin }),
    });
    const member = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult;

    if (!member || typeof member !== "object") {
      throw u.err("Member is not available.", 404, "MEMBER_NOT_FOUND");
    }
    if (member.verified !== true) {
      if (member.locked_until && new Date(member.locked_until) > new Date()) {
        return u.json(response, 423, {
          ok: false,
          error: "Too many attempts. Try again in 30 seconds.",
          code: "PIN_LOCKED",
          lockedUntil: member.locked_until,
        });
      }
      throw u.err("The PIN does not match.", 401, "PIN_INVALID");
    }

    // Token errors must remain fatal, but they now retain their configuration code.
    const token = u.signToken(member);
    const realtimeToken = u.signRealtimeToken(member);

    let expiresAt = null;
    let sessionWarning = null;
    let deviceSessionToken = null;
    if (body.rememberDevice === true) {
      try {
        const deviceSession = await u.createDeviceSession(request, response, member, body.deviceSessionToken);
        expiresAt = deviceSession.expiresAt;
        deviceSessionToken = deviceSession.token;
      } catch (sessionError) {
        // Persistent login is optional. A missing/unavailable session table must not
        // turn a successfully verified PIN into a failed parent login.
        u.clearDeviceCookie(request, response);
        sessionWarning = "DEVICE_SESSION_SAVE_FAILED";
        console.error("[family verify-pin] device session save failed", errorDetails(sessionError));
      }
    } else {
      await u.revokeDeviceSession(body.deviceSessionToken, "remember_device_disabled");
      u.clearDeviceCookie(request, response);
    }

    return u.json(response, 200, {
      ok: true,
      token,
      realtimeToken,
      expiresIn: 28800,
      expires_at: expiresAt,
      rememberDevice: Boolean(expiresAt),
      ...(deviceSessionToken ? { deviceSessionToken } : {}),
      ...(sessionWarning ? { warningCode: sessionWarning } : {}),
      member: {
        id: member.member_id,
        family_id: member.family_id,
        member_key: member.member_key,
        display_name: member.display_name,
        role: member.role,
        avatar_emoji: member.avatar_emoji,
      },
    });
  } catch (error) {
    console.error("[family verify-pin] failed", errorDetails(error));
    return u.json(response, error.statusCode || 500, publicError(error));
  }
};
