const fs = require("node:fs");
const path = require("node:path");

const ROOT_FIELDS = ["schemaVersion", "curriculumId", "officialNotice", "officialUrl", "officialGradeBand", "operationalGrade", "subject", "mappingDisclaimer", "units"];
const UNIT_FIELDS = ["semester", "domain", "unitOrder", "catalogOrder", "slug", "title", "internalObjective", "achievementCodes", "prerequisiteUnitSlugs", "recommendationLevel", "recommendation", "status", "sourceNote"];
const RECOMMENDATION_FIELDS = ["subject", "recommendedStartLevelCode", "recommendedEndLevelCode", "parentSortOrder"];
const DOMAINS = new Set(["수와 연산", "변화와 관계", "도형과 측정", "자료와 가능성"]);
const STATUSES = new Set(["planned", "draft", "reviewed", "published"]);
const ACHIEVEMENT_CODES = new Set([
  "2수01-02", "2수01-03", "2수01-06", "2수01-07", "2수01-08", "2수01-09", "2수01-10", "2수01-11",
  "2수02-01", "2수02-02",
  "2수03-03", "2수03-04", "2수03-05", "2수03-07", "2수03-08", "2수03-09", "2수03-10", "2수03-11", "2수03-12", "2수03-13",
  "2수04-01", "2수04-02", "2수04-03",
]);
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CODE = /^2수(?:01|02|03|04)-\d{2}$/;
const RECOMMENDATION_SUBJECTS = ["math"];
const RECOMMENDATION_LEVELS = ["ready", "elementary_1", "elementary_2", "elementary_3", "elementary_4", "elementary_5", "elementary_6"];

function validateCurriculum(curriculum) {
  const errors = [];
  const fail = (location, message) => errors.push(`${location}: ${message}`);
  const exact = (value, fields, location) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      fail(location, "must be an object");
      return false;
    }
    for (const field of fields) if (!Object.hasOwn(value, field)) fail(`${location}.${field}`, "is required");
    for (const field of Object.keys(value)) if (!fields.includes(field)) fail(`${location}.${field}`, "is not allowed");
    return true;
  };
  const text = (value, location) => {
    if (typeof value !== "string" || value.length === 0 || value.trim() !== value) fail(location, "must be a non-empty trimmed string");
  };

  if (!exact(curriculum, ROOT_FIELDS, "$")) return { valid: false, errors };
  if (curriculum.schemaVersion !== 1) fail("$.schemaVersion", "must equal 1");
  for (const field of ["curriculumId", "officialNotice", "officialUrl", "officialGradeBand", "operationalGrade", "subject", "mappingDisclaimer"]) text(curriculum[field], `$.${field}`);
  if (curriculum.officialGradeBand !== "초등학교 1~2학년군") fail("$.officialGradeBand", "must preserve the official 1~2 grade-band scope");
  if (curriculum.operationalGrade !== "초등 2") fail("$.operationalGrade", "must equal 초등 2");
  if (curriculum.subject !== "수학") fail("$.subject", "must equal 수학");
  if (!/Study Plus/.test(curriculum.mappingDisclaimer) || !/공식 학년별 단원 순서가 아닙니다/.test(curriculum.mappingDisclaimer)) {
    fail("$.mappingDisclaimer", "must distinguish the Study Plus operating map from an official grade-specific sequence");
  }
  if (!Array.isArray(curriculum.units) || curriculum.units.length !== 12) fail("$.units", "must contain exactly 12 units");

  const slugs = new Map();
  const titles = new Map();
  const catalogOrders = new Set();
  const parentSortOrders = new Set();
  for (const [index, unit] of (Array.isArray(curriculum.units) ? curriculum.units : []).entries()) {
    const location = `$.units[${index}]`;
    if (!exact(unit, UNIT_FIELDS, location)) continue;
    if (![1, 2].includes(unit.semester)) fail(`${location}.semester`, "must equal 1 or 2");
    if (!DOMAINS.has(unit.domain)) fail(`${location}.domain`, "is not an allowed domain");
    const expectedUnitOrder = index % 6 + 1;
    const expectedSemester = index < 6 ? 1 : 2;
    if (unit.semester !== expectedSemester) fail(`${location}.semester`, `must equal ${expectedSemester} at this position`);
    if (unit.unitOrder !== expectedUnitOrder) fail(`${location}.unitOrder`, `must equal ${expectedUnitOrder}`);
    if (unit.catalogOrder !== index + 1) fail(`${location}.catalogOrder`, `must equal ${index + 1}`);
    if (catalogOrders.has(unit.catalogOrder)) fail(`${location}.catalogOrder`, "must be globally unique");
    catalogOrders.add(unit.catalogOrder);
    if (typeof unit.slug !== "string" || !SLUG.test(unit.slug)) fail(`${location}.slug`, "must be a lowercase hyphenated slug");
    else if (slugs.has(unit.slug)) fail(`${location}.slug`, `duplicates ${slugs.get(unit.slug)}`);
    else slugs.set(unit.slug, location);
    text(unit.title, `${location}.title`);
    if (titles.has(unit.title)) fail(`${location}.title`, `duplicates ${titles.get(unit.title)}`);
    else titles.set(unit.title, location);
    text(unit.internalObjective, `${location}.internalObjective`);
    if (!Array.isArray(unit.achievementCodes) || unit.achievementCodes.length === 0) fail(`${location}.achievementCodes`, "must be a non-empty array");
    for (const [codeIndex, code] of (Array.isArray(unit.achievementCodes) ? unit.achievementCodes : []).entries()) {
      if (typeof code !== "string" || !CODE.test(code)) fail(`${location}.achievementCodes[${codeIndex}]`, "has an invalid code format");
      else if (!ACHIEVEMENT_CODES.has(code)) fail(`${location}.achievementCodes[${codeIndex}]`, "is not a known mapped achievement code");
    }
    if (!Array.isArray(unit.prerequisiteUnitSlugs)) fail(`${location}.prerequisiteUnitSlugs`, "must be an array");
    if (unit.recommendationLevel !== "초등 2") fail(`${location}.recommendationLevel`, "must equal 초등 2");
    if (exact(unit.recommendation, RECOMMENDATION_FIELDS, `${location}.recommendation`)) {
      const recommendation = unit.recommendation;
      if (!RECOMMENDATION_SUBJECTS.includes(recommendation.subject)) fail(`${location}.recommendation.subject`, "is not an allowed subject");
      const startIndex = RECOMMENDATION_LEVELS.indexOf(recommendation.recommendedStartLevelCode);
      const endIndex = recommendation.recommendedEndLevelCode === null ? null : RECOMMENDATION_LEVELS.indexOf(recommendation.recommendedEndLevelCode);
      if (startIndex === -1) fail(`${location}.recommendation.recommendedStartLevelCode`, "is not an allowed level code");
      if (endIndex === -1) fail(`${location}.recommendation.recommendedEndLevelCode`, "is not an allowed level code or null");
      if (startIndex !== -1 && endIndex !== null && endIndex !== -1 && startIndex > endIndex) fail(`${location}.recommendation`, "start level must not be higher than end level");
      if (!Number.isInteger(recommendation.parentSortOrder) || recommendation.parentSortOrder < 1 || recommendation.parentSortOrder > 10000) {
        fail(`${location}.recommendation.parentSortOrder`, "must be an integer from 1 to 10000");
      } else if (parentSortOrders.has(recommendation.parentSortOrder)) {
        fail(`${location}.recommendation.parentSortOrder`, "must be globally unique");
      } else {
        parentSortOrders.add(recommendation.parentSortOrder);
      }
      if (recommendation.parentSortOrder !== unit.catalogOrder) fail(`${location}.recommendation.parentSortOrder`, "must equal catalogOrder");
    }
    if (!STATUSES.has(unit.status)) fail(`${location}.status`, "is not allowed");
    text(unit.sourceNote, `${location}.sourceNote`);
  }
  if (parentSortOrders.size === 12 && !Array.from({ length: 12 }, (_, index) => index + 1).every((value) => parentSortOrders.has(value))) {
    fail("$.units", "recommendation parentSortOrder values must be continuous from 1 to 12");
  }

  for (const [index, unit] of (Array.isArray(curriculum.units) ? curriculum.units : []).entries()) {
    if (!Array.isArray(unit.prerequisiteUnitSlugs)) continue;
    for (const prerequisite of unit.prerequisiteUnitSlugs) {
      if (!slugs.has(prerequisite)) fail(`$.units[${index}].prerequisiteUnitSlugs`, `references unknown unit ${prerequisite}`);
      if (prerequisite === unit.slug) fail(`$.units[${index}].prerequisiteUnitSlugs`, "must not reference itself");
    }
  }
  const visiting = new Set();
  const visited = new Set();
  const unitBySlug = new Map((curriculum.units || []).map((unit) => [unit.slug, unit]));
  function visit(slug, trail) {
    if (visiting.has(slug)) {
      fail("$.units", `contains a prerequisite cycle: ${[...trail, slug].join(" -> ")}`);
      return;
    }
    if (visited.has(slug)) return;
    visiting.add(slug);
    for (const prerequisite of unitBySlug.get(slug)?.prerequisiteUnitSlugs || []) visit(prerequisite, [...trail, slug]);
    visiting.delete(slug);
    visited.add(slug);
  }
  for (const slug of unitBySlug.keys()) visit(slug, []);
  return { valid: errors.length === 0, errors };
}

function loadAndValidateCurriculum(filePath) {
  const absolute = path.resolve(filePath);
  const curriculum = JSON.parse(fs.readFileSync(absolute, "utf8"));
  const result = validateCurriculum(curriculum);
  if (!result.valid) throw new Error(result.errors.join("\n"));
  return curriculum;
}

if (require.main === module) {
  try {
    const target = process.argv[2];
    if (!target) throw new Error("Usage: node scripts/validate-learning-curriculum.js <curriculum.json>");
    const curriculum = loadAndValidateCurriculum(target);
    console.log(`valid: ${target} (${curriculum.units.length} units)`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { ACHIEVEMENT_CODES, validateCurriculum, loadAndValidateCurriculum };
