const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const router = read("api/[...path].js");
const endpoint = read("server/api/admin/uat/provision-family-v2.js");
const migration = read("supabase/migrations/202608150004_uat_provisioning_v2_multi_child.sql");
const rollback = read("supabase/rollbacks/202608150004_rollback_uat_provisioning_v2_multi_child.sql");
const verification = read("supabase/verification/202608150004_uat_provisioning_v2_multi_child_verify.sql");
const fixture = read("test/fixtures/uat_family_provisioning_v2_fixture.sql");
const v1Migration = read("supabase/migrations/202608100011_create_uat_family_provisioning.sql");

test("v1 remains intact while a narrow versioned endpoint calls only v2", () => {
  assert.match(router, /"admin\/uat\/provision-family": adminUatProvisionFamily/);
  assert.match(router, /"admin\/uat\/provision-family-v2": adminUatProvisionFamilyV2/);
  assert.match(endpoint, /rpc\/provision_uat_family_v2/);
  assert.doesNotMatch(endpoint, /rpc\/provision_uat_family["']/);
  assert.match(v1Migration, /create function public\.provision_uat_family\(/);
});

test("v2 is one hardened service-only transaction with deterministic member keys", () => {
  assert.match(migration, /create function public\.provision_uat_family_v2\(/);
  assert.match(migration, /security definer[\s\S]*set search_path = pg_catalog, public/);
  assert.match(migration, /p_parent_member_key <> 'parent'/);
  assert.match(migration, /child\.value->>'member_key' <> 'child' \|\| child\.position::text/);
  assert.match(migration, /insert into public\.families[\s\S]*insert into public\.family_members[\s\S]*uat_family_provisioning_requests/);
  assert.match(migration, /jsonb_array_length\(p_children\) not between 1 and 5/);
});

test("v2 audit records child cardinality without PIN or credential payloads", () => {
  assert.match(migration, /add column child_count integer not null default 1/);
  assert.match(migration, /child_count[\s\S]*jsonb_array_length\(new_children\)/);
  assert.doesNotMatch(migration, /insert into public\.uat_family_provisioning_requests[\s\S]*p_parent_pin/);
  assert.doesNotMatch(migration, /insert into public\.uat_family_provisioning_requests[\s\S]*child_input->>'pin'/);
});

test("v2 keeps legacy PIN internal and exposes only service-role execution", () => {
  assert.match(migration, /perform public\.set_family_member_pin/g);
  assert.match(migration, /revoke all on function public\.provision_uat_family_v2[\s\S]*public, anon, authenticated, service_role/);
  assert.match(migration, /grant execute on function public\.provision_uat_family_v2[\s\S]*to service_role/);
  assert.match(verification, /legacy PIN direct execution was reopened/);
});

test("verification is read-only and preserves v1 while rollback removes only v2 execution", () => {
  assert.match(verification, /^begin transaction read only;/);
  assert.doesNotMatch(verification, /^\s*(?:insert|update|delete|alter|create|drop|truncate)\b/im);
  assert.match(verification, /UAT provisioning v1\/v2 contract is incomplete/);
  assert.match(rollback, /drop function public\.provision_uat_family_v2/);
  assert.doesNotMatch(rollback, /drop function public\.provision_uat_family\(/);
  assert.doesNotMatch(rollback, /(?:delete from|drop table|drop column)/i);
});

test("fixture proves two Families, sibling topology, atomic refusal, collision, ACL, and rollback", () => {
  for (const marker of [
    "v2 Parent plus two Children creation failed",
    "same logical keys across Families failed",
    "duplicate child key changed database state",
    "invalid second child changed database state",
    "v2 Family collision changed database state",
    "v1 regression after v2 failed",
    "v2 provisioning ACL failed",
    "v2 rollback contract failed",
  ]) assert.match(fixture, new RegExp(marker, "i"));
});
