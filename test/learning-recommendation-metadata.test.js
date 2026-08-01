const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  generateMigration,
  generateRollback,
  generateVerification,
} = require("../scripts/generate-learning-content-migration");
const { validateLearningContent } = require("../scripts/validate-learning-content");
const { recommendationFixture } = require("./fixtures/learning-recommendation-content");

const root = path.join(__dirname, "..");

test("recommendation SQL is deterministic, additive, exact, and conflict-safe", () => {
  const content = recommendationFixture();
  assert.deepEqual(validateLearningContent(content), { valid: true, errors: [] });
  const first = [generateMigration(content), generateVerification(content), generateRollback(content)];
  const second = [generateMigration(structuredClone(content)), generateVerification(structuredClone(content)), generateRollback(structuredClone(content))];
  assert.deepEqual(first, second);

  const [migration, verification, rollback] = first;
  assert.doesNotMatch(migration, /insert into public\.learning_courses/i);
  assert.match(migration, /insert into public\.learning_unit_recommendation_metadata/);
  assert.match(migration, /recommended_start_level_code[\s\S]*recommended_end_level_code[\s\S]*parent_sort_order/);
  assert.match(migration, /where not exists[\s\S]*learning_unit_recommendation_metadata/);
  assert.match(migration, /errcode = '23505'[\s\S]*recommendation metadata conflicts/);
  assert.doesNotMatch(migration, /on conflict[\s\S]*do update/i);
  assert.doesNotMatch(migration, /(?:insert|update|delete)\s+(?:into\s+|from\s+)?public\.(?:learning_assignments|learning_attempts|learning_attempt_answers|learning_stage_progress|learning_stage_first_passes|sticker_transactions)/i);
  assert.doesNotMatch(migration, /alter table|create policy|grant |revoke |publication/i);

  assert.match(verification, /learning_recommendation_metadata_exact/);
  assert.match(verification, /learning_recommendation_latest_published_unit_once/);
  assert.match(verification, /learning_recommendation_profile_classification/);
  assert.match(verification, /grade2_recommendation_fixture_v1_question_weights_exact/);
  assert.match(verification, /grade2_recommendation_fixture_v1_pass_threshold_contract/);
  assert.match(verification, /grade2_recommendation_fixture_v1_make_ten_unit_sort_order_preserved/);
  assert.match(verification, /grade2_recommendation_fixture_v1_course_unit_sort_orders_unique/);
  assert.match(verification, /elementary_2/);
  assert.match(verification, /'ready'/);

  assert.match(rollback, /errcode = '55000'/);
  assert.match(rollback, /recommendation metadata is missing or changed/);
  assert.match(rollback, /delete from public\.learning_unit_recommendation_metadata/);
  assert.doesNotMatch(rollback, /delete from public\.learning_courses/);
  for (const artifact of [migration, rollback]) assert.doesNotMatch(artifact, /make[_ -]ten/i);
  assert.ok(rollback.indexOf("delete from public.learning_unit_recommendation_metadata") < rollback.indexOf("delete from public.learning_question_options"));
});

test("legacy Make Ten v1 and v2 SQL artifacts remain byte-identical", () => {
  const cases = [
    ["v1", "202607310002", "seed_make_ten_learning_content"],
    ["v2", "202607310003", "seed_make_ten_v2_learning_content"],
  ];
  for (const [version, migrationNumber, basename] of cases) {
    const content = JSON.parse(fs.readFileSync(path.join(root, `content/learning/math/make-ten-${version}.json`), "utf8"));
    const artifacts = [
      ["migrations", `${migrationNumber}_${basename}.sql`, generateMigration(content)],
      ["verification", `${migrationNumber}_${basename}_verify.sql`, generateVerification(content)],
      ["rollbacks", `${migrationNumber}_rollback_${basename.replace(/^seed_/, "")}.sql`, generateRollback(content)],
    ];
    for (const [directory, filename, generated] of artifacts) {
      const stored = fs.readFileSync(path.join(root, "supabase", directory, filename), "utf8");
      assert.equal(generated, stored, `${version} ${directory} changed`);
      assert.equal(
        crypto.createHash("sha256").update(generated).digest("hex"),
        crypto.createHash("sha256").update(stored).digest("hex"),
      );
    }
  }
});

test("recommendation internals remain server-only and child assignment or attempt responses do not expose them", () => {
  const catalog = fs.readFileSync(path.join(root, "server/api/learning/catalog.js"), "utf8");
  assert.match(catalog, /recommendationOrder[\s\S]*\.\.\.item/);
  for (const relative of [
    "server/api/learning/assignments.js",
    "server/api/learning/attempts/_shared.js",
    "server/api/learning/attempts/[attemptId].js",
  ]) {
    const source = fs.readFileSync(path.join(root, relative), "utf8");
    assert.doesNotMatch(source, /recommended_start_level_code|recommended_end_level_code|parent_sort_order|elementary_[1-6]/i);
  }
});
