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
