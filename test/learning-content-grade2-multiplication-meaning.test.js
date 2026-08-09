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
const questionsPath = path.join(root, "content/learning/authored/grade2-multiplication-meaning-v1.csv");
const definitionsPath = path.join(root, "content/learning/authored/grade2-multiplication-meaning-skill-definitions-v1.csv");
const unitsRows = parseCsv(fs.readFileSync(unitsPath, "utf8"), UNIT_HEADERS, unitsPath);
const questionRows = parseCsv(fs.readFileSync(questionsPath, "utf8"), QUESTION_HEADERS, questionsPath);
const definitions = parseCsv(fs.readFileSync(definitionsPath, "utf8"), ["skill_code", "subject_code", "display_name", "description"], definitionsPath);
const content = JSON.parse(read("content/learning/math/grade2-multiplication-meaning-v1.json"));
const migration = read("supabase/migrations/202608090010_seed_grade2_multiplication_meaning_learning_content.sql");
const verification = read("supabase/verification/202608090010_seed_grade2_multiplication_meaning_learning_content_verify.sql");
const rollback = read("supabase/rollbacks/202608090010_rollback_grade2_multiplication_meaning_learning_content.sql");
const skillMigration = read("supabase/migrations/202608090009_add_grade2_multiplication_meaning_skill_definitions.sql");
const skillVerification = read("supabase/verification/202608090009_add_grade2_multiplication_meaning_skill_definitions_verify.sql");
const skillRollback = read("supabase/rollbacks/202608090009_rollback_grade2_multiplication_meaning_skill_definitions.sql");
const questions = content.stages.flatMap((stage) => stage.questions);
const questionAt = (stage, order) => content.stages.find((item) => item.difficulty === stage).questions[order - 1];
const correctText = (question) => question.options.find((option) => option.isCorrect).text;

test("grade2 multiplication meaning authored CSV produces canonical 4/40/160 content", () => {
  const imported = importUnit({ curriculum, unitsRows, questionRows, unitSlug: "grade2-multiplication-meaning" });
  assert.deepEqual(imported, content);
  assert.deepEqual(validateLearningContent(content), { valid: true, errors: [] });
  assert.equal(content.unit.slug, "grade2-multiplication-meaning");
  assert.equal(content.unit.displayOrder, 6);
  assert.deepEqual(content.stages.map((stage) => stage.questions.length), [10, 10, 10, 10]);
  assert.equal(questions.length, 40);
  assert.equal(questions.flatMap((question) => question.options).length, 160);
  assert.equal(new Set(questionRows.map((row) => row.question_text)).size, 40);
  assert.ok(questionRows.every((row) => row.review_status === "reviewed" && row.weight === "1" && row.skill_code));
});

test("eight minimal multiplication meaning skills cover all questions without prior taxonomy overlap", () => {
  const expected = new Set([
    "identify-equal-groups", "count-equal-groups", "connect-repeated-addition-to-multiplication",
    "represent-equal-groups-as-multiplication", "interpret-multiplication-expression",
    "model-multiplication-situation", "infer-missing-group-value", "correct-multiplication-reasoning",
  ]);
  const priorCodes = new Set(fs.readdirSync(path.join(root, "content/learning/authored"))
    .filter((name) => name.endsWith("skill-definitions-v1.csv") && !name.startsWith("grade2-multiplication-meaning"))
    .flatMap((name) => parseCsv(read(`content/learning/authored/${name}`), ["skill_code", "subject_code", "display_name", "description"], name))
    .map((row) => row.skill_code));
  assert.equal(definitions.length, 8);
  assert.deepEqual(new Set(definitions.map((row) => row.skill_code)), expected);
  assert.deepEqual(new Set(questions.map((question) => question.skillCode)), expected);
  assert.ok(definitions.every((row) => row.subject_code === "math" && row.display_name && row.description));
  assert.ok(definitions.every((row) => !priorCodes.has(row.skill_code)));
});

test("answers are single and follow the shared stage and total position distribution", () => {
  assert.deepEqual(content.stages.map((stage) => [1, 2, 3, 4].map((position) => stage.questions
    .filter((question) => question.options.find((option) => option.isCorrect).displayOrder === position).length)),
  [[3, 3, 2, 2], [2, 2, 3, 3], [3, 3, 2, 2], [2, 2, 3, 3]]);
  assert.deepEqual([1, 2, 3, 4].map((position) => questions
    .filter((question) => question.options.find((option) => option.isCorrect).displayOrder === position).length), [10, 10, 10, 10]);
  assert.ok(questions.every((question) => question.options.length === 4));
  assert.ok(questions.every((question) => question.options.filter((option) => option.isCorrect).length === 1));
  assert.ok(questions.every((question) => new Set(question.options.map((option) => option.text)).size === 4));
});

test("one multiplication direction is used: items per group times group count", () => {
  assert.equal(correctText(questionAt("leaf", 1)), "3×4");
  assert.equal(correctText(questionAt("leaf", 2)), "4×3");
  assert.equal(correctText(questionAt("leaf", 3)), "5×4");
  assert.equal(correctText(questionAt("leaf", 4)), "2씩 6묶음");
  assert.equal(correctText(questionAt("leaf", 6)), "상자 3개에 공이 6개씩 있음");
  assert.equal(correctText(questionAt("tree", 6)), "한 묶음의 수 4와 묶음 수 3의 순서를 바꾸어 썼기 때문에");
  assert.match(questionAt("crown", 2).explanation, /한 묶음.*3개.*상자 수 4.*3×4/);
});

test("equal-group arithmetic and missing values are deterministic", () => {
  const contracts = [
    ["seed", 3, "4+4+4"], ["seed", 8, "6+6"], ["tree", 2, "3개"],
    ["tree", 3, "5자루"], ["tree", 8, "3"], ["tree", 10, "3×5"],
    ["crown", 3, "4"], ["crown", 7, "6개, 6×4"],
  ];
  for (const [stage, order, answer] of contracts) assert.equal(correctText(questionAt(stage, order)), answer);
  assert.match(questionAt("tree", 2).explanation, /6\+6\+6=18/);
  assert.match(questionAt("tree", 3).explanation, /5\+5\+5\+5=20/);
  assert.match(questionAt("crown", 3).explanation, /5\+5\+5\+5=20/);
});

test("content covers the multiplication-meaning learning goals with varied contexts and reasoned explanations", () => {
  const serialized = JSON.stringify(content);
  assert.ok(questions.every((question) => question.explanation.trim().length >= 15));
  assert.ok(questions.every((question) => !/^정답입니다[.!]?$/.test(question.explanation.trim())));
  assert.doesNotMatch(serialized, /구구단|암기|몇 초|시간 안에|runtime AI|인공지능/);

  const minimumSkillCoverage = {
    "identify-equal-groups": 2,
    "count-equal-groups": 4,
    "connect-repeated-addition-to-multiplication": 8,
    "represent-equal-groups-as-multiplication": 2,
    "interpret-multiplication-expression": 5,
    "model-multiplication-situation": 5,
    "infer-missing-group-value": 6,
    "correct-multiplication-reasoning": 8,
  };
  for (const [skillCode, minimum] of Object.entries(minimumSkillCoverage)) {
    assert.ok(questions.filter((question) => question.skillCode === skillCode).length >= minimum, `${skillCode} coverage`);
  }

  const typeContracts = [
    ["seed", 1, /같은 수씩|3개씩/],
    ["leaf", 3, /5\+5\+5\+5/, /5×4/],
    ["leaf", 1, /3씩 4묶음/, /3×4/],
    ["leaf", 2, /접시.*4개씩.*3개/, /4×3/],
    ["leaf", 6, /6×3/, /상자 3개.*6개씩/],
    ["tree", 1, /한 줄.*4개씩 5줄/, /4×5/],
    ["tree", 2, /모두 18개.*6개씩/, /3개/],
    ["tree", 3, /모두 20자루.*4묶음/, /5자루/],
    ["tree", 8, /4×□=4\+4\+4/, /3/],
    ["tree", 6, /잘못된 까닭/, /순서를 바꾸어/],
    ["tree", 9, /같은 전체 수.*묶는 방법이 다른/, /3씩 4묶음/],
    ["crown", 1, /상황과 이유가 모두 알맞은/, /4를 3번 더하기/],
  ];
  for (const [stage, order, promptContract, answerContract] of typeContracts) {
    const question = questionAt(stage, order);
    assert.match(question.prompt, promptContract);
    if (answerContract) assert.match(correctText(question), answerContract);
  }

  const contextContracts = [
    /사탕|딸기|귤|쿠키|빵/,
    /연필|공책|의자|화분/,
    /접시|상자|봉지|바구니|쟁반/,
    /별|단추|구슬|공|컵/,
  ];
  for (const context of contextContracts) assert.ok(questions.some((question) => context.test(question.prompt)));
});

test("stored SQL artifacts match generators and preserve immutable engine boundaries", () => {
  assert.equal(generateMigration(content), migration);
  assert.equal(generateVerification(content), verification);
  assert.equal(generateRollback(content), rollback);
  assert.match(migration, /Content-only and additive/);
  assert.match(migration, /insert into public\.learning_question_skills/);
  assert.match(verification, /grade2_multiplication_meaning_v1_question_skills_exact/);
  assert.match(rollback, /rollback blocked: grade2_multiplication_meaning_v1 content has assignment or learning history/);
  assert.match(skillRollback, /skill_codes_snapshot && target_skill_codes/);
  assert.equal((skillVerification.match(/\), checks\(check_order, check_name, passed\) as \(/g) || []).length, 1);
  assert.equal((skillVerification.match(/from checks/g) || []).length, 2);
  for (const sql of [skillMigration, migration]) {
    assert.doesNotMatch(sql, /(?:insert into|update|delete from) public\.(?:learning_attempts|learning_attempt_answers|learning_stage_progress|learning_stage_first_passes|sticker_transactions|learning_mistake_review_answers)/i);
  }
});

test("all previously published content remains byte-identical", () => {
  const expected = {
    "content/learning/math/make-ten-v1.json": "3d2342b963ec5f26fc159c766b866858f7d230cb90bc60c9b577bb47aa1ccbc3",
    "content/learning/math/make-ten-v2.json": "d640d6246a137cf08f43e29cb0b3d0e2ef3b27fb7ce917c356e7ea7959f4b91a",
    "content/learning/math/grade2-three-digit-numbers-v1.json": "b527cbe047b4716691c3e08be1414bd956793394c74995cca7b4c1ebe0b17fbb",
    "content/learning/math/grade2-shapes-v1.json": "4c8027ad3dd180b28f70260317eb4f8ef59cfb789524289733749e419462aae1",
    "content/learning/math/grade2-addition-subtraction-v1.json": "70af1685be703597c121e223ec67ae05b46b9a205b96efe046cb25b4ce720d10",
    "content/learning/math/grade2-measuring-length-v1.json": "de5a5522ecdf2d0425f18cb05f5ee52a2b921cb96c78cffd33b22c8e82a651c9",
    "content/learning/math/grade2-classification-v1.json": "d8ad82389f3003fdf572b47eb7a857db0a1fb339b7437af80034ff0ef6961b4b",
    "supabase/migrations/202608090007_add_grade2_classification_skill_definitions.sql": "ee0c17148017ededbaa32dfdb9ec6a49ddc202d5307e59000bc75445a90133d1",
    "supabase/migrations/202608090008_seed_grade2_classification_learning_content.sql": "66a0d6201a3f120db717fb8bc65fecc24d7469c554b11cd2384a90153d641e98",
  };
  assert.deepEqual(Object.fromEntries(Object.keys(expected).map((file) => [file, sha256(file)])), expected);
});
