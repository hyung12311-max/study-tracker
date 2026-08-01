const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { parseCsv, resolveAllowedOutput, validateAuthoredText } = require("./learning-content-csv");
const { QUESTION_HEADERS, STAGES, UNIT_HEADERS } = require("./generate-learning-content-csv-template");
const { loadAndValidateCurriculum, validateCurriculum } = require("./validate-learning-curriculum");
const { validateLearningContent } = require("./validate-learning-content");

const ROOT = path.resolve(__dirname, "..");
const UUID_NAMESPACE = "studyplus.learning.grade2.csv.v1:9d87dc0b-9ac3-4bc8-8ccb-d905c0dbfc1e";
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VERSION = /^v([1-9][0-9]*)$/;
const CHILD_INTERNAL_WORDING = /(?:초등\s*2|2학년|교육과정|성취기준|content version|uuid)/i;

function deterministicUuid(...parts) {
  const digest = crypto.createHash("sha256").update([UUID_NAMESPACE, ...parts].join("\u001f"), "utf8").digest();
  const bytes = Buffer.from(digest.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function splitPipe(value) {
  return value === "" ? [] : value.split("|");
}

function assertUnitsMatch(curriculum, rows) {
  if (rows.length !== curriculum.units.length) throw new Error(`units CSV: expected 12 rows, found ${rows.length}`);
  for (const [index, unit] of curriculum.units.entries()) {
    const row = rows[index];
    const expected = {
      curriculum_id: curriculum.curriculumId,
      grade_level: curriculum.operationalGrade,
      semester: String(unit.semester),
      domain: unit.domain,
      unit_order: String(unit.unitOrder),
      catalog_order: String(unit.catalogOrder),
      unit_slug: unit.slug,
      unit_title: unit.title,
      recommendation_level: unit.recommendationLevel,
      achievement_codes: unit.achievementCodes.join("|"),
      prerequisite_unit_slugs: unit.prerequisiteUnitSlugs.join("|"),
      content_version: "v1",
      status: unit.status,
    };
    for (const header of UNIT_HEADERS) {
      if (row[header] !== expected[header]) throw new Error(`units CSV row ${row.__rowNumber} ${header}: must exactly match the curriculum map`);
    }
  }
}

function isAuthored(row) {
  return ["question_text", "option_1", "option_2", "option_3", "option_4", "correct_option", "explanation", "skill_code", "review_note"].some((field) => row[field] !== "") || row.review_status !== "draft";
}

function importUnit({ curriculum, unitsRows, questionRows, unitSlug }) {
  const curriculumResult = validateCurriculum(curriculum);
  if (!curriculumResult.valid) throw new Error(curriculumResult.errors.join("\n"));
  if (!SLUG.test(unitSlug)) throw new Error("--unit must be a valid lowercase slug");
  assertUnitsMatch(curriculum, unitsRows);
  const unit = curriculum.units.find((candidate) => candidate.slug === unitSlug);
  if (!unit) throw new Error(`unknown curriculum unit: ${unitSlug}`);
  const knownSlugs = new Set(curriculum.units.map((candidate) => candidate.slug));
  const positions = new Set();
  for (const row of questionRows) {
    if (!knownSlugs.has(row.unit_slug)) throw new Error(`questions CSV row ${row.__rowNumber}: unknown unit ${row.unit_slug}`);
    if (row.unit_slug !== unitSlug && isAuthored(row)) throw new Error(`questions CSV row ${row.__rowNumber}: authored content for another unit is not allowed`);
    const key = `${row.unit_slug}|${row.content_version}|${row.stage}|${row.question_order}`;
    if (positions.has(key)) throw new Error(`questions CSV row ${row.__rowNumber}: duplicate question position ${key}`);
    positions.add(key);
  }
  const selected = questionRows.filter((row) => row.unit_slug === unitSlug);
  if (selected.length !== 40) throw new Error(`${unitSlug}: expected 40 question rows, found ${selected.length}`);
  const versionLabels = new Set(selected.map((row) => row.content_version));
  if (versionLabels.size !== 1) throw new Error(`${unitSlug}: exactly one content version is required`);
  const versionLabel = [...versionLabels][0];
  const versionMatch = VERSION.exec(versionLabel);
  if (!versionMatch) throw new Error(`${unitSlug}: invalid content version ${versionLabel}`);

  const stages = STAGES.map((difficulty, stageIndex) => {
    const rows = selected.filter((row) => row.stage === difficulty).sort((left, right) => Number(left.question_order) - Number(right.question_order));
    if (rows.length !== 10) throw new Error(`${unitSlug}/${difficulty}: expected 10 questions, found ${rows.length}`);
    return {
      id: deterministicUuid("stage", unitSlug, versionLabel, difficulty),
      difficulty,
      title: ["입문", "기초", "심화", "최상위 도전!"][stageIndex],
      displayOrder: stageIndex + 1,
      questions: rows.map((row, questionIndex) => {
        const location = `questions CSV row ${row.__rowNumber}`;
        if (row.question_order !== String(questionIndex + 1)) throw new Error(`${location}: question_order must be ${questionIndex + 1}`);
        if (row.review_status !== "reviewed") throw new Error(`${location}: review_status must equal reviewed`);
        if (row.weight !== "1") throw new Error(`${location}: weight must equal 1`);
        const prompt = validateAuthoredText(row.question_text, `${location} question_text`, { max: 300 });
        const explanation = validateAuthoredText(row.explanation, `${location} explanation`, { max: 400 });
        validateAuthoredText(row.skill_code, `${location} skill_code`, { max: 100 });
        validateAuthoredText(row.review_note, `${location} review_note`, { required: false, max: 300 });
        if (CHILD_INTERNAL_WORDING.test(prompt) || CHILD_INTERNAL_WORDING.test(explanation)) throw new Error(`${location}: child-facing text exposes internal grade, curriculum, version, or UUID metadata`);
        if (!/^[1-4]$/.test(row.correct_option)) throw new Error(`${location}: correct_option must be 1, 2, 3, or 4`);
        const correctOption = Number(row.correct_option);
        const optionTexts = [1, 2, 3, 4].map((number) => validateAuthoredText(row[`option_${number}`], `${location} option_${number}`, { max: 100 }));
        if (new Set(optionTexts).size !== 4) throw new Error(`${location}: option text must be unique within the question`);
        const questionOrder = questionIndex + 1;
        return {
          id: deterministicUuid("question", unitSlug, versionLabel, difficulty, String(questionOrder)),
          displayOrder: questionOrder,
          weight: 1,
          prompt,
          explanation,
          options: optionTexts.map((text, optionIndex) => ({
            id: deterministicUuid("option", unitSlug, versionLabel, difficulty, String(questionOrder), String(optionIndex + 1)),
            displayOrder: optionIndex + 1,
            text,
            isCorrect: optionIndex + 1 === correctOption,
          })),
        };
      }),
    };
  });

  const content = {
    schemaVersion: 1,
    course: { ...curriculum.course },
    unit: {
      id: deterministicUuid("unit", unitSlug),
      slug: unitSlug,
      title: unit.title,
      displayOrder: unit.catalogOrder,
    },
    version: {
      id: deterministicUuid("version", unitSlug, versionLabel),
      label: versionLabel,
      number: Number(versionMatch[1]),
    },
    recommendation: {
      subject: unit.recommendation.subject,
      recommendedStartLevelCode: unit.recommendation.recommendedStartLevelCode,
      recommendedEndLevelCode: unit.recommendation.recommendedEndLevelCode,
      parentSortOrder: unit.recommendation.parentSortOrder,
    },
    stages,
  };
  const result = validateLearningContent(content);
  if (!result.valid) throw new Error(result.errors.join("\n"));
  return content;
}

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!["--curriculum", "--units", "--questions", "--unit", "--output"].includes(argument)) throw new Error(`unknown argument: ${argument}`);
    const value = argv[++index];
    if (!value) throw new Error(`${argument} requires a value`);
    options[argument.slice(2)] = value;
  }
  for (const required of ["curriculum", "units", "questions", "unit", "output"]) if (!options[required]) throw new Error(`--${required} is required`);
  return options;
}

function loadCsv(filePath, headers) {
  const absolute = path.resolve(ROOT, filePath);
  return parseCsv(fs.readFileSync(absolute, "utf8"), headers, absolute);
}

if (require.main === module) {
  try {
    const options = parseArguments(process.argv.slice(2));
    const curriculum = loadAndValidateCurriculum(path.resolve(ROOT, options.curriculum));
    const content = importUnit({
      curriculum,
      unitsRows: loadCsv(options.units, UNIT_HEADERS),
      questionRows: loadCsv(options.questions, QUESTION_HEADERS),
      unitSlug: options.unit,
    });
    const output = resolveAllowedOutput(ROOT, options.output, "content/learning/math", `${options.unit}-${content.version.label}.json`);
    fs.writeFileSync(output, `${JSON.stringify(content, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    console.log(output);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { UUID_NAMESPACE, deterministicUuid, importUnit, parseArguments };
