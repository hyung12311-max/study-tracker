const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const migration = read("supabase/migrations/202608150001_core_composite_tenant_integrity.sql");
const rollback = read("supabase/rollbacks/202608150001_rollback_core_composite_tenant_integrity.sql");
const verification = read("supabase/verification/202608150001_core_composite_tenant_integrity_verify.sql");
const fixture = read("test/fixtures/phase1_batch5a_core_composite_integrity_fixture.sql");

test("Batch 5A derives all new tenant scope from trusted parent rows", () => {
  for (const fn of [
    "derive_family_message_read_scope", "derive_learning_plan_revision_scope",
    "derive_learning_review_item_scope", "derive_learning_review_event_scope",
  ]) assert.match(migration, new RegExp(`create function public\\.${fn}\\(\\)`));
  assert.match(migration, /select m\.family_id into strict new\.family_id/);
  assert.match(migration, /select p\.family_id into strict new\.family_id/);
  assert.match(migration, /new\.family_id:=s\.family_id/);
  for (const trigger of ["learning_assignment_plan_revisions_guard_change",
    "learning_mistake_review_items_immutable", "learning_mistake_review_events_immutable"]) {
    assert.match(migration, new RegExp(`disable trigger ${trigger}`));
    assert.match(migration, new RegExp(`enable trigger ${trigger}`));
  }
});

test("Batch 5A adds validated composite constraints across every requested domain", () => {
  for (const name of [
    "family_message_reads_message_scope_fk", "family_messages_sender_scope_fk",
    "learning_assignment_plan_revisions_actor_scope_fk",
    "learning_mistake_review_items_session_scope_fk", "learning_mistake_review_items_attempt_scope_fk",
    "learning_mistake_review_items_answer_chain_fk", "learning_mistake_review_events_actor_scope_fk",
    "reward_exchange_history_request_scope_fk", "reward_wishlist_product_scope_fk",
    "learning_stage_first_passes_reward_scope_fk", "family_push_subscriptions_member_scope_fk",
    "family_notification_preferences_member_scope_fk",
  ]) {
    assert.match(migration, new RegExp(`add constraint ${name} foreign key`));
    assert.match(migration, new RegExp(`'${name}'`));
    assert.match(verification, new RegExp(`'${name}'`));
  }
  assert.equal((migration.match(/ not valid;/g) || []).length, 22);
});

test("Batch 5A preserves lifecycle-specific delete actions", () => {
  assert.match(migration, /family_messages_sender_scope_fk[\s\S]*on delete set null \(sender_id\)/);
  assert.match(migration, /reward_exchange_requests_product_scope_fk[\s\S]*on delete set null \(product_id\)/);
  assert.match(migration, /learning_mistake_review_items_session_scope_fk[\s\S]*on delete restrict/);
  assert.match(migration, /family_message_reads_message_scope_fk[\s\S]*on delete cascade/);
  assert.match(migration, /learning_stage_first_passes_reward_scope_fk[\s\S]*deferrable initially deferred/);
});

test("verification is read-only and rollback is guarded against data loss", () => {
  assert.match(verification, /^begin transaction read only;/);
  assert.match(verification, /rollback;\s*$/);
  assert.doesNotMatch(verification, /^\s*(insert|update|delete|alter|create|drop|truncate)\b/im);
  assert.match(rollback, /errcode='55000'/);
  assert.match(rollback, /tenant-scoped business data exists/);
  assert.doesNotMatch(rollback, /drop table/i);
});

test("two-family fixture covers positive writers, preservation, and all cross-family rejects", () => {
  assert.match(fixture, /Same-family writers keep their old signatures/);
  assert.match(fixture, /existing data preservation failed/);
  for (const label of ["message read", "message sender", "planning revision actor", "review item attempt",
    "review event actor", "reward request member", "reward request product", "reward history request/member",
    "reward wishlist product", "sticker transaction member", "first-pass ledger", "push subscription member",
    "notification preference key"]) assert.match(fixture, new RegExp(`${label} cross-family`));
});
