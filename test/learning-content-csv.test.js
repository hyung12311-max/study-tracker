const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const { encodeCsv, parseCsv, resolveAllowedOutput, validateAuthoredText } = require("../scripts/learning-content-csv");
const { generateTemplateCsv, QUESTION_HEADERS, STAGES, UNIT_HEADERS } = require("../scripts/generate-learning-content-csv-template");
const { deterministicUuid, importUnit } = require("../scripts/import-learning-content-csv");
const { validateLearningContent } = require("../scripts/validate-learning-content");
const {
  generateMigration,
  generateRollback,
  generateVerification,
  resolveUnitSortOrder,
} = require("../scripts/generate-learning-content-migration");

const root = path.join(__dirname, "..");
const curriculum = JSON.parse(fs.readFileSync(path.join(root, "content/learning/curriculum/math/grade-2-2022.json"), "utf8"));
const storedUnits = fs.readFileSync(path.join(root, "content/learning/templates/grade2-math-units.csv"), "utf8");
const storedQuestions = fs.readFileSync(path.join(root, "content/learning/templates/grade2-math-questions.csv"), "utf8");

function preparedRows(unitSlug = "grade2-three-digit-numbers") {
  const unitsRows = parseCsv(storedUnits, UNIT_HEADERS, "units");
  const questionRows = parseCsv(storedQuestions, QUESTION_HEADERS, "questions");
  for (const row of questionRows.filter((candidate) => candidate.unit_slug === unitSlug)) {
    row.question_text = `${row.stage} 테스트 전용 문항 ${row.question_order}`;
    row.option_1 = "보기 하나";
    row.option_2 = "보기 둘";
    row.option_3 = "보기 셋";
    row.option_4 = "보기 넷";
    row.correct_option = String((Number(row.question_order) % 4) + 1);
    row.explanation = "테스트 전용 해설입니다.";
    row.skill_code = `test-${row.stage}-${row.question_order}`;
    row.review_status = "reviewed";
  }
  return { unitsRows, questionRows };
}

test("CSV parser supports BOM, CRLF/LF, quoted commas, escaped quotes, multiline, and empty values", () => {
  const headers = ["a", "b", "c"];
  const input = '\uFEFFa,b,c\r\n"쉼표, 포함","큰따옴표 ""보존""","여러\n줄"\r\n끝,,값';
  const rows = parseCsv(input, headers, "roundtrip.csv");
  assert.deepEqual(rows.map((row) => ({ ...row })), [
    { a: "쉼표, 포함", b: '큰따옴표 "보존"', c: "여러\n줄" },
    { a: "끝", b: "", c: "값" },
  ]);
  assert.deepEqual(parseCsv(encodeCsv(headers, rows.map((row) => headers.map((header) => row[header]))), headers).map((row) => ({ ...row })), rows.map((row) => ({ ...row })));
});

test("CSV parser reports source row and rejects headers and column-count errors", () => {
  assert.throws(() => parseCsv("a,a\n1,2", ["a", "b"], "duplicate.csv"), /duplicate header a/);
  assert.throws(() => parseCsv("b,a\n1,2", ["a", "b"], "order.csv"), /headers must exactly equal/);
  assert.throws(() => parseCsv("a,b\n1", ["a", "b"], "width.csv"), /width\.csv: row 2, column 2/);
});

test("authored text blocks formula injection, control characters, and credentials", () => {
  for (const value of ["=1+1", "+cmd", "-2", "@SUM(A1)"]) assert.throws(() => validateAuthoredText(value, "cell"), /formula/);
  assert.throws(() => validateAuthoredText("bad\u0000text", "cell"), /control character/);
  assert.throws(() => validateAuthoredText("postgresql:\/\/user:pass@example.test/db", "cell"), /credential/);
});

test("template generator is deterministic and stored templates are byte-identical", () => {
  const first = generateTemplateCsv(curriculum);
  const second = generateTemplateCsv(structuredClone(curriculum));
  assert.equal(first.units, second.units);
  assert.equal(first.questions, second.questions);
  assert.equal(first.units, storedUnits);
  assert.equal(first.questions, storedQuestions);
  assert.equal(parseCsv(first.units, UNIT_HEADERS).length, 12);
  const rows = parseCsv(first.questions, QUESTION_HEADERS);
  assert.equal(rows.length, 480);
  assert.deepEqual(STAGES.map((stage) => rows.filter((row) => row.unit_slug === curriculum.units[0].slug && row.stage === stage).length), [10, 10, 10, 10]);
  for (const row of rows) {
    for (const field of ["question_text", "option_1", "option_2", "option_3", "option_4", "correct_option", "explanation", "skill_code", "review_note"]) assert.equal(row[field], "");
    assert.equal(row.weight, "1");
    assert.equal(row.review_status, "draft");
  }
});

test("template CLI refuses overwrite by default and output paths cannot escape the allowlist", () => {
  const result = spawnSync(process.execPath, ["scripts/generate-learning-content-csv-template.js"], { cwd: root, encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /EEXIST|file already exists/i);
  assert.throws(() => resolveAllowedOutput(root, "../escape.csv", "content/learning/templates", "grade2-math-units.csv"), /output path must be/);
});

test("importer creates deterministic 4/40/160 content accepted by existing tools", () => {
  const firstRows = preparedRows();
  const secondRows = preparedRows();
  const first = importUnit({ curriculum, ...firstRows, unitSlug: "grade2-three-digit-numbers" });
  const second = importUnit({ curriculum, ...secondRows, unitSlug: "grade2-three-digit-numbers" });
  assert.equal(`${JSON.stringify(first, null, 2)}\n`, `${JSON.stringify(second, null, 2)}\n`);
  assert.deepEqual(validateLearningContent(first), { valid: true, errors: [] });
  assert.deepEqual(first.course, curriculum.course);
  assert.deepEqual(first.course, JSON.parse(fs.readFileSync(path.join(root, "content/learning/math/make-ten-v1.json"), "utf8")).course);
  assert.deepEqual(first.recommendation, curriculum.units[0].recommendation);
  assert.deepEqual(first.stages.map((stage) => stage.questions.length), [10, 10, 10, 10]);
  assert.equal(first.stages[0].questions[0].skillCode, "test-seed-1");
  assert.ok(first.stages.flatMap((stage) => stage.questions).every((question) => typeof question.skillCode === "string"));
  assert.equal(first.stages.flatMap((stage) => stage.questions.flatMap((question) => question.options)).length, 160);
  const migration = generateMigration(first);
  const verification = generateVerification(first);
  const rollback = generateRollback(first);
  assert.match(migration, /Content-only and additive/);
  assert.match(migration, /learning skill metadata foundation is missing/);
  assert.match(migration, /insert into public\.learning_question_skills/);
  assert.match(verification, /question_skills_exact/);
  assert.match(rollback, /delete from public\.learning_question_skills/);
  assert.match(migration, /'grade2-three-digit-numbers', '세 자리 수를 알아봐요', 2\);/);
  assert.match(migration, /unit sort order already exists/);
  assert.doesNotMatch(migration, /insert into public\.learning_courses/i);
  assert.doesNotMatch(migration, /make[_ -]ten/i);
  assert.doesNotMatch(generateMigration(first), /insert into public\.(?:learning_assignments|learning_attempts|learning_stage_first_passes|sticker_transactions)/i);
  assert.match(verification, /grade2-three-digit-numbers v1 content verification/);
  assert.match(verification, /grade2_three_digit_numbers_v1_question_weights_exact/);
  assert.match(verification, /grade2_three_digit_numbers_v1_pass_threshold_contract/);
  assert.match(verification, /grade2_three_digit_numbers_v1_make_ten_unit_sort_order_preserved/);
  assert.match(verification, /grade2_three_digit_numbers_v1_course_unit_sort_orders_unique/);
  assert.match(rollback, /where content_version_id =/);
  assert.doesNotMatch(rollback, /make[_ -]ten/i);
});

test("generator reserves math-core sort order 1 for Make Ten without changing other courses", () => {
  const grade2 = importUnit({ curriculum, ...preparedRows(), unitSlug: "grade2-three-digit-numbers" });
  const makeTen = JSON.parse(fs.readFileSync(path.join(root, "content/learning/math/make-ten-v1.json"), "utf8"));
  const anotherCourse = structuredClone(grade2);
  anotherCourse.course.id = "00000000-0000-4000-8000-000000000099";

  assert.equal(resolveUnitSortOrder(makeTen), 1);
  assert.equal(resolveUnitSortOrder(grade2), 2);
  assert.equal(resolveUnitSortOrder(anotherCourse), 1);
});

test("importer injects recommendation only from the selected curriculum unit", () => {
  for (const header of ["subject", "recommended_start_level_code", "recommended_end_level_code", "parent_sort_order"]) {
    assert.ok(!UNIT_HEADERS.includes(header));
    assert.ok(!QUESTION_HEADERS.includes(header));
  }
  const secondUnit = curriculum.units[1];
  const content = importUnit({ curriculum, ...preparedRows(secondUnit.slug), unitSlug: secondUnit.slug });
  assert.deepEqual(content.recommendation, secondUnit.recommendation);
  assert.equal(content.recommendation.parentSortOrder, 2);

  const missing = structuredClone(curriculum);
  delete missing.units[0].recommendation;
  assert.throws(() => importUnit({ curriculum: missing, ...preparedRows(), unitSlug: curriculum.units[0].slug }), /recommendation: is required/);

  const contaminated = structuredClone(curriculum);
  contaminated.units[0].recommendation.actorId = "00000000-0000-4000-8000-000000000001";
  assert.throws(() => importUnit({ curriculum: contaminated, ...preparedRows(), unitSlug: curriculum.units[0].slug }), /actorId: is not allowed/);
});

test("importer rejects a new grade-specific course identity before content generation", () => {
  const forbidden = structuredClone(curriculum);
  forbidden.course.id = "9b0c7ad0-6cc9-470e-9214-0c97eba89ac4";
  forbidden.course.slug = "math-grade2";
  forbidden.course.internalName = "Study Plus 초등 수학 2 운영 과정";
  assert.throws(() => importUnit({ curriculum: forbidden, ...preparedRows(), unitSlug: curriculum.units[0].slug }), /course\.(?:id|slug|internalName): must exactly match/);
});

test("deterministic UUIDs are stable, valid v4 values, and distinct across canonical keys", () => {
  const first = deterministicUuid("question", "unit-a", "v1", "seed", "1");
  assert.equal(first, deterministicUuid("question", "unit-a", "v1", "seed", "1"));
  assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(first, deterministicUuid("question", "unit-a", "v1", "seed", "2"));
  assert.notEqual(first, deterministicUuid("question", "unit-b", "v1", "seed", "1"));
});

test("importer rejects blank, partial, unreviewed, duplicate-answer, metadata, and cross-unit input", () => {
  const blank = {
    unitsRows: parseCsv(storedUnits, UNIT_HEADERS, "units"),
    questionRows: parseCsv(storedQuestions, QUESTION_HEADERS, "questions"),
  };
  assert.throws(() => importUnit({ curriculum, ...blank, unitSlug: "grade2-three-digit-numbers" }), /review_status must equal reviewed|question_text: must not be empty/);

  const partial = preparedRows();
  partial.questionRows.splice(partial.questionRows.findIndex((row) => row.unit_slug === "grade2-three-digit-numbers"), 1);
  assert.throws(() => importUnit({ curriculum, ...partial, unitSlug: "grade2-three-digit-numbers" }), /expected 40 question rows/);

  const unreviewed = preparedRows();
  unreviewed.questionRows.find((row) => row.unit_slug === "grade2-three-digit-numbers").review_status = "draft";
  assert.throws(() => importUnit({ curriculum, ...unreviewed, unitSlug: "grade2-three-digit-numbers" }), /review_status must equal reviewed/);

  const duplicate = preparedRows();
  const duplicateRow = duplicate.questionRows.find((row) => row.unit_slug === "grade2-three-digit-numbers");
  duplicateRow.option_2 = duplicateRow.option_1;
  assert.throws(() => importUnit({ curriculum, ...duplicate, unitSlug: "grade2-three-digit-numbers" }), /option text must be unique/);

  const missingAnswer = preparedRows();
  missingAnswer.questionRows.find((row) => row.unit_slug === "grade2-three-digit-numbers").correct_option = "";
  assert.throws(() => importUnit({ curriculum, ...missingAnswer, unitSlug: "grade2-three-digit-numbers" }), /correct_option must be/);

  const formula = preparedRows();
  formula.questionRows.find((row) => row.unit_slug === "grade2-three-digit-numbers").question_text = "=1+1";
  assert.throws(() => importUnit({ curriculum, ...formula, unitSlug: "grade2-three-digit-numbers" }), /formula prefixes are forbidden/);

  const metadata = preparedRows();
  metadata.unitsRows[0].unit_title = "다른 제목";
  assert.throws(() => importUnit({ curriculum, ...metadata, unitSlug: "grade2-three-digit-numbers" }), /must exactly match/);

  const crossUnit = preparedRows();
  const foreign = crossUnit.questionRows.find((row) => row.unit_slug === "grade2-shapes");
  foreign.question_text = "다른 단원 작성 문항";
  assert.throws(() => importUnit({ curriculum, ...crossUnit, unitSlug: "grade2-three-digit-numbers" }), /another unit is not allowed/);
});

test("JSON output hash is stable for identical authored CSV", () => {
  const one = importUnit({ curriculum, ...preparedRows(), unitSlug: "grade2-three-digit-numbers" });
  const two = importUnit({ curriculum, ...preparedRows(), unitSlug: "grade2-three-digit-numbers" });
  const hash = (value) => crypto.createHash("sha256").update(`${JSON.stringify(value, null, 2)}\n`).digest("hex");
  assert.equal(hash(one), hash(two));
});
