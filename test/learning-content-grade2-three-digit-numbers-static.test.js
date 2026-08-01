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
  assert.equal(
    crypto.createHash("sha256").update(JSON.stringify(rows.filter((row) => row.stage !== "crown"))).digest("hex"),
    "fab569acc293c433384e89e2a71f48820df2d4b457fe29aff4ea618ed50f869c",
  );
  assert.deepEqual([1, 2, 3, 4].map((position) => rows.filter((row) => row.correct_option === String(position)).length), [12, 8, 10, 10]);
  assert.equal(new Set(rows.map((row) => row.question_text)).size, 40);
});

test("approved reasoning-focused crown questions and explanations are exact", () => {
  const expected = [
    ["430보다 크고 470보다 작으며 일의 자리 숫자는 2입니다. 십의 자리 숫자가 일의 자리 숫자의 2배인 수는?", "442", "infer-number-from-place-conditions"],
    ["600보다 크고 700보다 작은 수입니다. 십의 자리 숫자는 일의 자리 숫자보다 1 작고 두 숫자를 더하면 9입니다. 이 수는?", "645", "infer-number-from-digit-relations"],
    ["숫자 카드 3과 6과 8을 각각 한 번씩 써서 세 자리 수를 만듭니다. 만들 수 있는 두 번째로 큰 수는?", "836", "build-second-largest-number"],
    ["숫자 카드 0과 4와 7을 각각 한 번씩 써서 400보다 큰 세 자리 수를 만듭니다. 그중 가장 작은 수는?", "407", "build-smallest-number-above-bound"],
    ["472의 십의 자리와 일의 자리 숫자를 서로 바꿨습니다. 바꾼 수를 바르게 설명한 것은?", "420보다 크고 430보다 작습니다.", "compare-after-swapping-digits"],
    ["5□7에서 십의 자리와 일의 자리 숫자를 바꾸면 57□가 됩니다. 처음 수가 바꾼 수보다 크고 □가 짝수일 때 □에 알맞은 숫자는?", "8", "infer-digit-after-swap-comparison"],
    ["100개 묶음 3개와 10개 묶음 12개가 있습니다. 10개 묶음 10개를 100개 묶음 1개로 바꾼 결과는?", "100개 묶음 4개와 10개 묶음 2개", "exchange-ten-bundles-for-hundred"],
    ["400+90+10에서 10개 묶음을 바르게 교환해 같은 수로 나타낸 것은?", "100개 묶음 5개", "recognize-equivalent-bundle-expression"],
    ["민수는 507에서 십의 자리 0을 빼고 57이라고 읽었습니다. 잘못된 생각을 바르게 고친 것은?", "0은 십이 없다는 뜻이지만 7은 일의 자리에 남으므로 507입니다.", "correct-zero-place-value-error"],
    ["지수는 682와 619를 일의 자리부터 비교해 619가 더 크다고 했습니다. 잘못된 비교를 바르게 고친 것은?", "백의 자리는 같고 십의 자리 8이 1보다 크므로 682가 더 큽니다.", "correct-comparison-order-error"],
  ];
  const crownRows = rows.filter((row) => row.stage === "crown");
  assert.equal(crownRows.length, expected.length);
  for (const [index, [prompt, answer, skillCode]] of expected.entries()) {
    const row = crownRows[index];
    assert.equal(row.question_text, prompt);
    assert.equal(row[`option_${row.correct_option}`], answer);
    assert.equal(row.skill_code, skillCode);
    assert.match(row.explanation, /[.]/);
  }
  assert.deepEqual([1, 2, 3, 4].map((position) => crownRows.filter((row) => row.correct_option === String(position)).length), [3, 3, 2, 2]);
  assert.equal(crownRows.filter((row) => /잘못/.test(row.question_text)).length, 2);
});

test("generated SQL is content-only, course-reusing, generic, and deterministic", () => {
  assert.deepEqual({
    migration: sha256(artifacts.migration),
    verification: sha256(artifacts.verification),
    rollback: sha256(artifacts.rollback),
  }, {
    migration: "7b6cb9d000ca6c2b21fc6831c16ad952027a9a05a56139e082b12f2dd019d6b3",
    verification: "ef5cd2b441503bcc0cbfb3d4697cc1d52667017535215503dc513eaf950d6c96",
    rollback: "0c1f126e9bd18c66b300f0173a59ca80ac119978c821e1ce0b915770d48f7c97",
  });
  const migration = fs.readFileSync(artifacts.migration, "utf8");
  const verification = fs.readFileSync(artifacts.verification, "utf8");
  const rollback = fs.readFileSync(artifacts.rollback, "utf8");
  assert.doesNotMatch(migration, /insert into public\.learning_courses/i);
  assert.match(migration, /existing course is missing or changed/);
  assert.match(migration, /'grade2-three-digit-numbers', '세 자리 수를 알아봐요', 2\);/);
  assert.match(migration, /unit sort order already exists/);
  assert.match(verification, /question_weights_exact/);
  assert.match(verification, /pass_threshold_contract/);
  assert.match(verification, /unit\.sort_order = 2/);
  assert.match(verification, /make_ten_unit_sort_order_preserved/);
  assert.match(verification, /course_unit_sort_orders_unique/);
  assert.match(rollback, /errcode = '55000'/);
  assert.doesNotMatch(rollback, /delete from public\.learning_courses/i);
  for (const sql of [migration, rollback]) {
    assert.doesNotMatch(sql, /make[_ -]ten/i);
  }
  assert.doesNotMatch(migration, /math-grade2|9b0c7ad0-6cc9-470e-9214-0c97eba89ac4/);
  assert.doesNotMatch(rollback, /math-grade2|9b0c7ad0-6cc9-470e-9214-0c97eba89ac4/);
  assert.match(verification, /forbidden_course_absent/);
});
