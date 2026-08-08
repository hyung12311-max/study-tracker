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
const questionsPath = path.join(root, "content/learning/authored/grade2-addition-subtraction-v1.csv");
const definitionsPath = path.join(root, "content/learning/authored/grade2-addition-subtraction-skill-definitions-v1.csv");
const unitsRows = parseCsv(fs.readFileSync(unitsPath, "utf8"), UNIT_HEADERS, unitsPath);
const questionRows = parseCsv(fs.readFileSync(questionsPath, "utf8"), QUESTION_HEADERS, questionsPath);
const definitions = parseCsv(
  fs.readFileSync(definitionsPath, "utf8"),
  ["skill_code", "subject_code", "display_name", "description"],
  definitionsPath,
);
const content = JSON.parse(read("content/learning/math/grade2-addition-subtraction-v1.json"));
const migration = read("supabase/migrations/202608090004_seed_grade2_addition_subtraction_learning_content.sql");
const verification = read("supabase/verification/202608090004_seed_grade2_addition_subtraction_learning_content_verify.sql");
const rollback = read("supabase/rollbacks/202608090004_rollback_grade2_addition_subtraction_learning_content.sql");
const skillMigration = read("supabase/migrations/202608090003_add_grade2_addition_subtraction_skill_definitions.sql");
const skillVerification = read("supabase/verification/202608090003_add_grade2_addition_subtraction_skill_definitions_verify.sql");
const skillRollback = read("supabase/rollbacks/202608090003_rollback_grade2_addition_subtraction_skill_definitions.sql");
const questions = content.stages.flatMap((stage) => stage.questions);

test("grade2 addition subtraction authored CSV deterministically produces canonical 4/40/160 content", () => {
  const imported = importUnit({ curriculum, unitsRows, questionRows, unitSlug: "grade2-addition-subtraction" });
  assert.deepEqual(imported, content);
  assert.deepEqual(validateLearningContent(content), { valid: true, errors: [] });
  assert.equal(content.unit.slug, "grade2-addition-subtraction");
  assert.equal(content.unit.displayOrder, 3);
  assert.deepEqual(content.stages.map((stage) => stage.difficulty), ["seed", "leaf", "tree", "crown"]);
  assert.deepEqual(content.stages.map((stage) => stage.questions.length), [10, 10, 10, 10]);
  assert.equal(questions.length, 40);
  assert.equal(questions.flatMap((question) => question.options).length, 160);
  assert.equal(new Set(questionRows.map((row) => row.question_text)).size, 40);
  assert.ok(questionRows.every((row) => row.review_status === "reviewed" && row.weight === "1" && row.skill_code));
});

test("nine minimal operation skills cover every question without duplicating existing taxonomy", () => {
  const contentSkills = new Set(questions.map((question) => question.skillCode));
  const priorDefinitions = [
    ...parseCsv(read("content/learning/authored/math-skill-definitions-v1.csv"), ["skill_code", "subject_code", "display_name", "description"], "math skills"),
    ...parseCsv(read("content/learning/authored/grade2-shapes-skill-definitions-v1.csv"), ["skill_code", "subject_code", "display_name", "description"], "shape skills"),
  ];
  assert.equal(definitions.length, 9);
  assert.equal(new Set(definitions.map((row) => row.skill_code)).size, 9);
  assert.deepEqual(contentSkills, new Set(definitions.map((row) => row.skill_code)));
  assert.ok(definitions.every((definition) => definition.subject_code === "math" && definition.display_name && definition.description));
  assert.ok(definitions.every((definition) => !priorDefinitions.some((prior) => prior.skill_code === definition.skill_code)));
  for (const definition of definitions) assert.match(skillMigration, new RegExp(`'${definition.skill_code}', 'math'`));
});

test("answer positions are balanced overall and within every difficulty", () => {
  const distributions = content.stages.map((stage) => [1, 2, 3, 4].map((position) => (
    stage.questions.filter((question) => question.options.find((option) => option.isCorrect).displayOrder === position).length
  )));
  assert.deepEqual(distributions, [[3, 3, 2, 2], [2, 2, 3, 3], [3, 3, 2, 2], [2, 2, 3, 3]]);
  assert.deepEqual([1, 2, 3, 4].map((position) => questions
    .filter((question) => question.options.find((option) => option.isCorrect).displayOrder === position).length), [10, 10, 10, 10]);
  assert.ok(questions.every((question) => question.options.length === 4));
  assert.ok(questions.every((question) => question.options.filter((option) => option.isCorrect).length === 1));
  assert.ok(questions.every((question) => new Set(question.options.map((option) => option.text)).size === 4));
});

test("all authored arithmetic in explanations is correct and direct calculations match their options", () => {
  const equationPattern = /(\d+(?:[+-]\d+)+)\s*=\s*(\d+)/g;
  let checkedExplanationEquations = 0;
  for (const question of questions) {
    for (const match of question.explanation.matchAll(equationPattern)) {
      const terms = match[1].split(/([+-])/);
      let expected = Number(terms[0]);
      for (let index = 1; index < terms.length; index += 2) {
        expected = terms[index] === "+" ? expected + Number(terms[index + 1]) : expected - Number(terms[index + 1]);
      }
      assert.equal(Number(match[2]), expected, `${question.prompt}: ${match[0]}`);
      checkedExplanationEquations += 1;
    }
    const direct = question.prompt.match(/^(\d+)([+-])(\d+)의 값은\?$/);
    if (direct) {
      const expected = direct[2] === "+" ? Number(direct[1]) + Number(direct[3]) : Number(direct[1]) - Number(direct[3]);
      assert.equal(question.options.find((option) => option.isCorrect).text, String(expected));
      assert.match(question.explanation, new RegExp(`${expected}입니다`));
    }
  }
  assert.ok(checkedExplanationEquations >= 50);
  assert.equal(questions.filter((question) => /^(\d+)([+-])(\d+)의 값은\?$/.test(question.prompt)).length, 8);
});

test("reviewed answers and explanations match the explicit educational contract", () => {
  const expectedAnswers = [
    ["37", "77", "43", "62", "37장", "34자루", "32+15=47", "76-22=54", "34+25가 더 큽니다.", "27"],
    ["65", "75", "24", "25", "65권", "36개", "26+18=44", "64-29=35", "47+26이 더 큽니다.", "46"],
    ["48+27이 1만큼 더 큽니다.", "84-39가 1만큼 더 큽니다.", "45", "45", "47권", "63개", "45-18+12=39", "93-17이 2만큼 더 큽니다.", "8", "35"],
    ["7+8에서 생긴 받아올림 1을 십의 자리에 더하지 않았습니다.", "1십을 받아 12-8=4, 6-3=3이므로 올바른 답은 34입니다.", "46+28=64", "1십을 받아 11-6=5, 7-4=3이므로 35입니다.", "36", "67", "34", "먹은 27개를 빼야 하므로 65-27=38입니다.", "민호의 올바른 결과는 85이고 지수의 74보다 큽니다.", "27"],
  ];
  assert.deepEqual(content.stages.map((stage) => stage.questions.map((question) => (
    question.options.find((option) => option.isCorrect).text
  ))), expectedAnswers);
  assert.ok(questions.every((question) => question.explanation.length >= 15));
  assert.doesNotMatch(JSON.stringify(content), /\bu[0-9a-f]{4}\b/i);
});

test("stored SQL artifacts exactly match the deterministic generator and preserve engine boundaries", () => {
  assert.equal(generateMigration(content), migration);
  assert.equal(generateVerification(content), verification);
  assert.equal(generateRollback(content), rollback);
  assert.match(migration, /Content-only and additive/);
  assert.match(migration, /insert into public\.learning_question_skills/);
  assert.match(verification, /grade2_addition_subtraction_v1_question_skills_exact/);
  assert.match(rollback, /delete from public\.learning_question_skills/);
  assert.match(skillVerification, /grade2 addition subtraction definitions exact/);
  assert.match(skillRollback, /skill_codes_snapshot && target_skill_codes/);
  for (const sql of [skillMigration, migration]) {
    assert.doesNotMatch(sql, /(?:insert into|update|delete from) public\.(?:learning_attempts|learning_attempt_answers|learning_stage_progress|learning_stage_first_passes|sticker_transactions|learning_mistake_review_answers)/i);
  }
});

test("all previously published content and rollout identities remain byte-identical", () => {
  assert.deepEqual({
    makeTenV1: sha256("content/learning/math/make-ten-v1.json"),
    makeTenV2: sha256("content/learning/math/make-ten-v2.json"),
    threeDigitV1: sha256("content/learning/math/grade2-three-digit-numbers-v1.json"),
    shapesV1: sha256("content/learning/math/grade2-shapes-v1.json"),
    makeTenV1Migration: sha256("supabase/migrations/202607310002_seed_make_ten_learning_content.sql"),
    makeTenV2Migration: sha256("supabase/migrations/202607310003_seed_make_ten_v2_learning_content.sql"),
    threeDigitV1Migration: sha256("supabase/migrations/202607310005_seed_grade2_three_digit_numbers_learning_content.sql"),
    skillRolloutMigration: sha256("supabase/migrations/202608080005_rollout_current_content_skill_mappings.sql"),
    shapesSkillMigration: sha256("supabase/migrations/202608090001_add_grade2_shapes_skill_definitions.sql"),
    shapesContentMigration: sha256("supabase/migrations/202608090002_seed_grade2_shapes_learning_content.sql"),
  }, {
    makeTenV1: "3d2342b963ec5f26fc159c766b866858f7d230cb90bc60c9b577bb47aa1ccbc3",
    makeTenV2: "d640d6246a137cf08f43e29cb0b3d0e2ef3b27fb7ce917c356e7ea7959f4b91a",
    threeDigitV1: "b527cbe047b4716691c3e08be1414bd956793394c74995cca7b4c1ebe0b17fbb",
    shapesV1: "4c8027ad3dd180b28f70260317eb4f8ef59cfb789524289733749e419462aae1",
    makeTenV1Migration: "bdd851c6fab011a9ef16cacd64ba767541d8b0a2cbf138f91acbbddf4a86030e",
    makeTenV2Migration: "3d5eaed8818e5e9941106492d50b27c25867b8a9031626764e5c12d3a57be3cc",
    threeDigitV1Migration: "7b6cb9d000ca6c2b21fc6831c16ad952027a9a05a56139e082b12f2dd019d6b3",
    skillRolloutMigration: "8ede9db7bfedb53325406766aa85168500542147179f4adaa7c2a46c69cb67e6",
    shapesSkillMigration: "8219c038bc0671855fb60a14b7cba9f9cd316d6e3a8abb1937571a2e08c49563",
    shapesContentMigration: "bca325faf13b27b0f523a0ffd156b628d9a95e820b7661446b9fd97fe8b2435f",
  });
});
