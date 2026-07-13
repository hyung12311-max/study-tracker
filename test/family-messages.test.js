const assert = require("node:assert/strict");
const test = require("node:test");

const utils = require("../server/api/family/_utils");
const handler = require("../server/api/family/messages");

function responseCapture() {
  return {
    statusCode: 0,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    end(value) { this.body = JSON.parse(value); },
  };
}

function replaceUtils(overrides) {
  const originals = {};
  for (const [key, value] of Object.entries(overrides)) {
    originals[key] = utils[key];
    utils[key] = value;
  }
  return () => Object.assign(utils, originals);
}

test("message retry reuses client_message_id without inserting or pushing twice", async () => {
  const clientMessageId = "1f997ff6-702d-40a8-b1aa-30c19a8d7e21";
  const calls = [];
  let pushes = 0;
  const row = {
    id: "7a4d33ab-5748-4631-94ee-4b915df7db42",
    family_id: "family-id",
    sender_id: "member-id",
    message_type: "text",
    content: "안녕하세요",
    client_message_id: clientMessageId,
    created_at: "2026-07-14T12:00:00.000Z",
  };
  const restore = replaceUtils({
    authenticate: () => ({ sub: "member-id", family: "family-id", key: "hagyeom", role: "child" }),
    readJson: async () => ({ content: "안녕하세요", clientMessageId }),
    supabaseFetch: async (path) => {
      calls.push(path);
      if (path.startsWith("family_members?select=")) return [{ id: "member-id", member_key: "hagyeom", display_name: "하겸이", avatar_emoji: "👦", is_active: true }];
      if (path === "family_messages?on_conflict=client_message_id") return [];
      if (path.startsWith("family_messages?select=*&client_message_id=eq.")) return [row];
      return [];
    },
    sendPush: async () => { pushes += 1; },
  });

  try {
    const response = responseCapture();
    await handler({ method: "POST", headers: { authorization: "Bearer token" }, url: "/api/family/messages" }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.message.id, row.id);
    assert.equal(response.body.message.client_message_id, clientMessageId);
    assert.equal(pushes, 0);
    assert.ok(calls.includes("family_messages?on_conflict=client_message_id"));
    assert.ok(calls.some((path) => path.includes(`client_message_id=eq.${clientMessageId}`)));
  } finally {
    restore();
  }
});
