const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const migration = read("supabase/migrations/202608100011_create_uat_family_provisioning.sql");
const rollback = read("supabase/rollbacks/202608100011_rollback_uat_family_provisioning.sql");
const verification = read("supabase/verification/202608100011_uat_family_provisioning_verify.sql");
const fixture = read("test/fixtures/uat_family_provisioning_fixture.sql");
const router = read("api/[...path].js");

test("router exposes only the narrow admin UAT provisioning mutation", () => {
  assert.match(router, /"admin\/uat\/provision-family": adminUatProvisionFamily/);
  assert.doesNotMatch(router, /admin\/famil(?:y|ies)|admin\/members/);
});

test("migration creates one immutable UAT audit table and an atomic service-only function", () => {
  assert.equal((migration.match(/create table public\./g) || []).length, 1);
  assert.match(migration, /purpose text not null default 'uat'/);
  assert.match(migration, /request_id uuid primary key/);
  assert.match(migration, /before update or delete on public\.uat_family_provisioning_requests/);
  assert.match(migration, /security definer[\s\S]*set search_path = pg_catalog, public/);
  assert.match(migration, /perform public\.set_family_member_pin/g);
  assert.doesNotMatch(migration, /auth\.users/);
});

test("database contract enforces UAT-only keys, deterministic actors, and idempotency", () => {
  assert.match(migration, /p_family_key !~ '\^uat-/);
  assert.match(migration, /p_parent_member_key <> p_family_key \|\| '-parent'/);
  assert.match(migration, /p_child_member_key <> p_family_key \|\| '-child'/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /IDEMPOTENCY_CONFLICT/);
  assert.match(migration, /UAT_FAMILY_CONFLICT/);
});

test("audit is FORCE RLS, service-read-only, and provisioning execute is service-only", () => {
  assert.match(migration, /enable row level security;[\s\S]*force row level security/);
  assert.match(migration, /grant select on table public\.uat_family_provisioning_requests to service_role/);
  assert.match(migration, /revoke all on function public\.provision_uat_family[\s\S]*public, anon, authenticated, service_role/);
  assert.match(migration, /grant execute on function public\.provision_uat_family[\s\S]*to service_role/);
});

test("verification is read-only and rollback refuses persisted UAT history", () => {
  assert.match(verification, /^begin transaction read only;/);
  assert.doesNotMatch(verification, /^\s*(?:insert|update|delete|alter|create|drop|truncate)\b/im);
  assert.match(rollback, /exists \(select 1 from public\.uat_family_provisioning_requests\)/);
  assert.match(rollback, /UAT family provisioning is in use/);
});

test("disposable fixture covers creation, auth hashes, zero-delta retry, isolation, ACL, and rollback guard", () => {
  for (const marker of [
    "UAT family and member creation failed",
    "bootstrap PIN hashing contract failed",
    "idempotent retry changed UAT rows",
    "existing family changed during provisioning",
    "provisioning ACL failed",
    "rollback guard with persisted UAT audit",
  ]) assert.match(fixture, new RegExp(marker, "i"));
});
