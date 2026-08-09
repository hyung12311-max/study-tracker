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
const questionsPath = path.join(root, "content/learning/authored/grade2-classification-v1.csv");
const definitionsPath = path.join(root, "content/learning/authored/grade2-classification-skill-definitions-v1.csv");
const unitsRows = parseCsv(fs.readFileSync(unitsPath, "utf8"), UNIT_HEADERS, unitsPath);
const questionRows = parseCsv(fs.readFileSync(questionsPath, "utf8"), QUESTION_HEADERS, questionsPath);
const definitions = parseCsv(fs.readFileSync(definitionsPath, "utf8"), ["skill_code", "subject_code", "display_name", "description"], definitionsPath);
const content = JSON.parse(read("content/learning/math/grade2-classification-v1.json"));
const migration = read("supabase/migrations/202608090008_seed_grade2_classification_learning_content.sql");
const verification = read("supabase/verification/202608090008_seed_grade2_classification_learning_content_verify.sql");
const rollback = read("supabase/rollbacks/202608090008_rollback_grade2_classification_learning_content.sql");
const skillMigration = read("supabase/migrations/202608090007_add_grade2_classification_skill_definitions.sql");
const skillVerification = read("supabase/verification/202608090007_add_grade2_classification_skill_definitions_verify.sql");
const skillRollback = read("supabase/rollbacks/202608090007_rollback_grade2_classification_skill_definitions.sql");
const questions = content.stages.flatMap((stage) => stage.questions);
const questionAt = (stage, order) => content.stages.find((item) => item.difficulty === stage).questions[order - 1];
const correctText = (question) => question.options.find((option) => option.isCorrect).text;

test("grade2 classification authored CSV deterministically produces canonical 4/40/160 content", () => {
  const imported = importUnit({ curriculum, unitsRows, questionRows, unitSlug: "grade2-classification" });
  assert.deepEqual(imported, content);
  assert.deepEqual(validateLearningContent(content), { valid: true, errors: [] });
  assert.equal(content.unit.slug, "grade2-classification");
  assert.equal(content.unit.displayOrder, 5);
  assert.deepEqual(content.stages.map((stage) => stage.difficulty), ["seed", "leaf", "tree", "crown"]);
  assert.deepEqual(content.stages.map((stage) => stage.questions.length), [10, 10, 10, 10]);
  assert.equal(questions.length, 40);
  assert.equal(questions.flatMap((question) => question.options).length, 160);
  assert.equal(new Set(questionRows.map((row) => row.question_text)).size, 40);
  assert.ok(questionRows.every((row) => row.review_status === "reviewed" && row.weight === "1" && row.skill_code));
});

test("eight minimal classification skills cover every question without overlapping prior taxonomy", () => {
  const expected = new Set([
    "identify-classification-rule", "classify-by-given-rule", "compare-classification-rules",
    "infer-rule-from-groups", "find-misclassified-item", "find-missing-classified-item",
    "classify-by-two-properties", "explain-classification-reasoning",
  ]);
  const priorCodes = new Set([...fs.readdirSync(path.join(root, "content/learning/authored"))
    .filter((name) => name.endsWith("skill-definitions-v1.csv") && !name.startsWith("grade2-classification"))
    .flatMap((name) => parseCsv(read(`content/learning/authored/${name}`), ["skill_code", "subject_code", "display_name", "description"], name))
    .map((row) => row.skill_code)]);
  assert.equal(definitions.length, 8);
  assert.deepEqual(new Set(definitions.map((row) => row.skill_code)), expected);
  assert.deepEqual(new Set(questions.map((question) => question.skillCode)), expected);
  assert.ok(definitions.every((row) => row.subject_code === "math" && row.display_name && row.description));
  assert.ok(definitions.every((row) => !priorCodes.has(row.skill_code)));
  for (const definition of definitions) assert.match(skillMigration, new RegExp(`'${definition.skill_code}', 'math'`));
});

test("answers are single, balanced, and explained by an explicit classification rule", () => {
  assert.deepEqual(content.stages.map((stage) => [1, 2, 3, 4].map((position) => stage.questions
    .filter((question) => question.options.find((option) => option.isCorrect).displayOrder === position).length)),
  [[3, 3, 2, 2], [2, 2, 3, 3], [3, 3, 2, 2], [2, 2, 3, 3]]);
  assert.deepEqual([1, 2, 3, 4].map((position) => questions
    .filter((question) => question.options.find((option) => option.isCorrect).displayOrder === position).length), [10, 10, 10, 10]);
  assert.ok(questions.every((question) => question.options.length === 4));
  assert.ok(questions.every((question) => question.options.filter((option) => option.isCorrect).length === 1));
  assert.ok(questions.every((question) => new Set(question.options.map((option) => option.text)).size === 4));
  assert.ok(questions.every((question) => question.explanation.trim().length >= 15));
  assert.ok(questions.every((question) => !/^정답입니다[.!]?$/.test(question.explanation.trim())));
  const explanationContracts = [
    ["seed", 1, /사과.*딸기.*수박.*과일/],
    ["leaf", 3, /1모둠.*짝수.*2모둠.*홀수/],
    ["tree", 2, /버스.*바퀴가 2개가 아니므로/],
    ["tree", 3, /배.*과일.*빠져/],
    ["tree", 4, /빨간 세모.*두 조건.*모두 만족/],
    ["crown", 6, /24.*짝수.*20보다 크므로.*두 조건/],
  ];
  for (const [stage, order, contract] of explanationContracts) {
    assert.match(questionAt(stage, order).explanation, contract);
  }
});

test("authored group contracts keep rule membership, missing items, and errors deterministic", () => {
  assert.deepEqual([
    correctText(questionAt("seed", 1)), correctText(questionAt("seed", 5)),
    correctText(questionAt("leaf", 3)), correctText(questionAt("leaf", 8)),
  ], ["과일", "짝수", "짝수와 홀수", "12, 20"]);
  assert.deepEqual([
    correctText(questionAt("tree", 2)), correctText(questionAt("tree", 3)),
    correctText(questionAt("tree", 6)), correctText(questionAt("tree", 7)),
    correctText(questionAt("tree", 10)),
  ], ["버스", "배", "축구공", "독수리", "18"]);
  assert.deepEqual([
    correctText(questionAt("tree", 4)), correctText(questionAt("tree", 5)),
    correctText(questionAt("tree", 8)), correctText(questionAt("crown", 6)),
    correctText(questionAt("crown", 9)),
  ], ["빨간 세모", "14", "파란 큰 공", "24, 짝수이고 20보다 크기 때문입니다.", "파란 작은 상자"]);
});

test("difficulty advances from direct grouping to rule choice and error analysis without tables or graphs", () => {
  const prompts = questions.map((question) => question.prompt);
  assert.ok(prompts.some((prompt) => /한 모둠/.test(prompt)));
  assert.ok(prompts.some((prompt) => /알맞은 기준/.test(prompt)));
  assert.ok(prompts.some((prompt) => /잘못 분류/.test(prompt)));
  assert.ok(prompts.some((prompt) => /빠진/.test(prompt)));
  assert.ok(prompts.some((prompt) => /이면서|이거나/.test(prompt)));
  assert.ok(prompts.some((prompt) => /이유/.test(prompt)));
  assert.doesNotMatch(JSON.stringify(content), /표에|그래프|막대그래프|꺾은선|원그래프|runtime AI|인공지능/);
});

test("stored artifacts match generators and preserve migration, verification, rollback, and engine boundaries", () => {
  assert.equal(generateMigration(content), migration);
  assert.equal(generateVerification(content), verification);
  assert.equal(generateRollback(content), rollback);
  assert.match(migration, /Content-only and additive/);
  assert.match(migration, /insert into public\.learning_question_skills/);
  assert.match(verification, /grade2_classification_v1_question_skills_exact/);
  assert.match(rollback, /rollback blocked: grade2_classification_v1 content has assignment or learning history/);
  assert.match(skillRollback, /skill_codes_snapshot && target_skill_codes/);
  assert.equal((skillVerification.match(/\), checks\(check_order, check_name, passed\) as \(/g) || []).length, 1);
  assert.equal((skillVerification.match(/from checks/g) || []).length, 2);
  assert.match(skillVerification, /'failed_checks', count\(\*\) filter \(where not passed\)/);
  for (const sql of [skillMigration, migration]) {
    assert.doesNotMatch(sql, /(?:insert into|update|delete from) public\.(?:learning_attempts|learning_attempt_answers|learning_stage_progress|learning_stage_first_passes|sticker_transactions|learning_mistake_review_answers)/i);
  }
});

test("all previously published content and migrations remain byte-identical", () => {
  const expected = {
    "content/learning/math/make-ten-v1.json": "3d2342b963ec5f26fc159c766b866858f7d230cb90bc60c9b577bb47aa1ccbc3",
    "content/learning/math/make-ten-v2.json": "d640d6246a137cf08f43e29cb0b3d0e2ef3b27fb7ce917c356e7ea7959f4b91a",
    "content/learning/math/grade2-three-digit-numbers-v1.json": "b527cbe047b4716691c3e08be1414bd956793394c74995cca7b4c1ebe0b17fbb",
    "content/learning/math/grade2-shapes-v1.json": "4c8027ad3dd180b28f70260317eb4f8ef59cfb789524289733749e419462aae1",
    "content/learning/math/grade2-addition-subtraction-v1.json": "70af1685be703597c121e223ec67ae05b46b9a205b96efe046cb25b4ce720d10",
    "content/learning/math/grade2-measuring-length-v1.json": "de5a5522ecdf2d0425f18cb05f5ee52a2b921cb96c78cffd33b22c8e82a651c9",
    "supabase/migrations/202607310002_seed_make_ten_learning_content.sql": "bdd851c6fab011a9ef16cacd64ba767541d8b0a2cbf138f91acbbddf4a86030e",
    "supabase/migrations/202607310003_seed_make_ten_v2_learning_content.sql": "3d5eaed8818e5e9941106492d50b27c25867b8a9031626764e5c12d3a57be3cc",
    "supabase/migrations/202607310005_seed_grade2_three_digit_numbers_learning_content.sql": "7b6cb9d000ca6c2b21fc6831c16ad952027a9a05a56139e082b12f2dd019d6b3",
    "supabase/migrations/202608080005_rollout_current_content_skill_mappings.sql": "8ede9db7bfedb53325406766aa85168500542147179f4adaa7c2a46c69cb67e6",
    "supabase/migrations/202608090001_add_grade2_shapes_skill_definitions.sql": "8219c038bc0671855fb60a14b7cba9f9cd316d6e3a8abb1937571a2e08c49563",
    "supabase/migrations/202608090002_seed_grade2_shapes_learning_content.sql": "bca325faf13b27b0f523a0ffd156b628d9a95e820b7661446b9fd97fe8b2435f",
    "supabase/migrations/202608090003_add_grade2_addition_subtraction_skill_definitions.sql": "987c7ea883df9eb4851118536f793301a9e40205e0769530d9792b58097e326d",
    "supabase/migrations/202608090004_seed_grade2_addition_subtraction_learning_content.sql": "0b6670854f20e4e989ee21a6547c60b03388ec4ae4027395117979eed858ac46",
    "supabase/migrations/202608090005_add_grade2_measuring_length_skill_definitions.sql": "65fc3d7319f255393c70d326796e378d6c7db1ed5ae599265a057463e8abc752",
    "supabase/migrations/202608090006_seed_grade2_measuring_length_learning_content.sql": "b71da8189b18b58526b4223b3f8ec840655ddd0808ae8500c4d1dfa67c943b15",
  };
  assert.deepEqual(Object.fromEntries(Object.keys(expected).map((file) => [file, sha256(file)])), expected);
});
