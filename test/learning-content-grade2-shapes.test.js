const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { parseCsv } = require("../scripts/learning-content-csv");
const { QUESTION_HEADERS, UNIT_HEADERS } = require("../scripts/generate-learning-content-csv-template");
const { importUnit } = require("../scripts/import-learning-content-csv");
const { generateMigration, generateRollback, generateVerification } = require("../scripts/generate-learning-content-migration");
const { validateLearningContent } = require("../scripts/validate-learning-content");

const root = path.join(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const sha256 = (relative) => crypto.createHash("sha256").update(fs.readFileSync(path.join(root, relative))).digest("hex");
const curriculum = JSON.parse(read("content/learning/curriculum/math/grade-2-2022.json"));
const unitsPath = path.join(root, "content/learning/templates/grade2-math-units.csv");
const questionsPath = path.join(root, "content/learning/authored/grade2-shapes-v1.csv");
const definitionsPath = path.join(root, "content/learning/authored/grade2-shapes-skill-definitions-v1.csv");
const unitsRows = parseCsv(fs.readFileSync(unitsPath, "utf8"), UNIT_HEADERS, unitsPath);
const questionRows = parseCsv(fs.readFileSync(questionsPath, "utf8"), QUESTION_HEADERS, questionsPath);
const definitions = parseCsv(
  fs.readFileSync(definitionsPath, "utf8"),
  ["skill_code", "subject_code", "display_name", "description"],
  definitionsPath,
);
const content = JSON.parse(read("content/learning/math/grade2-shapes-v1.json"));
const migration = read("supabase/migrations/202608090002_seed_grade2_shapes_learning_content.sql");
const verification = read("supabase/verification/202608090002_seed_grade2_shapes_learning_content_verify.sql");
const rollback = read("supabase/rollbacks/202608090002_rollback_grade2_shapes_learning_content.sql");
const skillMigration = read("supabase/migrations/202608090001_add_grade2_shapes_skill_definitions.sql");

test("grade2 shapes authored CSV deterministically produces the canonical 4/40/160 content", () => {
  const imported = importUnit({ curriculum, unitsRows, questionRows, unitSlug: "grade2-shapes" });
  assert.deepEqual(imported, content);
  assert.deepEqual(validateLearningContent(content), { valid: true, errors: [] });
  assert.equal(content.unit.slug, "grade2-shapes");
  assert.equal(content.unit.displayOrder, 2);
  assert.deepEqual(content.stages.map((stage) => stage.difficulty), ["seed", "leaf", "tree", "crown"]);
  assert.deepEqual(content.stages.map((stage) => stage.questions.length), [10, 10, 10, 10]);
  assert.equal(content.stages.flatMap((stage) => stage.questions).length, 40);
  assert.equal(content.stages.flatMap((stage) => stage.questions.flatMap((question) => question.options)).length, 160);
  assert.ok(questionRows.every((row) => row.review_status === "reviewed" && row.weight === "1" && row.skill_code));
});

test("grade2 shapes uses eight reviewed primary skill units without taxonomy drift", () => {
  const contentSkills = new Set(content.stages.flatMap((stage) => stage.questions.map((question) => question.skillCode)));
  const authoredSkills = new Set(questionRows.map((row) => row.skill_code));
  assert.equal(definitions.length, 8);
  assert.equal(new Set(definitions.map((row) => row.skill_code)).size, 8);
  assert.deepEqual(contentSkills, authoredSkills);
  assert.deepEqual(contentSkills, new Set(definitions.map((row) => row.skill_code)));
  assert.ok(definitions.every((definition) => definition.subject_code === "math" && definition.display_name && definition.description));
  for (const definition of definitions) {
    assert.match(skillMigration, new RegExp(`'${definition.skill_code}', 'math'`));
  }
});

test("answer positions are balanced overall and inside every difficulty", () => {
  const distributions = content.stages.map((stage) => [1, 2, 3, 4].map((position) => (
    stage.questions.filter((question) => question.options.find((option) => option.isCorrect).displayOrder === position).length
  )));
  assert.deepEqual(distributions, [[3, 3, 2, 2], [2, 2, 3, 3], [3, 3, 2, 2], [2, 2, 3, 3]]);
  assert.deepEqual([1, 2, 3, 4].map((position) => content.stages.flatMap((stage) => stage.questions)
    .filter((question) => question.options.find((option) => option.isCorrect).displayOrder === position).length), [10, 10, 10, 10]);
  assert.equal(new Set(questionRows.map((row) => row.question_text)).size, 40);
});

test("crown questions cover inference error correction and composition with exact answers", () => {
  const expected = [
    ["세모 모양", "infer-shape-from-properties"],
    ["동그라미 모양", "infer-shape-from-properties"],
    ["뾰족한 곳이 0개입니다.", "correct-shape-reasoning"],
    ["평평한 네모 모양의 면들이 있습니다.", "correct-shape-reasoning"],
    ["잘못 들어간 모양이 없습니다.", "correct-shape-reasoning"],
    ["크기가 달라도 곧은 선 3개이면 세모 모양입니다.", "correct-shape-reasoning"],
    ["작은 모양을 합쳐 새로운 모양을 만들었습니다.", "compose-decompose-shapes"],
    ["평평한 면으로 세우면 쌓을 수 있습니다.", "correct-shape-reasoning"],
    ["가는 세모 모양이고 나는 네모 모양", "infer-shape-from-properties"],
    ["공 모양", "infer-shape-from-properties"],
  ];
  const crown = content.stages.find((stage) => stage.difficulty === "crown").questions;
  assert.equal(crown.length, expected.length);
  for (const [index, [answer, skillCode]] of expected.entries()) {
    const question = crown[index];
    assert.equal(question.options.find((option) => option.isCorrect).text, answer);
    assert.equal(question.skillCode, skillCode);
    assert.ok(question.explanation.length >= 15);
  }
});

test("stored content SQL artifacts exactly match the existing deterministic generator", () => {
  assert.equal(generateMigration(content), migration);
  assert.equal(generateVerification(content), verification);
  assert.equal(generateRollback(content), rollback);
  assert.match(migration, /Content-only and additive/);
  assert.match(migration, /insert into public\.learning_question_skills/);
  assert.match(verification, /grade2_shapes_v1_question_skills_exact/);
  assert.match(rollback, /delete from public\.learning_question_skills/);
  for (const sql of [skillMigration, migration]) {
    assert.doesNotMatch(sql, /(?:insert into|update|delete from) public\.(?:learning_attempts|learning_attempt_answers|learning_stage_progress|learning_stage_first_passes|sticker_transactions|learning_mistake_review_answers)/i);
  }
});

test("existing published content and rollout identities remain byte-identical", () => {
  assert.deepEqual({
    makeTenV1: sha256("content/learning/math/make-ten-v1.json"),
    makeTenV2: sha256("content/learning/math/make-ten-v2.json"),
    threeDigitV1: sha256("content/learning/math/grade2-three-digit-numbers-v1.json"),
    makeTenV1Migration: sha256("supabase/migrations/202607310002_seed_make_ten_learning_content.sql"),
    makeTenV2Migration: sha256("supabase/migrations/202607310003_seed_make_ten_v2_learning_content.sql"),
    threeDigitV1Migration: sha256("supabase/migrations/202607310005_seed_grade2_three_digit_numbers_learning_content.sql"),
    skillRolloutMigration: sha256("supabase/migrations/202608080005_rollout_current_content_skill_mappings.sql"),
  }, {
    makeTenV1: "3d2342b963ec5f26fc159c766b866858f7d230cb90bc60c9b577bb47aa1ccbc3",
    makeTenV2: "d640d6246a137cf08f43e29cb0b3d0e2ef3b27fb7ce917c356e7ea7959f4b91a",
    threeDigitV1: "b527cbe047b4716691c3e08be1414bd956793394c74995cca7b4c1ebe0b17fbb",
    makeTenV1Migration: "bdd851c6fab011a9ef16cacd64ba767541d8b0a2cbf138f91acbbddf4a86030e",
    makeTenV2Migration: "3d5eaed8818e5e9941106492d50b27c25867b8a9031626764e5c12d3a57be3cc",
    threeDigitV1Migration: "7b6cb9d000ca6c2b21fc6831c16ad952027a9a05a56139e082b12f2dd019d6b3",
    skillRolloutMigration: "8ede9db7bfedb53325406766aa85168500542147179f4adaa7c2a46c69cb67e6",
  });
});
