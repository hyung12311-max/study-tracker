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
const questionsPath = path.join(root, "content/learning/authored/grade2-measuring-length-v1.csv");
const definitionsPath = path.join(root, "content/learning/authored/grade2-measuring-length-skill-definitions-v1.csv");
const unitsRows = parseCsv(fs.readFileSync(unitsPath, "utf8"), UNIT_HEADERS, unitsPath);
const questionRows = parseCsv(fs.readFileSync(questionsPath, "utf8"), QUESTION_HEADERS, questionsPath);
const definitions = parseCsv(
  fs.readFileSync(definitionsPath, "utf8"),
  ["skill_code", "subject_code", "display_name", "description"],
  definitionsPath,
);
const content = JSON.parse(read("content/learning/math/grade2-measuring-length-v1.json"));
const migration = read("supabase/migrations/202608090006_seed_grade2_measuring_length_learning_content.sql");
const verification = read("supabase/verification/202608090006_seed_grade2_measuring_length_learning_content_verify.sql");
const rollback = read("supabase/rollbacks/202608090006_rollback_grade2_measuring_length_learning_content.sql");
const skillMigration = read("supabase/migrations/202608090005_add_grade2_measuring_length_skill_definitions.sql");
const skillVerification = read("supabase/verification/202608090005_add_grade2_measuring_length_skill_definitions_verify.sql");
const skillRollback = read("supabase/rollbacks/202608090005_rollback_grade2_measuring_length_skill_definitions.sql");
const questions = content.stages.flatMap((stage) => stage.questions);
const questionAt = (stage, order) => content.stages.find((item) => item.difficulty === stage).questions[order - 1];
const correctText = (question) => question.options.find((option) => option.isCorrect).text;

test("grade2 measuring length authored CSV deterministically produces canonical 4/40/160 content", () => {
  const imported = importUnit({ curriculum, unitsRows, questionRows, unitSlug: "grade2-measuring-length" });
  assert.deepEqual(imported, content);
  assert.deepEqual(validateLearningContent(content), { valid: true, errors: [] });
  assert.equal(content.unit.slug, "grade2-measuring-length");
  assert.equal(content.unit.displayOrder, 4);
  assert.deepEqual(content.stages.map((stage) => stage.difficulty), ["seed", "leaf", "tree", "crown"]);
  assert.deepEqual(content.stages.map((stage) => stage.questions.length), [10, 10, 10, 10]);
  assert.equal(questions.length, 40);
  assert.equal(questions.flatMap((question) => question.options).length, 160);
  assert.equal(new Set(questionRows.map((row) => row.question_text)).size, 40);
  assert.ok(questionRows.every((row) => row.review_status === "reviewed" && row.weight === "1" && row.skill_code));
});

test("eight minimal measurement skills cover every question without duplicating existing taxonomy", () => {
  const contentSkills = new Set(questions.map((question) => question.skillCode));
  const priorDefinitions = [
    ...parseCsv(read("content/learning/authored/math-skill-definitions-v1.csv"), ["skill_code", "subject_code", "display_name", "description"], "math skills"),
    ...parseCsv(read("content/learning/authored/grade2-shapes-skill-definitions-v1.csv"), ["skill_code", "subject_code", "display_name", "description"], "shape skills"),
    ...parseCsv(read("content/learning/authored/grade2-addition-subtraction-skill-definitions-v1.csv"), ["skill_code", "subject_code", "display_name", "description"], "operation skills"),
  ];
  assert.equal(definitions.length, 8);
  assert.equal(new Set(definitions.map((row) => row.skill_code)).size, 8);
  assert.deepEqual(contentSkills, new Set(definitions.map((row) => row.skill_code)));
  assert.ok(definitions.every((definition) => definition.subject_code === "math" && definition.display_name && definition.description));
  assert.ok(definitions.every((definition) => !priorDefinitions.some((prior) => prior.skill_code === definition.skill_code)));
  for (const definition of definitions) assert.match(skillMigration, new RegExp(`'${definition.skill_code}', 'math'`));
});

test("answers are balanced, unique, deterministic, and explained with measurement units", () => {
  const distributions = content.stages.map((stage) => [1, 2, 3, 4].map((position) => (
    stage.questions.filter((question) => question.options.find((option) => option.isCorrect).displayOrder === position).length
  )));
  assert.deepEqual(distributions, [[3, 3, 2, 2], [2, 2, 3, 3], [3, 3, 2, 2], [2, 2, 3, 3]]);
  assert.deepEqual([1, 2, 3, 4].map((position) => questions
    .filter((question) => question.options.find((option) => option.isCorrect).displayOrder === position).length), [10, 10, 10, 10]);
  assert.ok(questions.every((question) => question.options.length === 4));
  assert.ok(questions.every((question) => question.options.filter((option) => option.isCorrect).length === 1));
  assert.ok(questions.every((question) => new Set(question.options.map((option) => option.text)).size === 4));
  assert.ok(questions.every((question) => question.explanation.length >= 15));
  assert.ok(questions.every((question) => /cm|m|길이|눈금|자/.test(question.explanation)));
  assert.doesNotMatch(JSON.stringify(content), /runtime AI|인공지능|자동 채점/);
});

test("nonzero starts, inferred endpoints, comparisons, and units remain arithmetically exact", () => {
  const nonzeroCases = [
    ["leaf", 1, 2, 9, "7cm"], ["leaf", 2, 4, 11, "7cm"],
    ["tree", 1, 3, 14, "11cm"], ["tree", 2, 7, 16, "9cm"],
    ["tree", 7, 6, 15, "9cm"], ["crown", 9, 2, 10, "8cm"],
  ];
  for (const [stage, order, start, end, answer] of nonzeroCases) {
    const question = questionAt(stage, order);
    assert.equal(end - start, Number.parseInt(answer, 10));
    assert.equal(correctText(question), answer);
    assert.match(question.explanation, new RegExp(`${start}cm`));
    assert.match(question.explanation, new RegExp(`${end}cm`));
  }
  assert.deepEqual([
    correctText(questionAt("tree", 5)), correctText(questionAt("tree", 6)),
    correctText(questionAt("crown", 5)), correctText(questionAt("crown", 6)),
    correctText(questionAt("crown", 10)),
  ], ["5cm", "13cm", "14cm", "7cm", "16cm"]);
  assert.equal(correctText(questionAt("tree", 3)), "나 막대");
  assert.equal(correctText(questionAt("tree", 4)), "6cm인 다 막대");
  assert.equal(correctText(questionAt("tree", 9)), "빨간 막대가 1cm 더 깁니다.");
  assert.equal(correctText(questionAt("crown", 4)), "나 막대가 1cm 더 깁니다.");
  assert.deepEqual([
    correctText(questionAt("seed", 3)), correctText(questionAt("seed", 4)),
    correctText(questionAt("seed", 8)), correctText(questionAt("leaf", 10)),
  ], ["cm", "m", "m", "m"]);
});

test("the four stages progress from direct measurement to reasoning without a visual ruler dependency", () => {
  const prompts = questions.map((question) => question.prompt);
  assert.ok(prompts.some((prompt) => /0cm 눈금/.test(prompt)));
  assert.ok(prompts.some((prompt) => /알맞은 단위/.test(prompt)));
  assert.ok(prompts.some((prompt) => /가장 긴|더 긴/.test(prompt)));
  assert.ok(prompts.some((prompt) => /시작 눈금/.test(prompt)));
  assert.ok(prompts.some((prompt) => /부러진 자/.test(prompt)));
  assert.ok(prompts.some((prompt) => /바른 설명|올바르게|옳은 것/.test(prompt)));
  assert.ok(prompts.some((prompt) => /홀수|짝수/.test(prompt)));
  assert.doesNotMatch(JSON.stringify(content), /image|svg|canvas|좌표|그림을 보고/);
});

test("stored SQL artifacts match the generator and preserve verification, rollback, and engine boundaries", () => {
  assert.equal(generateMigration(content), migration);
  assert.equal(generateVerification(content), verification);
  assert.equal(generateRollback(content), rollback);
  assert.match(migration, /Content-only and additive/);
  assert.match(migration, /insert into public\.learning_question_skills/);
  assert.match(verification, /grade2_measuring_length_v1_question_skills_exact/);
  assert.match(rollback, /rollback blocked: grade2_measuring_length_v1 content has assignment or learning history/);
  assert.match(skillRollback, /skill_codes_snapshot && target_skill_codes/);
  assert.equal((skillVerification.match(/\), checks\(check_order, check_name, passed\) as \(/g) || []).length, 1);
  assert.equal((skillVerification.match(/from checks/g) || []).length, 2);
  assert.match(skillVerification, /'failed_checks', count\(\*\) filter \(where not passed\)/);
  for (const sql of [skillMigration, migration]) {
    assert.doesNotMatch(sql, /(?:insert into|update|delete from) public\.(?:learning_attempts|learning_attempt_answers|learning_stage_progress|learning_stage_first_passes|sticker_transactions|learning_mistake_review_answers)/i);
  }
});

test("all previously published content and migrations remain byte-identical", () => {
  assert.deepEqual({
    makeTenV1: sha256("content/learning/math/make-ten-v1.json"),
    makeTenV2: sha256("content/learning/math/make-ten-v2.json"),
    threeDigitV1: sha256("content/learning/math/grade2-three-digit-numbers-v1.json"),
    shapesV1: sha256("content/learning/math/grade2-shapes-v1.json"),
    additionV1: sha256("content/learning/math/grade2-addition-subtraction-v1.json"),
    makeTenV1Migration: sha256("supabase/migrations/202607310002_seed_make_ten_learning_content.sql"),
    makeTenV2Migration: sha256("supabase/migrations/202607310003_seed_make_ten_v2_learning_content.sql"),
    threeDigitV1Migration: sha256("supabase/migrations/202607310005_seed_grade2_three_digit_numbers_learning_content.sql"),
    skillRolloutMigration: sha256("supabase/migrations/202608080005_rollout_current_content_skill_mappings.sql"),
    shapesSkillMigration: sha256("supabase/migrations/202608090001_add_grade2_shapes_skill_definitions.sql"),
    shapesContentMigration: sha256("supabase/migrations/202608090002_seed_grade2_shapes_learning_content.sql"),
    additionSkillMigration: sha256("supabase/migrations/202608090003_add_grade2_addition_subtraction_skill_definitions.sql"),
    additionContentMigration: sha256("supabase/migrations/202608090004_seed_grade2_addition_subtraction_learning_content.sql"),
  }, {
    makeTenV1: "3d2342b963ec5f26fc159c766b866858f7d230cb90bc60c9b577bb47aa1ccbc3",
    makeTenV2: "d640d6246a137cf08f43e29cb0b3d0e2ef3b27fb7ce917c356e7ea7959f4b91a",
    threeDigitV1: "b527cbe047b4716691c3e08be1414bd956793394c74995cca7b4c1ebe0b17fbb",
    shapesV1: "4c8027ad3dd180b28f70260317eb4f8ef59cfb789524289733749e419462aae1",
    additionV1: "70af1685be703597c121e223ec67ae05b46b9a205b96efe046cb25b4ce720d10",
    makeTenV1Migration: "bdd851c6fab011a9ef16cacd64ba767541d8b0a2cbf138f91acbbddf4a86030e",
    makeTenV2Migration: "3d5eaed8818e5e9941106492d50b27c25867b8a9031626764e5c12d3a57be3cc",
    threeDigitV1Migration: "7b6cb9d000ca6c2b21fc6831c16ad952027a9a05a56139e082b12f2dd019d6b3",
    skillRolloutMigration: "8ede9db7bfedb53325406766aa85168500542147179f4adaa7c2a46c69cb67e6",
    shapesSkillMigration: "8219c038bc0671855fb60a14b7cba9f9cd316d6e3a8abb1937571a2e08c49563",
    shapesContentMigration: "bca325faf13b27b0f523a0ffd156b628d9a95e820b7661446b9fd97fe8b2435f",
    additionSkillMigration: "987c7ea883df9eb4851118536f793301a9e40205e0769530d9792b58097e326d",
    additionContentMigration: "0b6670854f20e4e989ee21a6547c60b03388ec4ae4027395117979eed858ac46",
  });
});
