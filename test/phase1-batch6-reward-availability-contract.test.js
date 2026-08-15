const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const migration = read("supabase/migrations/202608160001_reward_product_availability_contract.sql");
const rollback = read("supabase/rollbacks/202608160001_rollback_reward_product_availability_contract.sql");
const verification = read("supabase/verification/202608160001_reward_product_availability_contract_verify.sql");
const bootstrap = read("test/fixtures/phase1_batch5b_isolated_bootstrap.sql");
const fixture = read("test/fixtures/phase1_batch5b_reward_auth_expand_fixture.sql");
const exchange = read("server/api/rewards/exchange.js");

test("authoritative pre-migration fixture does not pre-create availability columns", () => {
  const rewardProductTable = bootstrap.match(/create table public\.reward_products\([\s\S]*?\n\);/i)?.[0] || "";
  assert.doesNotMatch(rewardProductTable, /available_from|available_until/);
  assert.match(fixture, /authoritative fixture must not pre-create availability columns/);
  assert.match(fixture, /202608160001_reward_product_availability_contract\.sql/);
});

test("migration adds nullable availability columns with an ordered-window constraint and no index", () => {
  assert.match(migration, /add column available_from timestamptz null/);
  assert.match(migration, /add column available_until timestamptz null/);
  assert.match(migration, /reward_products_availability_window_check[\s\S]*available_from <= available_until/);
  assert.doesNotMatch(migration, /create\s+(unique\s+)?index/i);
  assert.match(migration, /Reward availability columns already exist/);
  assert.match(migration, /Reward product base schema contract changed/);
  assert.match(migration, /Reward product constraint or index baseline changed/);
  assert.match(bootstrap, /reward_products_family_active_order_idx/);
});

test("migration keeps the v2 signature security and intended availability semantics", () => {
  assert.match(migration, /create or replace function public\.create_reward_exchange_request_v2\(/);
  assert.match(migration, /product\.available_from is not null and product\.available_from>now\(\)/);
  assert.match(migration, /product\.available_until is not null and product\.available_until<now\(\)/);
  assert.match(migration, /security definer[\s\S]*set search_path=pg_catalog, public/);
  assert.match(migration, /grant execute on function public\.create_reward_exchange_request_v2\(uuid,uuid,uuid,uuid,text\) to service_role/);
  assert.match(exchange, /available_from,available_until/);
});

test("verification is read-only and covers columns RPC ACL preservation and tenant integrity", () => {
  assert.match(verification, /^begin transaction read only;/);
  assert.match(verification, /Existing reward product availability changed/);
  assert.match(verification, /Reward availability RPC verification failed/);
  assert.match(verification, /Reward availability tenant verification failed/);
  assert.match(verification, /rollback;\s*$/);
  assert.doesNotMatch(verification, /^\s*(insert|update|delete|alter|create|drop|truncate)\b/im);
});

test("fixture covers positive negative window and preservation contracts", () => {
  for (const evidence of [
    "parent_exchange_pass", "child_exchange_pass", "insufficient balance exchange",
    "future availability exchange", "expired availability exchange", "window_exchange_pass",
    "null_window_exchange_pass", "cross-family product exchange",
    "existing reward product preservation failed", "invalid availability ordering",
  ]) assert.match(fixture, new RegExp(evidence));
});

test("rollback is explicit coordinated and refuses availability data loss", () => {
  assert.match(rollback, /reward_availability_rollback_approved/);
  assert.match(rollback, /rollback requires explicit coordinated approval/);
  assert.match(rollback, /rollback refused because availability data exists/);
  assert.match(rollback, /drop column available_from/);
  assert.match(rollback, /drop column available_until/);
  assert.match(rollback, /create or replace function public\.create_reward_exchange_request_v2/);
});
