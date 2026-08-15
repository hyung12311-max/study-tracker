"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { TABLES, assertSchemaResult, buildCollectorSql, buildSchemaValidationSql, definitionFor, digestFixtureRows, validateDefinitions } = require("../scripts/phase1-batch6-real-baseline-collector.js");

test("real baseline has 38 explicit schema-stable metrics", () => {
  assert.equal(TABLES.length, 38);
  assert.equal(new Set(TABLES.map(({ table }) => table)).size, 38);
  assert.equal(validateDefinitions(), true);
  assert.doesNotMatch(buildCollectorSql(), /to_jsonb\s*\(\s*x\s*\)/i);
  assert.match(buildCollectorSql(), /jsonb_build_array/);
});

test("collector schema preflight checks every configured column and primary ordering key", () => {
  const sql = buildSchemaValidationSql();
  assert.match(sql, /information_schema\.columns/);
  assert.match(sql, /pg_catalog\.pg_index/);
  assert.match(sql, /missingColumns/);
  assert.match(sql, /unstableOrderTables/);
  assert.equal(assertSchemaResult({ valid: true, configuredMetrics: 38, missingColumns: [], unstableOrderTables: [] }), true);
  assert.throws(
    () => assertSchemaResult({ valid: false, configuredMetrics: 38, missingColumns: [["reward_products", "available_from"]], unstableOrderTables: [] }),
    (error) => error.code === "BASELINE_SCHEMA_MISMATCH"
  );
});

test("added nullable column outside the business map leaves digest unchanged", () => {
  const definition = definitionFor("families");
  const before = [{ id: "a", family_key: "real-a", display_name: "A", chat_notifications_enabled: true, system_notifications_enabled: false }];
  assert.equal(digestFixtureRows(definition, before), digestFixtureRows(definition, [{ ...before[0], harmless_schema_column: null }]));
});

test("business value change changes digest", () => {
  const definition = definitionFor("families");
  const before = [{ id: "a", family_key: "real-a", display_name: "A", chat_notifications_enabled: true, system_notifications_enabled: false }];
  assert.notEqual(digestFixtureRows(definition, before), digestFixtureRows(definition, [{ ...before[0], display_name: "Changed" }]));
});

test("reward availability change changes post-migration canonical digest", () => {
  const definition = definitionFor("reward_products");
  const before = [{ id: "p", family_id: "f", name: "Reward", category: "gift", sticker_cost: 1, stock: 2, sort_order: 0, emoji: "gift", description: null, image_url: null, is_active: true, available_from: null, available_until: null }];
  assert.notEqual(digestFixtureRows(definition, before), digestFixtureRows(definition, [{ ...before[0], available_from: "2026-08-16T00:00:00+09:00" }]));
});

test("sensitive and mutable session field changes leave digest unchanged", () => {
  const definition = definitionFor("family_device_sessions");
  const before = [{ id: "s", family_id: "f", member_id: "m", member_key: "parent", is_active: true, revoked_at: null, revoked_reason: null, token_hash: "old", user_agent: "old", last_used_at: "2026-08-16T00:00:00Z" }];
  assert.equal(digestFixtureRows(definition, before), digestFixtureRows(definition, [{ ...before[0], token_hash: "new", user_agent: "new", last_used_at: "2026-08-16T01:00:00Z" }]));
});

test("sensitive column families are absent from emitted SQL", () => {
  const sql = buildCollectorSql();
  assert.doesNotMatch(sql, /pin_hash|token_hash|session_token|access_token|refresh_token|p256dh|user_agent/);
  assert.doesNotMatch(sql, /x\."endpoint"|x\."auth"/);
});

test("timestamps are normalized to UTC and JSON or arrays remain canonical JSONB values", () => {
  const sql = buildCollectorSql();
  assert.match(sql, /at time zone 'UTC'/);
  assert.match(sql, /to_jsonb\(x\."metadata"\)/);
  assert.match(sql, /to_jsonb\(x\."study_weekdays"\)/);
});
