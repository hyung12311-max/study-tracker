const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { validateCurriculum } = require("../scripts/validate-learning-curriculum");

const curriculumPath = path.join(__dirname, "..", "content/learning/curriculum/math/grade-2-2022.json");
const source = JSON.parse(fs.readFileSync(curriculumPath, "utf8"));

test("grade 2 operating map has 12 ordered units and an explicit official-scope disclaimer", () => {
  assert.deepEqual(validateCurriculum(source), { valid: true, errors: [] });
  assert.equal(source.units.length, 12);
  assert.deepEqual(source.units.map((unit) => unit.semester), [1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2]);
  assert.deepEqual(source.units.map((unit) => unit.catalogOrder), Array.from({ length: 12 }, (_, index) => index + 1));
  assert.deepEqual(source.units.map((unit) => unit.recommendation), source.units.map((unit, index) => ({
    subject: "math",
    recommendedStartLevelCode: "elementary_2",
    recommendedEndLevelCode: "elementary_2",
    parentSortOrder: index + 1,
  })));
  assert.deepEqual(source.course, {
    id: "51000000-0000-4000-8000-000000000001",
    slug: "math-core",
    internalName: "수학 기초 과정",
    subject: "수학",
  });
  assert.match(source.mappingDisclaimer, /Study Plus/);
  assert.match(source.mappingDisclaimer, /공식 학년별 단원 순서가 아닙니다/);
});

test("all grade 2 units reuse the exact existing math-core course contract", () => {
  for (const field of ["id", "slug", "internalName", "subject"]) {
    const curriculum = structuredClone(source);
    curriculum.course[field] = field === "slug" ? "math-grade2" : "wrong";
    assert.match(validateCurriculum(curriculum).errors.join("\n"), new RegExp(`course\\.${field}: must exactly match`));
  }
});

test("curriculum validator rejects unknown achievement codes and unknown fields", () => {
  const curriculum = structuredClone(source);
  curriculum.units[0].achievementCodes.push("2수01-99");
  curriculum.units[1].publisherUnitId = "forbidden";
  const result = validateCurriculum(curriculum);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("not a known mapped achievement code")));
  assert.ok(result.errors.some((error) => error.includes("publisherUnitId: is not allowed")));
});

test("curriculum validator rejects duplicate slugs and missing prerequisites", () => {
  const curriculum = structuredClone(source);
  curriculum.units[1].slug = curriculum.units[0].slug;
  curriculum.units[0].prerequisiteUnitSlugs = ["missing-unit"];
  const result = validateCurriculum(curriculum);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("duplicates")));
  assert.ok(result.errors.some((error) => error.includes("unknown unit")));
});

test("curriculum validator rejects prerequisite cycles", () => {
  const curriculum = structuredClone(source);
  curriculum.units[0].prerequisiteUnitSlugs = ["grade2-four-digit-numbers"];
  curriculum.units[6].prerequisiteUnitSlugs = ["grade2-three-digit-numbers"];
  const result = validateCurriculum(curriculum);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("prerequisite cycle")));
});

test("curriculum validator rejects missing, contaminated, reversed, and duplicate recommendation metadata", () => {
  const curriculum = structuredClone(source);
  delete curriculum.units[0].recommendation;
  curriculum.units[1].recommendation.familyId = "00000000-0000-4000-8000-000000000001";
  curriculum.units[2].recommendation.recommendedStartLevelCode = "elementary_3";
  curriculum.units[2].recommendation.recommendedEndLevelCode = "elementary_2";
  curriculum.units[3].recommendation.parentSortOrder = curriculum.units[4].recommendation.parentSortOrder;
  const errors = validateCurriculum(curriculum).errors.join("\n");
  assert.match(errors, /recommendation: is required/);
  assert.match(errors, /recommendation\.familyId: is not allowed/);
  assert.match(errors, /start level must not be higher/);
  assert.match(errors, /parentSortOrder: must be globally unique|must equal catalogOrder/);
});
