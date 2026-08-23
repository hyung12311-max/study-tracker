const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Batch 1 migration defines a Product-only atomic and idempotent onboarding boundary", () => {
  const sql = read("supabase/migrations/202608170001_product_family_onboarding.sql");
  assert.match(sql, /create table public\.product_onboarding_requests/i);
  assert.match(sql, /create function public\.create_product_family_with_first_parent/i);
  assert.match(sql, /pg_advisory_xact_lock/i);
  assert.match(sql, /IDEMPOTENCY_CONFLICT/);
  assert.match(sql, /ONBOARDING_RATE_LIMITED/);
  assert.match(sql, /extensions\.crypt\(p_parent_pin, extensions\.gen_salt\('bf', 12\)\)/i);
  assert.match(sql, /insert into public\.families[\s\S]*insert into public\.family_members/i);
  assert.doesNotMatch(sql, /provision_uat_family/);
});

test("Product onboarding audit stores only keyed digests and safe correlation", () => {
  const sql = read("supabase/migrations/202608170001_product_family_onboarding.sql");
  const table = sql.match(/create table public\.product_onboarding_requests[\s\S]*?\n\);/i)?.[0] || "";
  assert.match(table, /request_digest text not null/);
  assert.match(table, /rate_scope_digest text not null/);
  assert.doesNotMatch(table, /\bpin\b|token|cookie|display_name/i);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /grant execute[\s\S]*to service_role/i);
});

test("Public route is narrow, separate from UAT, and registered in the router", () => {
  const router = read("api/[...path].js");
  const api = read("server/api/onboarding/family.js");
  assert.match(router, /"onboarding\/family": productOnboardingFamily/);
  assert.match(api, /create_product_family_with_first_parent/);
  assert.doesNotMatch(api, /provision_uat_family|admin\/uat/);
  assert.match(api, /ONBOARDING_VALIDATION_FAILED/);
  assert.match(api, /WEAK_PARENT_PIN/);
  assert.match(api, /IDEMPOTENCY_CONFLICT/);
  assert.match(api, /ONBOARDING_RATE_LIMITED/);
  assert.match(api, /ONBOARDING_CREATION_FAILED/);
});

test("Request digest is keyed and includes the PIN without persisting or logging it", () => {
  const api = read("server/api/onboarding/family.js");
  assert.match(api, /createHmac\("sha256", secret\)/);
  assert.match(api, /parentPin/);
  assert.match(api, /rememberDevice:\s*input\.rememberDevice/);
  assert.doesNotMatch(api, /console\.(?:log|info|warn|error)[^\n]*parentPin/);
  assert.doesNotMatch(api, /pin_hash/);
});

test("Response DTO omits Family and member internal identities while issuing auth", () => {
  const api = read("server/api/onboarding/family.js");
  const responseDto = api.slice(api.indexOf("return send(response, result.created"), api.indexOf("  } catch (error) {", api.indexOf("return send(response, result.created")));
  assert.match(api, /onboardingState:\s*"PARENT_AUTHENTICATED"/);
  assert.match(api, /\btoken,/);
  assert.match(api, /\brealtimeToken,/);
  assert.doesNotMatch(responseDto, /family_id|family_key|member_key|pin_hash/);
});

test("API validation normalizes names and rejects weak PIN and ownership injection", () => {
  const handler = require("../server/api/onboarding/family");
  const request = { headers: { "content-type": "application/json", host: "localhost" } };
  const valid = handler._test.validateRequest(request, {
    onboardingRequestId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    familyDisplayName: "  우리 가족  ", parentDisplayName: "  엄마  ",
    parentPin: "7392", rememberDevice: true,
  });
  assert.equal(valid.familyDisplayName, "우리 가족");
  assert.equal(valid.parentDisplayName, "엄마");
  assert.throws(() => handler._test.validateRequest(request, {
    ...valid, family_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  }), (error) => error.code === "ONBOARDING_VALIDATION_FAILED");
  assert.throws(() => handler._test.validateRequest(request, {
    ...valid, parentPin: "1234",
  }), (error) => error.code === "WEAK_PARENT_PIN");
});

test("Migration ships local verification and rollback contracts", () => {
  const verify = read("supabase/verification/202608170001_product_family_onboarding_verify.sql");
  const rollback = read("supabase/rollback/202608170001_product_family_onboarding_rollback.sql");
  assert.match(verify, /product_onboarding_requests/);
  assert.match(verify, /create_product_family_with_first_parent/);
  assert.match(rollback, /refuses|raise exception/i);
  assert.match(rollback, /drop function/i);
});
