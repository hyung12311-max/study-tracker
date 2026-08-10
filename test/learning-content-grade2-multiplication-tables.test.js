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
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const sha = (file) => crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex");
const curriculum = JSON.parse(read("content/learning/curriculum/math/grade-2-2022.json"));
const unitsPath = path.join(root, "content/learning/templates/grade2-math-units.csv");
const questionsPath = path.join(root, "content/learning/authored/grade2-multiplication-tables-v1.csv");
const definitionsPath = path.join(root, "content/learning/authored/grade2-multiplication-tables-skill-definitions-v1.csv");
const unitsRows = parseCsv(fs.readFileSync(unitsPath, "utf8"), UNIT_HEADERS, unitsPath);
const questionRows = parseCsv(fs.readFileSync(questionsPath, "utf8"), QUESTION_HEADERS, questionsPath);
const definitions = parseCsv(fs.readFileSync(definitionsPath, "utf8"), ["skill_code","subject_code","display_name","description"], definitionsPath);
const content = JSON.parse(read("content/learning/math/grade2-multiplication-tables-v1.json"));
const questions = content.stages.flatMap((stage) => stage.questions);
const at = (stage, order) => content.stages.find((item) => item.difficulty === stage).questions[order - 1];
const answer = (question) => question.options.find((option) => option.isCorrect).text;
const migration = read("supabase/migrations/202608100002_seed_grade2_multiplication_tables_learning_content.sql");
const verification = read("supabase/verification/202608100002_seed_grade2_multiplication_tables_learning_content_verify.sql");
const rollback = read("supabase/rollbacks/202608100002_rollback_grade2_multiplication_tables_learning_content.sql");
const skillMigration = read("supabase/migrations/202608100001_add_grade2_multiplication_tables_skill_definitions.sql");
const skillVerification = read("supabase/verification/202608100001_add_grade2_multiplication_tables_skill_definitions_verify.sql");
const skillRollback = read("supabase/rollbacks/202608100001_rollback_grade2_multiplication_tables_skill_definitions.sql");
const fixture = read("test/fixtures/grade2_multiplication_tables_content_fixture.sql");

test("authored CSV deterministically produces canonical 4/40/160 content", () => {
  const imported = importUnit({ curriculum, unitsRows, questionRows, unitSlug: "grade2-multiplication-tables" });
  assert.deepEqual(imported, content);
  assert.deepEqual(validateLearningContent(content), { valid: true, errors: [] });
  assert.equal(content.unit.displayOrder, 8);
  assert.deepEqual(content.stages.map((stage) => stage.questions.length), [10,10,10,10]);
  assert.equal(questions.length, 40);
  assert.equal(questions.flatMap((question) => question.options).length, 160);
  assert.equal(new Set(questionRows.map((row) => row.question_text)).size, 40);
  assert.ok(questionRows.every((row) => row.review_status === "reviewed" && row.weight === "1" && row.skill_code));
});

test("twelve minimal new skills and two unchanged meaning skills cover every question", () => {
  const expectedNew = new Set(["multiply-by-2","multiply-by-3","multiply-by-4","multiply-by-5","multiply-by-6","multiply-by-7","multiply-by-8","multiply-by-9","identify-multiplication-table-pattern","infer-missing-multiplication-factor","compare-multiplication-products","reason-about-multiplication-facts"]);
  const reused = new Set(["model-multiplication-situation","correct-multiplication-reasoning"]);
  assert.equal(definitions.length, 12);
  assert.deepEqual(new Set(definitions.map((row) => row.skill_code)), expectedNew);
  assert.ok(questions.every((question) => expectedNew.has(question.skillCode) || reused.has(question.skillCode)));
  assert.ok(definitions.every((row) => row.subject_code === "math" && row.display_name && row.description));
  for (const code of reused) assert.doesNotMatch(skillMigration, new RegExp(`'${code}'`));
});

test("answers are unique single and exactly balanced by stage", () => {
  const dist = (items) => [1,2,3,4].map((position) => items.filter((question) => question.options.find((option) => option.isCorrect).displayOrder === position).length);
  assert.deepEqual(content.stages.map((stage) => dist(stage.questions)), [[3,3,2,2],[2,2,3,3],[3,3,2,2],[2,2,3,3]]);
  assert.deepEqual(dist(questions), [10,10,10,10]);
  assert.ok(questions.every((question) => question.options.length === 4 && question.options.filter((option) => option.isCorrect).length === 1 && new Set(question.options.map((option) => option.text)).size === 4));
});

test("actual multiplication operands cover every table from 2 through 9", () => {
  const coverage = Object.fromEntries([2,3,4,5,6,7,8,9].map((table) => [table, 0]));
  for (const question of questions) {
    const visible = `${question.prompt} ${answer(question)} ${question.explanation}`;
    const present = new Set([...visible.matchAll(/([2-9])×(?:[2-9]|□)/g)].map((match) => Number(match[1])));
    for (const table of present) coverage[table] += 1;
  }
  assert.deepEqual(coverage, {2:5,3:6,4:5,5:6,6:6,7:4,8:7,9:6});
});

test("correct facts are exact and intentional wrong facts are identified and corrected", () => {
  const facts = (text) => [...text.matchAll(/([2-9])×([2-9])=(\d+)/g)].map((match) => ({
    left: Number(match[1]), right: Number(match[2]), stated: Number(match[3]), text: match[0],
  }));
  const explainedProducts = (text) => [...text.matchAll(/([2-9])×([2-9])(?:=|은|는)\s*(\d+)/g)].map((match) => ({
    left: Number(match[1]), right: Number(match[2]), stated: Number(match[3]),
  }));
  let correctFactChecks = 0;
  let intentionalWrongFactChecks = 0;
  for (const question of questions) {
    const assertedFacts = facts(`${question.prompt} ${answer(question)}`);
    const wrongFacts = assertedFacts.filter((fact) => fact.left * fact.right !== fact.stated);
    if (wrongFacts.length) {
      assert.ok(["reason-about-multiplication-facts", "correct-multiplication-reasoning"].includes(question.skillCode));
      assert.match(question.prompt, /잘못|바르게 고친/);
      const corrections = explainedProducts(question.explanation);
      for (const wrong of wrongFacts) {
        assert.ok(corrections.some((fact) => fact.left === wrong.left && fact.right === wrong.right && fact.stated === wrong.left * wrong.right), `${question.prompt}: correct product is missing`);
        intentionalWrongFactChecks += 1;
      }
      assert.match(question.explanation, /아니라|잘못|바르게/);
    } else {
      for (const fact of facts(`${answer(question)} ${question.explanation}`)) {
        assert.equal(fact.left * fact.right, fact.stated, `${question.prompt}: ${fact.text}`);
        correctFactChecks += 1;
      }
    }
  }
  assert.ok(correctFactChecks >= 45);
  assert.equal(intentionalWrongFactChecks, 2);
  assert.equal(answer(at("leaf",3)), "7"); assert.equal(answer(at("leaf",8)), "8");
  assert.equal(answer(at("tree",5)), "8"); assert.equal(answer(at("tree",10)), "8"); assert.match(answer(at("crown",9)), /^8이며/);
  assert.equal(answer(at("leaf",4)), "4×5>3×6"); assert.equal(answer(at("tree",6)), "7×6>8×5");
  assert.equal(answer(at("tree",7)), "6×8"); assert.equal(answer(at("crown",3)), "6×6");
});

test("direction and required problem types use explicit contracts", () => {
  assert.match(answer(at("leaf",5)), /^3×8=24/); assert.match(at("leaf",5).explanation, /한 묶음의 수 3.*사람 수 8.*3×8/);
  assert.match(answer(at("leaf",6)), /바구니 7개.*4개씩/); assert.match(answer(at("crown",2)), /^7×6=42/);
  assert.match(answer(at("crown",5)), /^한 묶음의 수 9.*9×5=45/);
  const types = ["direct","correct-product","missing-factor","comparison","situation-to-expression","expression-to-situation","same-product","incorrect-calculation","correct-explanation","pattern","reverse-inference","daily-application"];
  const evidence = [at("seed",1),at("seed",4),at("leaf",3),at("leaf",4),at("leaf",5),at("leaf",6),at("tree",7),at("crown",7),at("crown",10),at("seed",5),at("tree",10),at("leaf",10)];
  assert.equal(types.length, evidence.length); assert.ok(evidence.every(Boolean));
});

test("explanations satisfy common quality and type-specific reasoning contracts", () => {
  assert.ok(questions.every((question) => typeof question.explanation === "string" && question.explanation.trim().length >= 15 && !/^정답입니다[.!]?$/.test(question.explanation.trim())));

  for (const question of questions.filter((item) => /^multiply-by-[2-9]$/.test(item.skillCode))) {
    const operands = /([2-9])×([2-9])/.exec(question.prompt);
    assert.ok(operands);
    assert.match(question.explanation, new RegExp(`${operands[1]}×${operands[2]}=${Number(operands[1]) * Number(operands[2])}`));
  }

  const missingContracts = [["leaf",3,3,7,21],["leaf",8,4,8,32],["tree",5,6,8,48],["tree",10,9,8,72],["crown",9,8,8,64]];
  for (const [stage, order, left, right, product] of missingContracts) {
    const question = at(stage, order);
    assert.equal(question.skillCode, "infer-missing-multiplication-factor");
    assert.match(question.explanation, new RegExp(`${left}×${right}=${product}`));
    assert.match(answer(question), new RegExp(`^${right}(?:$|이며)`));
  }

  for (const question of questions.filter((item) => item.skillCode === "compare-multiplication-products")) {
    const products = [...question.explanation.matchAll(/([2-9])×([2-9])=(\d+)/g)];
    assert.ok(products.length >= 1);
    for (const match of products) assert.equal(Number(match[1]) * Number(match[2]), Number(match[3]));
  }

  assert.match(at("leaf",5).explanation, /한 묶음의 수 3.*사람 수 8.*3×8=24/);
  assert.match(at("leaf",6).explanation, /4×7.*한 묶음에 4개씩 7묶음/);
  assert.match(at("leaf",10).explanation, /4장.*한 묶음.*상자가 9개.*4×9=36/);
  assert.match(at("crown",2).explanation, /7개.*한 묶음.*봉지가 6개.*7×6=42/);
  assert.match(at("crown",5).explanation, /9개.*한 묶음.*접시가 5개.*9×5=45/);

  for (const [stage, order, product] of [["tree",7,48],["crown",3,36],["crown",10,48]]) {
    const question = at(stage, order);
    assert.match(question.explanation, new RegExp(`결과.*${product}|${product}.*(?:같|결과)`));
  }
  for (const [stage, order, increment] of [["seed",5,2],["leaf",7,3],["tree",8,9],["crown",4,8],["crown",6,7]]) {
    assert.match(at(stage, order).explanation, new RegExp(`${increment}.*(?:크|큽|커|작|더해)|(?:크|큽|커|작|더해).*${increment}`));
  }
  assert.match(at("crown",1).explanation, /46이 아니라 6×8=48/);
  assert.match(at("crown",7).explanation, /8×7은 56.*8×7=54.*잘못/);
  assert.doesNotMatch(JSON.stringify(content), /runtime AI|인공지능|채점 모델/);
});

test("generated SQL verification rollback and fixture contracts stay additive", () => {
  assert.equal(generateMigration(content), migration); assert.equal(generateVerification(content), verification); assert.equal(generateRollback(content), rollback);
  assert.match(migration, /Content-only and additive/); assert.match(verification, /grade2_multiplication_tables_v1_question_skills_exact/);
  assert.match(rollback, /rollback blocked: grade2_multiplication_tables_v1 content has assignment or learning history/);
  assert.match(skillRollback, /skill_codes_snapshot && target_skill_codes/); assert.doesNotMatch(skillRollback, /model-multiplication-situation|correct-multiplication-reasoning/);
  assert.equal((skillVerification.match(/from checks/g) || []).length, 2);
  assert.match(fixture, /snapshot compatibility failed/); assert.match(fixture, /published multiplication tables mapping update was accepted/); assert.match(fixture, /existing published identities changed/);
  for (const sql of [skillMigration,migration]) assert.doesNotMatch(sql, /(?:insert into|update|delete from) public\.(?:learning_attempts|learning_attempt_answers|learning_stage_progress|learning_stage_first_passes|sticker_transactions|learning_mistake_review_answers)/i);
});

test("all existing published content and approved migrations remain byte-identical", () => {
  const expected = {
    "content/learning/math/make-ten-v1.json":"3d2342b963ec5f26fc159c766b866858f7d230cb90bc60c9b577bb47aa1ccbc3",
    "content/learning/math/make-ten-v2.json":"d640d6246a137cf08f43e29cb0b3d0e2ef3b27fb7ce917c356e7ea7959f4b91a",
    "content/learning/math/grade2-three-digit-numbers-v1.json":"b527cbe047b4716691c3e08be1414bd956793394c74995cca7b4c1ebe0b17fbb",
    "content/learning/math/grade2-shapes-v1.json":"4c8027ad3dd180b28f70260317eb4f8ef59cfb789524289733749e419462aae1",
    "content/learning/math/grade2-addition-subtraction-v1.json":"70af1685be703597c121e223ec67ae05b46b9a205b96efe046cb25b4ce720d10",
    "content/learning/math/grade2-measuring-length-v1.json":"de5a5522ecdf2d0425f18cb05f5ee52a2b921cb96c78cffd33b22c8e82a651c9",
    "content/learning/math/grade2-classification-v1.json":"d8ad82389f3003fdf572b47eb7a857db0a1fb339b7437af80034ff0ef6961b4b",
    "content/learning/math/grade2-multiplication-meaning-v1.json":"63eb5d1aa17e90c9bdbbc6ad2e02bca3c08a5e4945c6b70cc09a3151de4c7ef4",
    "content/learning/math/grade2-four-digit-numbers-v1.json":"067412ebfd9698b2356a1b8ab4064c395c810d1bc3f42b54ddc8e7d618452b67",
    "supabase/migrations/202608090009_add_grade2_multiplication_meaning_skill_definitions.sql":"2d01ba75368936f6d9d83f9744fcfc336b317f960ba3c86a07a26330eadf0d88",
    "supabase/migrations/202608090010_seed_grade2_multiplication_meaning_learning_content.sql":"115203fdb99162298209e301d937982f0cab936530401061574d8eacc45a52ab"
  };
  assert.deepEqual(Object.fromEntries(Object.keys(expected).map((file) => [file,sha(file)])), expected);
});
