const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");
const migration = read("supabase", "migrations", "202608140001_phase_0a_bootstrap_closure.sql");
const rollback = read("supabase", "rollbacks", "202608140001_rollback_phase_0a_bootstrap_closure.sql");
const verification = read("supabase", "verification", "202608140001_phase_0a_bootstrap_closure_verify.sql");
const fixture = read("test", "fixtures", "phase0a_bootstrap_closure_fixture.sql");
const app = read("js", "app.js");
const members = read("server", "api", "family", "members.js");
const messages = read("server", "api", "family", "messages.js");

test("Phase 0A SQL closes legacy browser access and creates family-scoped primitives", () => {
  assert.match(migration, /create table public\.family_reward_settings/i);
  assert.match(migration, /verify_family_parent_pin[\s\S]*p_family_id uuid[\s\S]*p_member_id uuid/i);
  assert.match(migration, /alter table public\.reward_settings force row level security/i);
  assert.match(migration, /alter table public\.sticker_history force row level security/i);
  assert.match(migration, /revoke all on table public\.reward_settings from public, anon, authenticated/i);
  assert.match(migration, /unique \(family_id, client_message_id\)/i);
  assert.match(verification, /begin transaction read only/i);
  assert.match(verification, /has_table_privilege\('anon'/i);
});

test("rollback is guarded against data loss and invalid uniqueness restoration", () => {
  assert.match(rollback, /family_reward_settings contains data/i);
  assert.match(rollback, /having count\(\*\) > 1/i);
  assert.match(fixture, /cross-family parent PIN lookup succeeded/i);
  assert.match(fixture, /rollback duplicate-message guard was not exercised/i);
  assert.match(fixture, /\\ir \.\.\/\.\.\/supabase\/rollbacks/i);
});

test("browser code no longer queries global reward settings and member results stay minimal", () => {
  assert.doesNotMatch(app, /client\.from\("reward_settings"\)/);
  assert.doesNotMatch(app, /table:\s*"(?:reward_settings|sticker_history)"/);
  assert.match(app, /\/api\/rewards\/settings/);
  assert.doesNotMatch(members, /select=id,family_id,member_key,display_name/);
  assert.match(messages, /family_id=eq\.\$\{encodeURIComponent\(context\.familyId\)\}&client_message_id/);
});
