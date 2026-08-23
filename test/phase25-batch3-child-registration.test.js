const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Child creation route is registered and uses a strict public request contract", () => {
  const router = read("api/[...path].js");
  const source = read("server/api/family/children.js");
  assert.match(router, /family\/children/);
  assert.match(source, /clientRequestId/);
  assert.match(source, /displayName/);
  assert.match(source, /avatarEmoji/);
  for (const field of ["family_id", "familyId", "role", "is_active", "isActive", "member_key", "memberKey", "pin", "pin_hash", "parentId"]) {
    assert.match(source, new RegExp(`ALLOWED_FIELDS[\\s\\S]*${field}`));
  }
});

test("Child creation requires an authenticated active Parent and derives ownership from auth", () => {
  const source = read("server/api/family/children.js");
  assert.match(source, /authenticateActiveMember[\s\S]*requiredRole:\s*["']parent["']/);
  assert.match(source, /context\.familyId/);
  assert.match(source, /context\.memberId/);
  assert.doesNotMatch(source, /body\.(?:family_id|familyId|role|is_active|member_key|parentId)/);
});

test("Child RPC is atomic, idempotent, capped, rate limited and creates no PIN", () => {
  const sql = read("supabase/migrations/202608170002_product_family_child_registration.sql");
  assert.match(sql, /create table public\.product_child_creation_requests/i);
  assert.match(sql, /create function public\.create_product_family_child/i);
  assert.match(sql, /pg_advisory_xact_lock/i);
  assert.match(sql, /IDEMPOTENCY_CONFLICT/);
  assert.match(sql, /CHILD_CREATION_RATE_LIMITED/);
  assert.match(sql, /FAMILY_MEMBER_LIMIT_REACHED/);
  assert.match(sql, /role[\s\S]*'child'/i);
  assert.match(sql, /pin_hash[\s\S]*null/i);
  assert.match(sql, /is_active[\s\S]*true/i);
});

test("Child response is a safe DTO and database errors are mapped", () => {
  const source = read("server/api/family/children.js");
  for (const code of ["IDEMPOTENCY_CONFLICT", "CHILD_CREATION_RATE_LIMITED", "FAMILY_MEMBER_LIMIT_REACHED"]) assert.match(source, new RegExp(code));
  assert.match(source, /onboardingState:\s*["']LEARNING_SETUP_OPTIONAL["']/);
  assert.doesNotMatch(source, /child:\s*\{[\s\S]{0,400}(?:family_id|member_key|pin_hash|failed_attempts|locked_until)/);
});

test("Child form has no PIN, role, active or Family ownership controls", () => {
  const html = read("index.html");
  assert.match(html, /id="onboardingChildForm"/);
  assert.match(html, /id="onboardingChildName"/);
  assert.match(html, /name="avatarEmoji"[\s\S]*type="radio"|type="radio"[\s\S]*name="avatarEmoji"/);
  const form = html.match(/<form id="onboardingChildForm"[\s\S]*?<\/form>/)?.[0] || "";
  assert.doesNotMatch(form, /name="(?:pin|familyId|family_id|role|isActive|is_active)"/i);
});

test("Child UI prevents duplicate submission, retains request ID and refreshes canonical members", () => {
  const source = read("js/onboarding.js");
  const family = read("js/family-chat.js");
  assert.match(source, /if\s*\(childSubmitting\)\s*return/);
  assert.match(source, /clientRequestId/);
  assert.match(source, /\/api\/family\/children/);
  assert.match(source, /aria-busy/);
  assert.match(family, /refreshMembers/);
  assert.match(source, /LEARNING_SETUP_OPTIONAL/);
});

test("Child registration exposes safe mobile and accessible interaction", () => {
  const html = read("index.html");
  const css = read("css/styles.css");
  assert.match(html, /onboardingChildError[\s\S]*role="alert"/);
  assert.match(html, /fieldset[\s\S]*legend/);
  assert.match(css, /onboarding-avatar-option/);
  assert.match(css, /min-height:\s*44px/);
});

test("Legacy member management exposes PIN changes only for Parent rows", () => {
  const source = read("js/family-chat.js");
  assert.match(source, /if\s*\(m\.role===?["']parent["']\)[\s\S]{0,500}PIN 변경/);
  assert.match(source, /loginChild[\s\S]*child-login/);
});

test("Migration ships matching verification and rollback contracts", () => {
  const verify = read("supabase/verification/202608170002_product_family_child_registration_verify.sql");
  const rollback = read("supabase/rollback/202608170002_product_family_child_registration_rollback.sql");
  assert.match(verify, /product_child_creation_requests/);
  assert.match(verify, /create_product_family_child/);
  assert.match(verify, /pin_hash/i);
  assert.match(rollback, /drop function/i);
  assert.match(rollback, /drop table/i);
});
