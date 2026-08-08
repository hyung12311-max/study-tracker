const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  canonicalJson,
  validateLearningContent,
} = require("../scripts/validate-learning-content");

const sourcePath = path.join(__dirname, "..", "content", "learning", "math", "make-ten-v1.json");
const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const v2Source = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "content", "learning", "math", "make-ten-v2.json"), "utf8"));
const clone = () => structuredClone(source);

test("Make Ten v1 satisfies the complete validator contract", () => {
  const result = validateLearningContent(source);
  assert.deepEqual(result, { valid: true, errors: [] });
  assert.equal(source.stages.length, 4);
  assert.equal(source.stages.flatMap((stage) => stage.questions).length, 20);
  assert.equal(
    source.stages.flatMap((stage) => stage.questions.flatMap((question) => question.options)).length,
    80,
  );
});

test("Make Ten v2 supports four equal stages of ten questions", () => {
  assert.deepEqual(validateLearningContent(v2Source), { valid: true, errors: [] });
  assert.deepEqual(v2Source.stages.map((stage) => stage.questions.length), [10, 10, 10, 10]);
  assert.equal(v2Source.stages.flatMap((stage) => stage.questions).length, 40);
  assert.equal(v2Source.stages.flatMap((stage) => stage.questions.flatMap((question) => question.options)).length, 160);
});

test("validator accepts optional exact recommendation metadata without changing legacy content", () => {
  const legacyCanonical = canonicalJson(source);
  const content = clone();
  content.recommendation = {
    subject: "math",
    recommendedStartLevelCode: "elementary_2",
    recommendedEndLevelCode: "elementary_2",
    parentSortOrder: 1,
  };
  assert.deepEqual(validateLearningContent(content), { valid: true, errors: [] });
  assert.equal(canonicalJson(source), legacyCanonical);
});

test("validator accepts an optional canonical skill code without changing legacy content", () => {
  const legacyCanonical = canonicalJson(source);
  const content = clone();
  content.stages[0].questions[0].skillCode = "make-ten.compose";
  assert.deepEqual(validateLearningContent(content), { valid: true, errors: [] });
  assert.equal(canonicalJson(source), legacyCanonical);

  for (const invalid of ["Make Ten", " padded", "skill/one", "skill..one", "가르기"] ) {
    const candidate = clone();
    candidate.stages[0].questions[0].skillCode = invalid;
    assert.match(validateLearningContent(candidate).errors.join("\n"), /skillCode/);
  }
});

test("recommendation content must reuse the exact existing math-core identity", () => {
  const content = clone();
  content.recommendation = {
    subject: "math",
    recommendedStartLevelCode: "elementary_2",
    recommendedEndLevelCode: "elementary_2",
    parentSortOrder: 1,
  };
  content.course.id = "9b0c7ad0-6cc9-470e-9214-0c97eba89ac4";
  content.course.slug = "math-grade2";
  content.course.internalName = "Study Plus 초등 수학 2 운영 과정";
  const errors = validateLearningContent(content).errors.join("\n");
  assert.match(errors, /course\.id: must exactly match the existing math-core/);
  assert.match(errors, /course\.slug: must exactly match the existing math-core/);
  assert.match(errors, /course\.internalName: must exactly match the existing math-core/);
});

test("validator rejects incomplete, unknown, invalid, reversed, and unsafe recommendation metadata", () => {
  const incomplete = clone();
  incomplete.recommendation = { subject: "math" };
  assert.match(validateLearningContent(incomplete).errors.join("\n"), /recommendedStartLevelCode: is required/);

  const unknown = clone();
  unknown.recommendation = {
    subject: "science",
    recommendedStartLevelCode: "elementary_9",
    recommendedEndLevelCode: "elementary_1",
    parentSortOrder: 0,
    familyId: "00000000-0000-4000-8000-000000000001",
  };
  const unknownErrors = validateLearningContent(unknown).errors.join("\n");
  assert.match(unknownErrors, /familyId: is not allowed/);
  assert.match(unknownErrors, /subject: is not an allowed subject/);
  assert.match(unknownErrors, /recommendedStartLevelCode: is not an allowed level code/);
  assert.match(unknownErrors, /parentSortOrder: must be an integer from 1 to 10000/);

  for (const parentSortOrder of [1.5, 10001]) {
    const invalidOrder = clone();
    invalidOrder.recommendation = {
      subject: "math",
      recommendedStartLevelCode: "elementary_2",
      recommendedEndLevelCode: "elementary_2",
      parentSortOrder,
    };
    assert.match(validateLearningContent(invalidOrder).errors.join("\n"), /parentSortOrder: must be an integer/);
  }

  const reversed = clone();
  reversed.recommendation = {
    subject: "math",
    recommendedStartLevelCode: "elementary_3",
    recommendedEndLevelCode: "elementary_2",
    parentSortOrder: 1,
  };
  assert.match(validateLearningContent(reversed).errors.join("\n"), /start level must not be higher/);
});

test("validator rejects unknown fields, duplicate UUIDs, and invalid slugs", () => {
  const content = clone();
  content.extra = true;
  content.unit.id = content.course.id;
  content.unit.slug = "Make Ten";
  const result = validateLearningContent(content);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("$.extra: is not allowed")));
  assert.ok(result.errors.some((error) => error.includes("$.unit.id: duplicates $.course.id")));
  assert.ok(result.errors.some((error) => error.includes("$.unit.slug: must be a lowercase slug")));
});

test("validator rejects broken stage, question, option, and weight ordering", () => {
  const content = clone();
  content.stages[1].difficulty = "tree";
  content.stages[2].displayOrder = 4;
  content.stages[0].questions[1].displayOrder = 1;
  content.stages[0].questions[0].weight = 2;
  content.stages[0].questions[0].options[2].displayOrder = 4;
  const result = validateLearningContent(content);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("difficulty: must equal leaf")));
  assert.ok(result.errors.some((error) => error.includes("displayOrder: must equal 3")));
  assert.ok(result.errors.some((error) => error.includes("weight: must equal 1")));
});

test("validator requires four options, unique text, and exactly one answer", () => {
  const content = clone();
  const question = content.stages[0].questions[0];
  question.options[1].text = question.options[0].text;
  question.options[1].isCorrect = true;
  const result = validateLearningContent(content);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("duplicates another option")));
  assert.ok(result.errors.some((error) => error.includes("exactly one correct option")));
});

test("validator rejects unequal question counts inside one version", () => {
  const content = structuredClone(v2Source);
  content.stages[2].questions.pop();
  const result = validateLearningContent(content);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("must contain exactly 10 questions")));
});

test("validator rejects empty, padded, long, or internal child-facing text", () => {
  const content = clone();
  content.unit.title = " 10을 만들어요";
  content.stages[0].title = "1학년 과정";
  content.stages[0].questions[0].prompt = "";
  content.stages[0].questions[1].explanation = "가".repeat(401);
  const result = validateLearningContent(content);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("surrounding whitespace")));
  assert.ok(result.errors.some((error) => error.includes("internal or curriculum wording")));
  assert.ok(result.errors.some((error) => error.includes("non-empty string")));
  assert.ok(result.errors.some((error) => error.includes("at most 400")));
});

test("validator requires v1-style matching version identifiers", () => {
  const content = clone();
  content.version.label = "version-1";
  content.version.number = 2;
  const result = validateLearningContent(content);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("must match v<positive integer>")));
  assert.ok(result.errors.some((error) => error.includes("same version")));
});

test("canonical JSON is stable across object key order", () => {
  assert.equal(canonicalJson({ b: 2, a: { d: 4, c: 3 } }), canonicalJson({ a: { c: 3, d: 4 }, b: 2 }));
});
