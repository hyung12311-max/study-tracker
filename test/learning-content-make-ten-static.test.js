const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { loadAndValidate } = require("../scripts/validate-learning-content");
const {
  generateMigration,
  generateRollback,
  generateVerification,
} = require("../scripts/generate-learning-content-migration");

const root = path.join(__dirname, "..");
const contentPath = path.join(root, "content", "learning", "math", "make-ten-v1.json");
const migrationPath = path.join(root, "supabase", "migrations", "202607310002_seed_make_ten_learning_content.sql");
const verificationPath = path.join(root, "supabase", "verification", "202607310002_seed_make_ten_learning_content_verify.sql");
const rollbackPath = path.join(root, "supabase", "rollbacks", "202607310002_rollback_make_ten_learning_content.sql");
const content = loadAndValidate(contentPath);
const migration = fs.readFileSync(migrationPath, "utf8");
const verification = fs.readFileSync(verificationPath, "utf8");
const rollback = fs.readFileSync(rollbackPath, "utf8");
const sha = (value) => crypto.createHash("sha256").update(value, "utf8").digest("hex");

test("stored SQL artifacts exactly match deterministic generator output", () => {
  const first = generateMigration(content);
  const second = generateMigration(structuredClone(content));
  assert.equal(first, second);
  assert.equal(sha(first), sha(second));
  assert.equal(migration, first);
  assert.equal(verification, generateVerification(content));
  assert.equal(rollback, generateRollback(content));
});

test("migration creates only fixed pilot content and publishes through the approved function", () => {
  assert.match(migration, /^-- Generated[\s\S]*\bbegin;/i);
  assert.match(migration, /select \(public\.publish_learning_content_version\('51000000-0000-4000-8000-000000000003'::uuid\)\)\.id;/i);
  assert.match(migration, /\bcommit;\s*$/i);
  assert.equal((migration.match(/insert into public\.learning_courses/gi) || []).length, 1);
  assert.equal((migration.match(/insert into public\.learning_units/gi) || []).length, 1);
  assert.equal((migration.match(/insert into public\.learning_content_versions/gi) || []).length, 1);
  assert.match(migration, /make-ten course identifier already exists/i);
  assert.match(migration, /make-ten child content identifier already exists/i);
  assert.doesNotMatch(migration, /\b(now\(\)|current_timestamp|gen_random_uuid\(\)|random\(\))\b/i);
  assert.doesNotMatch(migration, /\b(insert|update|delete)\s+(into\s+|from\s+)?public\.(learning_assignments|learning_stage_progress|learning_attempts|learning_attempt_questions|learning_attempt_answers|learning_stage_first_passes|sticker_transactions)\b/i);
  assert.doesNotMatch(migration, /\b(alter publication|create policy|grant|revoke|alter table)\b/i);
});

test("content has the approved 4 by 5 by 4 structure and unambiguous answers", () => {
  assert.deepEqual(content.stages.map((stage) => stage.difficulty), ["seed", "leaf", "tree", "crown"]);
  for (const stage of content.stages) {
    assert.equal(stage.questions.length, 5);
    for (const question of stage.questions) {
      assert.equal(question.weight, 1);
      assert.equal(question.options.length, 4);
      assert.equal(question.options.filter((option) => option.isCorrect).length, 1);
      assert.equal(new Set(question.options.map((option) => option.text)).size, 4);
    }
  }
});

test("verification is read-only, exact, aggregate-only, and rolls back", () => {
  assert.match(verification, /^--[\s\S]*begin transaction read only;/i);
  assert.match(verification, /make_ten_course_exact/i);
  assert.match(verification, /make_ten_questions_exact/i);
  assert.match(verification, /make_ten_options_exact/i);
  assert.match(verification, /make_ten_no_user_learning_or_reward_rows/i);
  assert.match(verification, /learning_content_not_in_realtime_publication/i);
  assert.match(verification, /total_checks/i);
  assert.match(verification, /\brollback;\s*$/i);
  assert.doesNotMatch(verification, /^\s*(insert|update|delete|create|alter|drop|grant|revoke|truncate|call)\b/im);
});

test("rollback is pre-use only, dependency ordered, and transaction protected", () => {
  assert.match(rollback, /^--[\s\S]*\bbegin;/i);
  assert.match(rollback, /errcode = '55000'/i);
  assert.match(rollback, /learning_assignments[\s\S]*learning_attempts[\s\S]*learning_stage_first_passes/i);
  assert.match(rollback, /delete from public\.learning_question_options[\s\S]*delete from public\.learning_questions[\s\S]*delete from public\.learning_stages[\s\S]*delete from public\.learning_content_versions[\s\S]*delete from public\.learning_units[\s\S]*delete from public\.learning_courses/i);
  assert.match(rollback, /session_replication_role', 'replica', true/i);
  assert.match(rollback, /session_replication_role', 'origin', true/i);
  assert.match(rollback, /\bcommit;\s*$/i);
  assert.doesNotMatch(rollback, /\b(study_plans|book_plans|academy_schedules)\b/i);
});

test("child-facing text excludes curriculum and internal metadata", () => {
  const childText = [
    content.unit.title,
    ...content.stages.flatMap((stage) => [
      stage.title,
      ...stage.questions.flatMap((question) => [question.prompt, question.explanation, ...question.options.map((option) => option.text)]),
    ]),
  ].join("\n");
  assert.doesNotMatch(childText, /(학년|교육과정|커리큘럼|version|버전|uuid|관리자|내부용)/i);
  assert.equal(content.unit.title, "10을 만들어요");
});
