const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const migration = read("supabase/migrations/202608150002_reward_auth_expand_contract.sql");
const rollback = read("supabase/rollbacks/202608150002_rollback_reward_auth_expand_contract.sql");
const verification = read("supabase/verification/202608150002_reward_auth_expand_contract_verify.sql");
const fixture = read("test/fixtures/phase1_batch5b_reward_auth_expand_fixture.sql");
const targetGuard = read("test/fixtures/phase1_batch5b_existing_target_guard_fixture.sql");
const nullTargetGuard = read("test/fixtures/phase1_batch5b_null_target_guard_fixture.sql");
const nullNameGuard = read("test/fixtures/phase1_batch5b_null_name_guard_fixture.sql");

test("Batch 5B deterministically backfills exactly one default-family reward setting", () => {
  assert.match(migration, /default_family_count<>1 or legacy_setting_count<>1 or target_setting_count<>0/);
  assert.match(migration, /from public\.families family cross join public\.reward_settings legacy/);
  assert.match(migration, /family\.family_key='default'/);
  assert.match(migration, /reward setting parity failed/);
  assert.match(migration, /is_nullable='YES' and column_default='10'/);
  assert.match(migration, /reward data null guard failed/);
  assert.match(nullTargetGuard, /target_stickers=null/);
  assert.match(nullNameGuard, /reward_name=null/);
  assert.doesNotMatch(migration, /delete from public\.reward_settings|drop table public\.reward_settings/i);
  assert.match(targetGuard, /Existing setting/);
});

test("actor-aware exchange RPC enforces parent-child and child-self policy", () => {
  assert.match(migration, /create function public\.create_reward_exchange_request_v2\(/);
  assert.match(migration, /member\.id=p_actor_member_id[\s\S]*member\.is_active=true/);
  assert.match(migration, /member\.role='child'/);
  assert.match(migration, /actor\.role='child' and actor\.id<>target\.id/);
  assert.match(migration, /product_row\.family_id=p_family_id/);
  for (const label of ["cross-family target exchange", "cross-family product exchange", "child sibling exchange"]) {
    assert.match(fixture, new RegExp(label));
  }
});

test("actor-aware PIN RPC requires an active same-family parent and keeps hash semantics", () => {
  assert.match(migration, /create function public\.set_family_member_pin_v2\(/);
  assert.match(migration, /member\.role='parent'/);
  assert.match(migration, /member\.id=p_target_member_id and member\.family_id=p_family_id and member\.is_active=true/);
  assert.match(migration, /extensions\.crypt\(p_pin,extensions\.gen_salt\('bf',12\)\)/);
  assert.match(fixture, /cross-family PIN changed protected state/);
  assert.match(fixture, /positive PIN hash semantics failed/);
});

test("new RPCs are fixed-search-path security definers and service-role only", () => {
  assert.equal((migration.match(/security definer/g) || []).length, 2);
  assert.match(migration, /set search_path=pg_catalog, public/);
  assert.match(migration, /set search_path=pg_catalog, public, extensions/);
  assert.equal((migration.match(/from public,anon,authenticated,service_role/g) || []).length, 2);
  assert.equal((migration.match(/to service_role;/g) || []).length, 2);
  assert.match(verification, /RPC execute ACL failed/);
});

test("Product uses only expanded contracts while UAT retains the isolated legacy PIN dependency", () => {
  const productFiles = [
    "server/api/rewards/settings.js", "server/api/rewards/exchange.js",
    "server/api/family/pin.js", "server/api/family/change-pin.js",
  ].map(read).join("\n");
  assert.doesNotMatch(productFiles, /["']rpc\/create_reward_exchange_request["']/);
  assert.doesNotMatch(productFiles, /["']rpc\/set_family_member_pin["']/);
  assert.doesNotMatch(productFiles, /supabaseFetch\(["']reward_settings\?/);
  assert.match(productFiles, /rpc\/create_reward_exchange_request_v2/);
  assert.match(productFiles, /rpc\/set_family_member_pin_v2/);
  assert.match(read("supabase/migrations/202608100011_create_uat_family_provisioning.sql"), /perform public\.set_family_member_pin/);
});

test("legacy RPCs coexist and rollback preserves backfilled family data", () => {
  assert.doesNotMatch(migration, /drop function public\.(create_reward_exchange_request|set_family_member_pin)\b/i);
  assert.doesNotMatch(migration, /revoke .*create_reward_exchange_request\(uuid,uuid,uuid,text\)/i);
  assert.doesNotMatch(rollback, /delete from|drop table/i);
  assert.match(rollback, /Preserve the deterministic family_reward_settings backfill/);
  assert.match(fixture, /rollback contract failed/);
});

test("verification is read-only and covers parity security ACL coexistence and tenant integrity", () => {
  assert.match(verification, /^begin transaction read only;/);
  assert.match(verification, /reward parity failed/);
  assert.match(verification, /reward schema verification failed/);
  assert.match(verification, /is distinct from/);
  assert.match(verification, /old\/new RPC coexistence failed/);
  assert.match(verification, /RPC security\/search_path failed/);
  assert.match(verification, /reward tenant verification failed/);
  assert.match(verification, /rollback;\s*$/);
  assert.doesNotMatch(verification, /^\s*(insert|update|delete|alter|create|drop|truncate)\b/im);
});
