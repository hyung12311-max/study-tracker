const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { parseCsv } = require("../scripts/learning-content-csv");
const { QUESTION_HEADERS } = require("../scripts/generate-learning-content-csv-template");

const root = path.join(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const hash = (relative) => crypto.createHash("sha256").update(fs.readFileSync(path.join(root, relative))).digest("hex");
const migration = read("supabase/migrations/202608080005_rollout_current_content_skill_mappings.sql");
const verification = read("supabase/verification/202608080005_rollout_current_content_skill_mappings_verify.sql");
const rollback = read("supabase/rollbacks/202608080005_rollback_current_content_skill_mappings.sql");
const fixture = read("test/fixtures/content_skill_mapping_rollout_fixture.sql");

const definitionsPath = path.join(root, "content/learning/authored/math-skill-definitions-v1.csv");
const definitionHeaders = ["skill_code", "subject_code", "display_name", "description"];
const definitions = parseCsv(fs.readFileSync(definitionsPath, "utf8"), definitionHeaders, definitionsPath);
const questionsPath = path.join(root, "content/learning/authored/grade2-three-digit-numbers-v1.csv");
const authoredQuestions = parseCsv(fs.readFileSync(questionsPath, "utf8"), QUESTION_HEADERS, questionsPath);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test("reviewed authored skills cover both current learning units", () => {
  assert.equal(definitions.length, 23);
  assert.equal(new Set(definitions.map((row) => row.skill_code)).size, 23);
  assert.ok(definitions.every((row) => row.subject_code === "math" && row.display_name));
  assert.ok(definitions.some((row) => row.skill_code === "make-ten.compose"));

  assert.equal(authoredQuestions.length, 40);
  assert.ok(authoredQuestions.every((row) => row.review_status === "reviewed" && row.skill_code));
  assert.equal(new Set(authoredQuestions.map((row) => row.skill_code)).size, 22);
  for (const skillCode of new Set(authoredQuestions.map((row) => row.skill_code))) {
    assert.ok(definitions.some((definition) => definition.skill_code === skillCode));
  }

  const makeTenQuestions = ["v1", "v2"].flatMap((version) => (
    JSON.parse(read(`content/learning/math/make-ten-${version}.json`)).stages.flatMap((stage) => stage.questions)
  ));
  const grade2Questions = JSON.parse(read("content/learning/math/grade2-three-digit-numbers-v1.json"))
    .stages.flatMap((stage) => stage.questions);
  assert.equal(makeTenQuestions.length, 60);
  assert.equal(grade2Questions.length, 40);
});

test("rollout migration preserves every authored question skill and seeds one primary mapping", () => {
  for (const row of authoredQuestions) {
    const tuple = `('${row.stage}', ${row.question_order}, '${row.skill_code}')`;
    assert.match(migration, new RegExp(escapeRegExp(tuple)));
  }
  for (const definition of definitions) {
    assert.match(migration, new RegExp(`'${escapeRegExp(definition.skill_code)}', 'math'`));
  }
  assert.match(migration, /select question\.id, 'make-ten\.compose'/);
  assert.match(migration, /content_skill_rollout_mappings\) <> 100/);
  assert.match(migration, /on conflict \(skill_code\) do nothing/);
  assert.match(migration, /on conflict \(question_id, skill_code\) do nothing/);
  assert.match(migration, /question skill mapping conflicts with reviewed rollout source/);
});

test("rollout verification enforces exact coverage, integrity, protection, and ACL", () => {
  assert.match(verification, /question mappings exactly match rollout/);
  assert.match(verification, /every target question has one primary skill/);
  assert.match(verification, /no orphan rollout definition/);
  assert.match(verification, /no orphan or invalid mapping/);
  assert.match(verification, /primary uniqueness enforced/);
  assert.match(verification, /published mappings remain protected/);
  assert.match(verification, /skill metadata acl remains read only/);
  assert.match(verification, /skill metadata remains outside realtime/);
  assert.match(verification, /count\(\*\)::integer total_checks/);

  assert.match(fixture, /published question skill update was accepted/);
  assert.match(fixture, /published question skill delete was accepted/);
  assert.match(fixture, /second primary skill was accepted/);
  assert.match(fixture, /invalid skill code was accepted/);
});

test("published content identity and official/review boundaries remain unchanged", () => {
  assert.deepEqual({
    makeTenV1: hash("content/learning/math/make-ten-v1.json"),
    makeTenV2: hash("content/learning/math/make-ten-v2.json"),
    grade2V1: hash("content/learning/math/grade2-three-digit-numbers-v1.json"),
    makeTenV1Migration: hash("supabase/migrations/202607310002_seed_make_ten_learning_content.sql"),
    makeTenV2Migration: hash("supabase/migrations/202607310003_seed_make_ten_v2_learning_content.sql"),
    grade2V1Migration: hash("supabase/migrations/202607310005_seed_grade2_three_digit_numbers_learning_content.sql"),
  }, {
    makeTenV1: "3d2342b963ec5f26fc159c766b866858f7d230cb90bc60c9b577bb47aa1ccbc3",
    makeTenV2: "d640d6246a137cf08f43e29cb0b3d0e2ef3b27fb7ce917c356e7ea7959f4b91a",
    grade2V1: "b527cbe047b4716691c3e08be1414bd956793394c74995cca7b4c1ebe0b17fbb",
    makeTenV1Migration: "bdd851c6fab011a9ef16cacd64ba767541d8b0a2cbf138f91acbbddf4a86030e",
    makeTenV2Migration: "3d5eaed8818e5e9941106492d50b27c25867b8a9031626764e5c12d3a57be3cc",
    grade2V1Migration: "7b6cb9d000ca6c2b21fc6831c16ad952027a9a05a56139e082b12f2dd019d6b3",
  });

  for (const sql of [migration, rollback]) {
    assert.doesNotMatch(sql, /(?:insert into|update|delete from) public\.(?:learning_attempts|learning_attempt_answers|learning_stage_progress|learning_stage_first_passes|sticker_transactions|learning_mistake_review_answers)/i);
  }
  assert.match(rollback, /skill_codes_snapshot && rollout_codes/);
  assert.match(rollback, /content skill rollout is in use/);

  const analysis = read("server/api/learning/_analysis.js");
  const recommendations = read("server/api/learning/_recommendations.js");
  assert.match(analysis, /skill_codes_snapshot/);
  assert.match(analysis, /learning_skill_definitions/);
  assert.match(recommendations, /learning_question_skills/);
});
