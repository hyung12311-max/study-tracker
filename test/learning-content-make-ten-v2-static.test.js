const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { loadAndValidate } = require("../scripts/validate-learning-content");
const { generateMigration, generateRollback, generateVerification } = require("../scripts/generate-learning-content-migration");

const root = path.join(__dirname, "..");
const v1 = loadAndValidate(path.join(root, "content/learning/math/make-ten-v1.json"));
const v2 = loadAndValidate(path.join(root, "content/learning/math/make-ten-v2.json"));
const migration = fs.readFileSync(path.join(root, "supabase/migrations/202607310003_seed_make_ten_v2_learning_content.sql"), "utf8");
const verification = fs.readFileSync(path.join(root, "supabase/verification/202607310003_seed_make_ten_v2_learning_content_verify.sql"), "utf8");
const rollback = fs.readFileSync(path.join(root, "supabase/rollbacks/202607310003_rollback_make_ten_v2_learning_content.sql"), "utf8");
const sha = (value) => crypto.createHash("sha256").update(value, "utf8").digest("hex");

test("v1 artifacts remain byte-identical while v2 output is deterministic", () => {
  assert.equal(fs.readFileSync(path.join(root, "supabase/migrations/202607310002_seed_make_ten_learning_content.sql"), "utf8"), generateMigration(v1));
  assert.equal(fs.readFileSync(path.join(root, "supabase/verification/202607310002_seed_make_ten_learning_content_verify.sql"), "utf8"), generateVerification(v1));
  assert.equal(fs.readFileSync(path.join(root, "supabase/rollbacks/202607310002_rollback_make_ten_learning_content.sql"), "utf8"), generateRollback(v1));
  assert.equal(migration, generateMigration(v2));
  assert.equal(verification, generateVerification(v2));
  assert.equal(rollback, generateRollback(v2));
  assert.equal(sha(generateMigration(v2)), sha(generateMigration(structuredClone(v2))));
});

test("v2 reuses the logical unit and adds only a new published content version", () => {
  assert.equal(v2.course.id, v1.course.id);
  assert.equal(v2.unit.id, v1.unit.id);
  assert.notEqual(v2.version.id, v1.version.id);
  assert.equal(v2.version.number, 2);
  assert.equal((migration.match(/insert into public\.learning_courses/gi) || []).length, 0);
  assert.equal((migration.match(/insert into public\.learning_units/gi) || []).length, 0);
  assert.equal((migration.match(/insert into public\.learning_content_versions/gi) || []).length, 1);
  assert.match(migration, /publish_learning_content_version\('61000000-0000-4000-8000-000000000003'::uuid\)/i);
  assert.doesNotMatch(migration, /\b(update|delete)\s+(public\.)?(learning_courses|learning_units|learning_content_versions)/i);
  assert.doesNotMatch(migration, /\b(learning_assignments|learning_attempts|learning_stage_progress|learning_stage_first_passes|sticker_transactions)\b[\s\S]*\b(insert|update|delete)\b/i);
});

test("v2 has exact 4/40/160 structure with fresh fixed identifiers", () => {
  assert.deepEqual(v2.stages.map((stage) => stage.difficulty), ["seed", "leaf", "tree", "crown"]);
  assert.deepEqual(v2.stages.map((stage) => stage.questions.length), [10, 10, 10, 10]);
  assert.equal(v2.stages.flatMap((stage) => stage.questions).length, 40);
  assert.equal(v2.stages.flatMap((stage) => stage.questions.flatMap((question) => question.options)).length, 160);
  const v1Ids = new Set([v1.version.id, ...v1.stages.flatMap((stage) => [stage.id, ...stage.questions.flatMap((question) => [question.id, ...question.options.map((option) => option.id)])])]);
  const v2Ids = [v2.version.id, ...v2.stages.flatMap((stage) => [stage.id, ...stage.questions.flatMap((question) => [question.id, ...question.options.map((option) => option.id)])])];
  assert.equal(v2Ids.length, 205);
  assert.equal(v2Ids.some((id) => v1Ids.has(id)), false);
  for (const stage of v2.stages) for (const question of stage.questions) {
    assert.equal(question.options.length, 4);
    assert.equal(question.options.filter((option) => option.isCorrect).length, 1);
  }
});

test("verification covers v1 preservation, latest v2, empty learning rows, and 8/10 snapshot", () => {
  assert.match(verification, /make_ten_v1_preserved/i);
  assert.match(verification, /make_ten_latest_published_is_v2/i);
  assert.match(verification, /make_ten_v1_assignment_references_preserved/i);
  assert.match(verification, /question_count = 10/i);
  assert.match(verification, /learning_attempts/i);
  assert.match(verification, /learning_stage_first_passes/i);
  assert.match(verification, /learning_content_not_in_realtime_publication/i);
  assert.match(verification, /begin transaction read only/i);
  assert.match(verification, /rollback;\s*$/i);
});

test("rollback removes only unused v2 and blocks once assignment or history exists", () => {
  assert.match(rollback, /errcode = '55000'/i);
  assert.match(rollback, /learning_assignments[\s\S]*learning_attempts[\s\S]*learning_stage_first_passes/i);
  assert.match(rollback, /61000000-0000-4000-8000-000000000003/i);
  assert.doesNotMatch(rollback, /delete from public\.learning_units|delete from public\.learning_courses/i);
  assert.match(rollback, /commit;\s*$/i);
});

test("all forty questions are concise, unique within stage, and answer/explanation aligned", () => {
  for (const stage of v2.stages) {
    assert.equal(new Set(stage.questions.map((question) => question.prompt)).size, 10);
    for (const question of stage.questions) {
      assert.ok(question.prompt.length <= 55);
      assert.equal(new Set(question.options.map((option) => option.text)).size, 4);
      const answerNumbers = question.options.find((option) => option.isCorrect).text.match(/[0-9]+/g) || [];
      assert.ok(answerNumbers.every((number) => question.explanation.includes(number)));
      assert.doesNotMatch(`${question.prompt} ${question.explanation}`, /(아닌|틀린|학년|서열|version|버전)/i);
    }
  }
});
