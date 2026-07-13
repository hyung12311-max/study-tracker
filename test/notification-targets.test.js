const assert = require("node:assert/strict");
const test = require("node:test");

const push = require("../server/api/push/_utils");
const family = require("../server/api/family/_utils");

test("family chat recipients are every active family member except the sender", async () => {
  const originalFetch = push.supabaseFetch;
  const queries = [];
  push.supabaseFetch = async (query) => {
    queries.push(query);
    return [{ member_key: "father" }, { member_key: "hagyeom" }, { member_key: "dayul" }];
  };
  try {
    const recipients = await family.notificationRecipientKeys(
      { family_id: "family-id", message_type: "text" },
      { member_key: "mother" }
    );
    assert.deepEqual(recipients, ["father", "hagyeom", "dayul"]);
    assert.match(queries[0], /is_active=eq\.true/);
    assert.match(queries[0], /member_key=neq\.mother/);
    assert.doesNotMatch(queries[0], /role=eq\.parent/);
  } finally {
    push.supabaseFetch = originalFetch;
  }
});

test("study-complete recipients are active parents only", async () => {
  const originalFetch = push.supabaseFetch;
  let query = "";
  push.supabaseFetch = async (value) => {
    query = value;
    return [{ member_key: "mother" }, { member_key: "father" }];
  };
  try {
    const recipients = await family.notificationRecipientKeys(
      { family_id: "family-id", message_type: "system", related_type: "study_complete" },
      { member_key: "hagyeom" }
    );
    assert.deepEqual(recipients, ["mother", "father"]);
    assert.match(query, /role=eq\.parent/);
    assert.doesNotMatch(query, /member_key=neq\.hagyeom/);
  } finally {
    push.supabaseFetch = originalFetch;
  }
});
