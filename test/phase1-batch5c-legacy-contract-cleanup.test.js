const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const migration = read("supabase/migrations/202608150003_legacy_contract_cleanup.sql");
const rollback = read("supabase/rollbacks/202608150003_rollback_legacy_contract_cleanup.sql");
const verification = read("supabase/verification/202608150003_legacy_contract_cleanup_verify.sql");
const fixture = read("test/fixtures/phase1_batch5c_legacy_contract_cleanup_fixture.sql");

test("Batch 5C closes legacy Exchange execution while preserving v2", () => {
  assert.match(migration, /revoke all on function public\.create_reward_exchange_request\(uuid,uuid,uuid,text\)/);
  assert.doesNotMatch(migration, /drop function public\.create_reward_exchange_request\b/i);
  assert.match(migration, /legacy Exchange internal dependency remains/);
  assert.match(verification, /has_function_privilege\('service_role',legacy_exchange,'execute'\)/);
  assert.match(fixture, /legacy Exchange direct execute/);
  assert.match(fixture, /create_reward_exchange_request_v2/);
});

test("Batch 5C makes legacy PIN internal-only behind UAT provisioning", () => {
  assert.match(migration, /revoke all on function public\.set_family_member_pin\(uuid,uuid,text\)/);
  assert.doesNotMatch(migration, /drop function public\.set_family_member_pin\b/i);
  assert.match(migration, /perform public\.set_family_member_pin/);
  assert.match(verification, /legacy RPC closure verification failed/);
  assert.match(fixture, /UAT internal PIN provisioning failed/);
});

test("legacy reward and Push tables become owner-only archives without drops", () => {
  assert.match(migration, /revoke all privileges on table public\.reward_settings/);
  assert.match(migration, /alter table public\.push_subscriptions force row level security/);
  assert.match(migration, /revoke all privileges on table public\.push_subscriptions/);
  assert.doesNotMatch(migration, /drop table public\.(reward_settings|push_subscriptions)/i);
  assert.match(verification, /reward archive verification failed/);
  assert.match(verification, /Push archive verification failed/);
});

test("rollback restores only compatibility ACL and changes no business data", () => {
  assert.match(rollback, /grant execute on function public\.create_reward_exchange_request/);
  assert.match(rollback, /grant execute on function public\.set_family_member_pin/);
  assert.match(rollback, /grant select on table public\.reward_settings/);
  assert.match(rollback, /grant select, insert, update, delete on table public\.push_subscriptions/);
  assert.doesNotMatch(rollback, /^\s*(insert|update|delete|truncate|drop table)\b/im);
});

test("verification is read-only and checks tenant parity and ACL boundaries", () => {
  assert.match(verification, /^begin transaction read only;/);
  assert.match(verification, /is distinct from/);
  assert.match(verification, /tenant verification failed/);
  assert.match(verification, /rollback;\s*$/);
  assert.doesNotMatch(verification, /^\s*(insert|update|delete|alter|create|drop|truncate)\b/im);
});

test("Product retains only v2 and scoped Reward contracts", () => {
  const product = [
    "server/api/rewards/exchange.js",
    "server/api/rewards/settings.js",
    "server/api/family/pin.js",
    "server/api/family/change-pin.js",
  ].map(read).join("\n");
  assert.doesNotMatch(product, /["']rpc\/create_reward_exchange_request["']/);
  assert.doesNotMatch(product, /["']rpc\/set_family_member_pin["']/);
  assert.doesNotMatch(product, /supabaseFetch\(["']reward_settings\?/);
  assert.match(product, /create_reward_exchange_request_v2/);
  assert.match(product, /set_family_member_pin_v2/);
  assert.match(product, /family_reward_settings/);
});

test("legacy Push tombstone remains and dead table helper is absent", () => {
  assert.match(read("server/api/push/unsubscribe.js"), /410/);
  assert.doesNotMatch(read("server/api/push/_utils.js"), /push_subscriptions\?/);
  assert.match(read("server/api/notifications/unsubscribe.js"), /family_push_subscriptions\?/);
});

test("family message unread embedding names the composite scope relationship", () => {
  const messages = read("server/api/family/messages.js");
  assert.match(messages, /family_message_reads!family_message_reads_message_scope_fk\(member_id\)/);
  assert.doesNotMatch(messages, /family_message_reads!left\(member_id\)/);
});
