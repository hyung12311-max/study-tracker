const fs = require("node:fs");
const path = require("node:path");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SLUG = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const VERSION = /^v[1-9][0-9]*$/;
const DIFFICULTIES = ["seed", "leaf", "tree", "crown"];
const FORBIDDEN_CHILD_TEXT = /(학년|교육과정|커리큘럼|content version|version|버전|uuid|관리자|내부용)/i;

const fields = Object.freeze({
  root: ["schemaVersion", "course", "unit", "version", "stages"],
  course: ["id", "slug", "internalName", "subject"],
  unit: ["id", "slug", "title", "displayOrder"],
  version: ["id", "label", "number"],
  stage: ["id", "difficulty", "title", "displayOrder", "questions"],
  question: ["id", "displayOrder", "weight", "prompt", "explanation", "options"],
  option: ["id", "displayOrder", "text", "isCorrect"],
});

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function validateLearningContent(content) {
  const errors = [];
  const ids = new Map();
  const fail = (location, message) => errors.push(`${location}: ${message}`);
  const object = (value, location) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      fail(location, "must be an object");
      return false;
    }
    return true;
  };
  const exactFields = (value, location, allowed) => {
    if (!object(value, location)) return false;
    for (const key of allowed) {
      if (!Object.hasOwn(value, key)) fail(`${location}.${key}`, "is required");
    }
    for (const key of Object.keys(value)) {
      if (!allowed.includes(key)) fail(`${location}.${key}`, "is not allowed");
    }
    return true;
  };
  const text = (value, location, max, childFacing = false) => {
    if (typeof value !== "string" || value.length === 0) {
      fail(location, "must be a non-empty string");
      return;
    }
    if (value.trim() !== value) fail(location, "must not have surrounding whitespace");
    if (value.length > max) fail(location, `must be at most ${max} characters`);
    if (childFacing && FORBIDDEN_CHILD_TEXT.test(value)) {
      fail(location, "contains child-facing internal or curriculum wording");
    }
  };
  const uuid = (value, location) => {
    if (typeof value !== "string" || !UUID.test(value)) {
      fail(location, "must be a lowercase UUID v4");
      return;
    }
    if (ids.has(value)) fail(location, `duplicates ${ids.get(value)}`);
    else ids.set(value, location);
  };
  const order = (value, expected, location) => {
    if (!Number.isInteger(value) || value !== expected) {
      fail(location, `must equal ${expected}`);
    }
  };

  if (!exactFields(content, "$", fields.root)) return { valid: false, errors };
  if (content.schemaVersion !== 1) fail("$.schemaVersion", "must equal 1");

  if (exactFields(content.course, "$.course", fields.course)) {
    uuid(content.course.id, "$.course.id");
    if (typeof content.course.slug !== "string" || !SLUG.test(content.course.slug)) {
      fail("$.course.slug", "must be a lowercase slug");
    }
    text(content.course.internalName, "$.course.internalName", 200);
    text(content.course.subject, "$.course.subject", 120);
  }
  if (exactFields(content.unit, "$.unit", fields.unit)) {
    uuid(content.unit.id, "$.unit.id");
    if (typeof content.unit.slug !== "string" || !SLUG.test(content.unit.slug)) {
      fail("$.unit.slug", "must be a lowercase slug");
    }
    text(content.unit.title, "$.unit.title", 200, true);
    order(content.unit.displayOrder, 1, "$.unit.displayOrder");
  }
  if (exactFields(content.version, "$.version", fields.version)) {
    uuid(content.version.id, "$.version.id");
    if (typeof content.version.label !== "string" || !VERSION.test(content.version.label)) {
      fail("$.version.label", "must match v<positive integer>");
    }
    if (!Number.isInteger(content.version.number) || content.version.number < 1) {
      fail("$.version.number", "must be a positive integer");
    } else if (content.version.label !== `v${content.version.number}`) {
      fail("$.version", "label and number must identify the same version");
    }
  }

  if (!Array.isArray(content.stages) || content.stages.length !== 4) {
    fail("$.stages", "must contain exactly 4 stages");
  }
  let questionCount = 0;
  let optionCount = 0;
  for (const [stageIndex, stage] of (Array.isArray(content.stages) ? content.stages : []).entries()) {
    const stagePath = `$.stages[${stageIndex}]`;
    if (!exactFields(stage, stagePath, fields.stage)) continue;
    uuid(stage.id, `${stagePath}.id`);
    order(stage.displayOrder, stageIndex + 1, `${stagePath}.displayOrder`);
    if (stage.difficulty !== DIFFICULTIES[stageIndex]) {
      fail(`${stagePath}.difficulty`, `must equal ${DIFFICULTIES[stageIndex]}`);
    }
    text(stage.title, `${stagePath}.title`, 200, true);
    if (!Array.isArray(stage.questions) || stage.questions.length !== 5) {
      fail(`${stagePath}.questions`, "must contain exactly 5 questions");
    }
    for (const [questionIndex, question] of (Array.isArray(stage.questions) ? stage.questions : []).entries()) {
      questionCount += 1;
      const questionPath = `${stagePath}.questions[${questionIndex}]`;
      if (!exactFields(question, questionPath, fields.question)) continue;
      uuid(question.id, `${questionPath}.id`);
      order(question.displayOrder, questionIndex + 1, `${questionPath}.displayOrder`);
      if (question.weight !== 1) fail(`${questionPath}.weight`, "must equal 1");
      text(question.prompt, `${questionPath}.prompt`, 300, true);
      text(question.explanation, `${questionPath}.explanation`, 400, true);
      if (!Array.isArray(question.options) || question.options.length !== 4) {
        fail(`${questionPath}.options`, "must contain exactly 4 options");
      }
      const optionTexts = new Set();
      let correctCount = 0;
      for (const [optionIndex, option] of (Array.isArray(question.options) ? question.options : []).entries()) {
        optionCount += 1;
        const optionPath = `${questionPath}.options[${optionIndex}]`;
        if (!exactFields(option, optionPath, fields.option)) continue;
        uuid(option.id, `${optionPath}.id`);
        order(option.displayOrder, optionIndex + 1, `${optionPath}.displayOrder`);
        text(option.text, `${optionPath}.text`, 100, true);
        if (optionTexts.has(option.text)) fail(`${optionPath}.text`, "duplicates another option in this question");
        optionTexts.add(option.text);
        if (typeof option.isCorrect !== "boolean") fail(`${optionPath}.isCorrect`, "must be boolean");
        if (option.isCorrect === true) correctCount += 1;
      }
      if (correctCount !== 1) fail(`${questionPath}.options`, "must contain exactly one correct option");
    }
  }
  if (questionCount !== 20) fail("$.stages", `must contain 20 questions, found ${questionCount}`);
  if (optionCount !== 80) fail("$.stages", `must contain 80 options, found ${optionCount}`);
  return { valid: errors.length === 0, errors };
}

function loadAndValidate(filePath) {
  const absolute = path.resolve(filePath);
  let content;
  try {
    content = JSON.parse(fs.readFileSync(absolute, "utf8"));
  } catch (error) {
    throw new Error(`${absolute}: ${error.message}`);
  }
  const result = validateLearningContent(content);
  if (!result.valid) throw new Error(result.errors.join("\n"));
  return content;
}

if (require.main === module) {
  const target = process.argv[2];
  if (!target) {
    console.error("Usage: node scripts/validate-learning-content.js <content.json>");
    process.exitCode = 2;
  } else {
    try {
      const content = loadAndValidate(target);
      const questions = content.stages.reduce((count, stage) => count + stage.questions.length, 0);
      console.log(`valid: ${target} (${content.stages.length} stages, ${questions} questions)`);
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}

module.exports = { canonicalJson, loadAndValidate, validateLearningContent };
