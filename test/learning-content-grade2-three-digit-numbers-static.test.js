const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { parseCsv } = require("../scripts/learning-content-csv");
const { QUESTION_HEADERS } = require("../scripts/generate-learning-content-csv-template");
const { validateLearningContent } = require("../scripts/validate-learning-content");

const root = path.join(__dirname, "..");
const csvPath = path.join(root, "content/learning/authored/grade2-three-digit-numbers-v1.csv");
const jsonPath = path.join(root, "content/learning/math/grade2-three-digit-numbers-v1.json");
const content = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const rows = parseCsv(fs.readFileSync(csvPath, "utf8"), QUESTION_HEADERS, csvPath);
const artifacts = {
  migration: path.join(root, "supabase/migrations/202607310005_seed_grade2_three_digit_numbers_learning_content.sql"),
  verification: path.join(root, "supabase/verification/202607310005_seed_grade2_three_digit_numbers_learning_content_verify.sql"),
  rollback: path.join(root, "supabase/rollbacks/202607310005_rollback_grade2_three_digit_numbers_learning_content.sql"),
};
const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

test("three-digit-numbers v1 is reviewed deterministic 4/40/160 math-core content", () => {
  assert.deepEqual(validateLearningContent(content), { valid: true, errors: [] });
  assert.deepEqual(content.course, {
    id: "51000000-0000-4000-8000-000000000001",
    slug: "math-core",
    internalName: "수학 기초 과정",
    subject: "수학",
  });
  assert.equal(content.unit.slug, "grade2-three-digit-numbers");
  assert.deepEqual(content.stages.map((stage) => stage.difficulty), ["seed", "leaf", "tree", "crown"]);
  assert.deepEqual(content.stages.map((stage) => stage.questions.length), [10, 10, 10, 10]);
  assert.equal(content.stages.flatMap((stage) => stage.questions).length, 40);
  assert.equal(content.stages.flatMap((stage) => stage.questions.flatMap((question) => question.options)).length, 160);
  assert.ok(content.stages.flatMap((stage) => stage.questions).every((question) => question.weight === 1));
  assert.equal(rows.length, 40);
  assert.ok(rows.every((row) => row.review_status === "reviewed" && row.weight === "1"));
  assert.deepEqual([1, 2, 3, 4].map((position) => rows.filter((row) => row.correct_option === String(position)).length), [11, 10, 10, 9]);
  assert.equal(new Set(rows.map((row) => row.question_text)).size, 40);
});

test("approved crown wording and explanations are exact", () => {
  const expected = new Map([
    ["5", ["블록이 100개 묶음 5개와 10개 묶음 3개와 낱개 4개 있습니다. 블록은 모두 몇 개인가요?", "100개 묶음 5개는 500개이고 10개 묶음 3개는 30개이므로 낱개 4개와 합하면 534개입니다."]],
    ["7", ["스티커가 100장 묶음 4개와 10장 묶음 7개와 낱장 6장 있습니다. 모두 몇 장인가요?", "100장 묶음 4개는 400장이고 10장 묶음 7개는 70장이므로 낱장 6장과 합하면 476장입니다."]],
    ["8", ["구슬이 100개 묶음 8개와 낱개 4개 있고 10개 묶음은 없습니다. 구슬은 모두 몇 개인가요?", "100개 묶음 8개는 800개이고 10개 묶음은 없으므로 낱개 4개와 합하면 804개입니다."]],
  ]);
  for (const [order, [prompt, explanation]] of expected) {
    const row = rows.find((candidate) => candidate.stage === "crown" && candidate.question_order === order);
    assert.equal(row.question_text, prompt);
    assert.equal(row.explanation, explanation);
  }
});

test("generated SQL is content-only, course-reusing, generic, and deterministic", () => {
  assert.deepEqual({
    migration: sha256(artifacts.migration),
    verification: sha256(artifacts.verification),
    rollback: sha256(artifacts.rollback),
  }, {
    migration: "a6aa53ed4bb4a6b012e1f39acac421c166050824e769806b0c01d6e5c7c5c36c",
    verification: "536fdf29b7e07a8fc358f4d84532216ca0ead2d7d8e2596b33326533c49cbf1e",
    rollback: "0c1f126e9bd18c66b300f0173a59ca80ac119978c821e1ce0b915770d48f7c97",
  });
  const migration = fs.readFileSync(artifacts.migration, "utf8");
  const verification = fs.readFileSync(artifacts.verification, "utf8");
  const rollback = fs.readFileSync(artifacts.rollback, "utf8");
  assert.doesNotMatch(migration, /insert into public\.learning_courses/i);
  assert.match(migration, /existing course is missing or changed/);
  assert.match(verification, /question_weights_exact/);
  assert.match(verification, /pass_threshold_contract/);
  assert.match(rollback, /errcode = '55000'/);
  assert.doesNotMatch(rollback, /delete from public\.learning_courses/i);
  for (const sql of [migration, verification, rollback]) {
    assert.doesNotMatch(sql, /make[_ -]ten/i);
  }
  assert.doesNotMatch(migration, /math-grade2|9b0c7ad0-6cc9-470e-9214-0c97eba89ac4/);
  assert.doesNotMatch(rollback, /math-grade2|9b0c7ad0-6cc9-470e-9214-0c97eba89ac4/);
  assert.match(verification, /forbidden_course_absent/);
});
