const u = require("./_utils");

const SIMPLE_PINS = new Set(["0000", "1111", "1234", "4321"]);

function isValidMemberKey(value) {
  return /^[a-z0-9_-]{2,40}$/.test(value || "");
}

function isValidPin(value) {
  return /^\d{4}$/.test(value || "");
}

function isSimplePin(value) {
  if (SIMPLE_PINS.has(value)) return true;
  return /^(\d)\1{3}$/.test(value);
}

module.exports = async function changeFamilyPin(request, response) {
  if (request.method !== "POST") return u.allow(response, ["POST"]);

  try {
    const claims = u.authenticate(request);
    const body = await u.readJson(request);
    const memberKey = String(body.member_key || body.memberKey || "");
    const currentPin = String(body.current_pin || body.currentPin || "");
    const newPin = String(body.new_pin || body.newPin || "");

    if (!isValidMemberKey(memberKey)) throw u.err("가족 사용자를 확인할 수 없습니다.");
    if (memberKey !== claims.key) throw u.err("본인의 PIN만 변경할 수 있습니다.", 403);
    if (!isValidPin(currentPin) || !isValidPin(newPin)) throw u.err("PIN은 숫자 4자리로 입력해 주세요.");
    if (currentPin === newPin) throw u.err("새 PIN은 현재 PIN과 다르게 입력해 주세요.");
    if (isSimplePin(newPin)) throw u.err("너무 단순한 PIN은 사용할 수 없습니다.");

    const rows = await u.supabaseFetch("rpc/verify_family_member_pin", {
      method: "POST",
      body: JSON.stringify({ p_member_key: memberKey, p_pin: currentPin }),
    });
    const member = rows?.[0];

    if (!member) throw u.err("가족 사용자를 확인할 수 없습니다.", 404);
    if (member.member_id !== claims.sub || member.family_id !== claims.family) {
      throw u.err("본인의 PIN만 변경할 수 있습니다.", 403);
    }
    if (!member.verified) {
      if (member.locked_until && new Date(member.locked_until) > new Date()) {
        return u.json(response, 423, { ok: false, error: "PIN 입력을 여러 번 실패했습니다. 잠시 후 다시 시도해 주세요.", lockedUntil: member.locked_until });
      }
      throw u.err("현재 PIN이 일치하지 않습니다.", 401);
    }

    await u.supabaseFetch("rpc/set_family_member_pin", {
      method: "POST",
      body: JSON.stringify({ p_member_id: claims.sub, p_family_id: claims.family, p_pin: newPin }),
    });

    return u.json(response, 200, { ok: true, message: "PIN이 변경되었습니다." });
  } catch (error) {
    const status = error.statusCode || 500;
    const message = error.statusCode ? error.message : "PIN을 변경하지 못했습니다.";
    return u.json(response, status, { ok: false, error: message });
  }
};
