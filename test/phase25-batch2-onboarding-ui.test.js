const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("NEW_VISITOR receives Welcome instead of the default Family directory", () => {
  const app = read("js/app.js");
  const family = read("js/family-chat.js");
  const context = read("server/api/family/context.js");
  assert.match(app, /showWelcome/);
  assert.match(family, /hasFamilyContext/);
  assert.match(family, /\/api\/family\/context/);
  assert.doesNotMatch(context, /allowLegacyDefault|family_key=eq\.default/);
});

test("Welcome and registration markup is mobile-first and accessible", () => {
  const html = read("index.html");
  const css = read("css/styles.css");
  for (const id of ["onboardingView", "createFamilyButton", "existingFamilyButton", "onboardingForm", "onboardingFamilyName", "onboardingParentName", "onboardingParentPin", "onboardingParentPinConfirm", "onboardingRememberDevice", "onboardingError", "onboardingChildRequired"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(html, /inputmode="numeric"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /role="alert"/);
  assert.match(css, /@media \(max-width: 480px\)[\s\S]*onboarding-card/);
  assert.match(css, /min-height:\s*44px/);
});

test("Onboarding module validates PIN, confirmation and weak values before fetch", async () => {
  const module = await import(`../js/onboarding.js?test=${Date.now()}`);
  const valid = module.validateRegistration({ familyDisplayName: "우리 가족", parentDisplayName: "엄마", parentPin: "7392", parentPinConfirm: "7392" });
  assert.equal(valid.ok, true);
  assert.equal(module.validateRegistration({ ...valid.value, parentPinConfirm: "7393" }).code, "PIN_CONFIRMATION_MISMATCH");
  assert.equal(module.validateRegistration({ ...valid.value, parentPin: "1234", parentPinConfirm: "1234" }).code, "WEAK_PARENT_PIN");
  assert.equal(module.validateRegistration({ ...valid.value, familyDisplayName: "" }).field, "familyDisplayName");
  assert.equal(module.validateRegistration({ ...valid.value, parentDisplayName: "" }).field, "parentDisplayName");
});

test("Request ID is retained for retry and reset only for an explicit changed attempt", async () => {
  const module = await import(`../js/onboarding.js?request=${Date.now()}`);
  let sequence = 0;
  const state = module.createRequestState(() => `${++sequence}`);
  const first = state.forPayload("same");
  assert.equal(state.forPayload("same"), first);
  assert.notEqual(state.forPayload("changed"), first);
});

test("Submit and auth handoff contracts prevent duplicate POST and avoid sensitive rendering", () => {
  const source = read("js/onboarding.js");
  const app = read("js/app.js");
  assert.match(source, /if \(submitting\) return/);
  assert.match(source, /POST/);
  assert.match(source, /onboardingRequestId/);
  assert.match(source, /rememberDevice/);
  assert.match(app, /acceptRegistration/);
  assert.match(source, /CHILD_REQUIRED/);
  assert.doesNotMatch(source, /localStorage\.setItem\([^\n]*(?:parentPin|token|cookie)/);
  assert.doesNotMatch(source, /textContent\s*=\s*(?:data\.)?(?:token|realtimeToken|family_id|member_key)/);
});

test("Safe errors cover validation, conflict, rate limit and response loss", async () => {
  const module = await import(`../js/onboarding.js?errors=${Date.now()}`);
  assert.match(module.onboardingErrorMessage("ONBOARDING_VALIDATION_FAILED"), /확인/);
  assert.match(module.onboardingErrorMessage("IDEMPOTENCY_CONFLICT"), /새 등록/);
  assert.match(module.onboardingErrorMessage("ONBOARDING_RATE_LIMITED"), /잠시/);
  assert.match(module.onboardingErrorMessage("NETWORK_ERROR"), /같은 정보/);
});

test("Existing Parent and Child bypass Welcome and Parent with no Child resumes CHILD_REQUIRED", () => {
  const app = read("js/app.js");
  assert.match(app, /isAuthenticated\(\)[\s\S]*enterAuthenticatedApp/);
  assert.match(app, /role\s*===\s*["']parent["']/);
  assert.match(app, /childCount\(\)\s*===\s*0/);
  assert.match(app, /showChildRequired/);
});
