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

function run(config) {
  const { slug, snake, skillNo, contentNo, newSkills, reusedSkills = [], notePrefix } = config;
  const curriculum = JSON.parse(read("content/learning/curriculum/math/grade-2-2022.json"));
  const unitsPath = path.join(root, "content/learning/templates/grade2-math-units.csv");
  const questionsPath = path.join(root, `content/learning/authored/${slug}-v1.csv`);
  const definitionsPath = path.join(root, `content/learning/authored/${slug}-skill-definitions-v1.csv`);
  const unitsRows = parseCsv(fs.readFileSync(unitsPath, "utf8"), UNIT_HEADERS, unitsPath);
  const questionRows = parseCsv(fs.readFileSync(questionsPath, "utf8"), QUESTION_HEADERS, questionsPath);
  const definitions = parseCsv(fs.readFileSync(definitionsPath, "utf8"), ["skill_code","subject_code","display_name","description"], definitionsPath);
  const content = JSON.parse(read(`content/learning/math/${slug}-v1.json`));
  const questions = content.stages.flatMap((stage) => stage.questions);
  const migration = read(`supabase/migrations/${contentNo}_seed_${snake}_learning_content.sql`);
  const verification = read(`supabase/verification/${contentNo}_seed_${snake}_learning_content_verify.sql`);
  const rollback = read(`supabase/rollbacks/${contentNo}_rollback_${snake}_learning_content.sql`);
  const skillMigration = read(`supabase/migrations/${skillNo}_add_${snake}_skill_definitions.sql`);
  const skillVerification = read(`supabase/verification/${skillNo}_add_${snake}_skill_definitions_verify.sql`);
  const skillRollback = read(`supabase/rollbacks/${skillNo}_rollback_${snake}_skill_definitions.sql`);
  const fixture = read(`test/fixtures/${snake}_content_fixture.sql`);

  test(`${slug}: authored CSV deterministically produces canonical 4/40/160`, () => {
    assert.deepEqual(importUnit({ curriculum, unitsRows, questionRows, unitSlug: slug }), content);
    assert.deepEqual(validateLearningContent(content), { valid: true, errors: [] });
    assert.deepEqual(content.stages.map((stage) => stage.questions.length), [10,10,10,10]);
    assert.equal(questions.length, 40); assert.equal(questions.flatMap((q) => q.options).length, 160);
    assert.equal(new Set(questionRows.map((row) => row.question_text)).size, 40);
  });

  test(`${slug}: answers are single, unique, and exactly balanced`, () => {
    const dist = (items) => [1,2,3,4].map((p) => items.filter((q) => q.options.find((o) => o.isCorrect).displayOrder === p).length);
    assert.deepEqual(content.stages.map((stage) => dist(stage.questions)), [[3,3,2,2],[2,2,3,3],[3,3,2,2],[2,2,3,3]]);
    assert.deepEqual(dist(questions), [10,10,10,10]);
    assert.ok(questions.every((q) => q.options.length === 4 && q.options.filter((o) => o.isCorrect).length === 1 && new Set(q.options.map((o) => o.text)).size === 4));
  });

  test(`${slug}: taxonomy is minimal and every question has one approved primary skill`, () => {
    assert.deepEqual(new Set(definitions.map((row) => row.skill_code)), new Set(newSkills));
    const approved = new Set([...newSkills, ...reusedSkills]);
    assert.ok(questions.every((q) => approved.has(q.skillCode)));
    assert.ok(definitions.every((row) => row.subject_code === "math" && row.display_name && row.description));
    for (const code of reusedSkills) assert.doesNotMatch(skillMigration, new RegExp(`'${code}'`));
  });

  test(`${slug}: domain correctness notes and explanations are deterministic`, () => {
    assert.ok(questionRows.every((row) => row.review_status === "reviewed" && row.review_note.startsWith(notePrefix)));
    assert.ok(questions.every((q) => q.explanation.trim().length >= 15 && !/^정답입니다[.!]?$/.test(q.explanation.trim())));
    for (const row of questionRows) {
      const answer = row[`option_${row.correct_option}`];
      const fields = row.review_note.split(":");
      const numericResult = fields.at(-2); const unit = fields.at(-1);
      if (/^length-(?:add|sub|diff|missing-add|missing-sub)$/.test(fields[0])) assert.equal(answer, `${numericResult}${unit}`);
      if (/^data-(?:total|diff|missing)$/.test(fields[0])) {
        const answerMatch = /^(\d+)(명|개)$/.exec(answer);
        assert.ok(answerMatch);
        assert.equal(Number(answerMatch[1]), Number(fields.at(-1)));
      }
      if (fields[0].startsWith("time-") && /:\d+:\d+:\d+$/.test(row.review_note)) assert.match(answer, /(?:시|분)/);
      if (fields[0].startsWith("pattern-") && /^-?\d+$/.test(fields.at(-1))) {
        const step = Number(fields.at(-1));
        const evidence = `${answer} ${row.explanation}`;
        if (step < 0) assert.match(evidence, new RegExp(`${Math.abs(step)}.*(?:작아|줄어)|(?:작아|줄어).*${Math.abs(step)}`));
        else assert.match(evidence, new RegExp(`(?:^|\\D)${step}(?:\\D|$)`));
      }
    }
    assert.doesNotMatch(JSON.stringify(content), /runtime AI|인공지능|채점 모델/);
  });

  test(`${slug}: generated migration verification rollback and fixture contracts stay additive`, () => {
    assert.equal(generateMigration(content), migration); assert.equal(generateVerification(content), verification); assert.equal(generateRollback(content), rollback);
    assert.match(migration, /Content-only and additive/); assert.match(verification, /question_skills_exact/);
    assert.match(rollback, /rollback blocked:/); assert.match(skillRollback, /skill_codes_snapshot && target_skill_codes/);
    assert.equal((skillVerification.match(/from checks/g) || []).length, 2);
    assert.match(fixture, /snapshot compatibility failed/); assert.match(fixture, /mapping update was accepted/); assert.match(fixture, /existing published identities changed/);
    for (const sql of [skillMigration,migration]) assert.doesNotMatch(sql, /(?:insert into|update|delete from) public\.(?:learning_attempts|learning_attempt_answers|learning_stage_progress|learning_stage_first_passes|sticker_transactions|learning_mistake_review_answers)/i);
  });

  test(`${slug}: existing published content remains byte-identical`, () => {
    const expected = {
      "content/learning/math/make-ten-v1.json":"3d2342b963ec5f26fc159c766b866858f7d230cb90bc60c9b577bb47aa1ccbc3",
      "content/learning/math/make-ten-v2.json":"d640d6246a137cf08f43e29cb0b3d0e2ef3b27fb7ce917c356e7ea7959f4b91a",
      "content/learning/math/grade2-three-digit-numbers-v1.json":"b527cbe047b4716691c3e08be1414bd956793394c74995cca7b4c1ebe0b17fbb",
      "content/learning/math/grade2-shapes-v1.json":"4c8027ad3dd180b28f70260317eb4f8ef59cfb789524289733749e419462aae1",
      "content/learning/math/grade2-addition-subtraction-v1.json":"70af1685be703597c121e223ec67ae05b46b9a205b96efe046cb25b4ce720d10",
      "content/learning/math/grade2-measuring-length-v1.json":"de5a5522ecdf2d0425f18cb05f5ee52a2b921cb96c78cffd33b22c8e82a651c9",
      "content/learning/math/grade2-classification-v1.json":"d8ad82389f3003fdf572b47eb7a857db0a1fb339b7437af80034ff0ef6961b4b",
      "content/learning/math/grade2-multiplication-meaning-v1.json":"63eb5d1aa17e90c9bdbbc6ad2e02bca3c08a5e4945c6b70cc09a3151de4c7ef4",
      "content/learning/math/grade2-four-digit-numbers-v1.json":"067412ebfd9698b2356a1b8ab4064c395c810d1bc3f42b54ddc8e7d618452b67"
    };
    assert.deepEqual(Object.fromEntries(Object.keys(expected).map((file) => [file,sha(file)])), expected);
  });
}

module.exports = { run };
