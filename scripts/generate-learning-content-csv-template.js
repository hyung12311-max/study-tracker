const fs = require("node:fs");
const path = require("node:path");
const { encodeCsv, resolveAllowedOutput } = require("./learning-content-csv");
const { loadAndValidateCurriculum } = require("./validate-learning-curriculum");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_CURRICULUM = "content/learning/curriculum/math/grade-2-2022.json";
const DEFAULT_UNITS = "content/learning/templates/grade2-math-units.csv";
const DEFAULT_QUESTIONS = "content/learning/templates/grade2-math-questions.csv";
const UNIT_HEADERS = ["curriculum_id", "grade_level", "semester", "domain", "unit_order", "catalog_order", "unit_slug", "unit_title", "recommendation_level", "achievement_codes", "prerequisite_unit_slugs", "content_version", "status"];
const QUESTION_HEADERS = ["unit_slug", "content_version", "stage", "question_order", "question_text", "option_1", "option_2", "option_3", "option_4", "correct_option", "explanation", "weight", "skill_code", "review_status", "review_note"];
const STAGES = ["seed", "leaf", "tree", "crown"];

function generateTemplateCsv(curriculum) {
  const units = curriculum.units.map((unit) => [
    curriculum.curriculumId, curriculum.operationalGrade, unit.semester, unit.domain, unit.unitOrder, unit.catalogOrder,
    unit.slug, unit.title, unit.recommendationLevel, unit.achievementCodes.join("|"), unit.prerequisiteUnitSlugs.join("|"), "v1", unit.status,
  ]);
  const questions = curriculum.units.flatMap((unit) => STAGES.flatMap((stage) => Array.from({ length: 10 }, (_, index) => [
    unit.slug, "v1", stage, index + 1, "", "", "", "", "", "", "", 1, "", "draft", "",
  ])));
  return { units: encodeCsv(UNIT_HEADERS, units), questions: encodeCsv(QUESTION_HEADERS, questions) };
}

function parseArguments(argv) {
  const options = { curriculum: DEFAULT_CURRICULUM, unitsOutput: DEFAULT_UNITS, questionsOutput: DEFAULT_QUESTIONS, force: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--force") options.force = true;
    else if (["--curriculum", "--units-output", "--questions-output"].includes(argument)) {
      const value = argv[++index];
      if (!value) throw new Error(`${argument} requires a value`);
      options[{ "--curriculum": "curriculum", "--units-output": "unitsOutput", "--questions-output": "questionsOutput" }[argument]] = value;
    } else throw new Error(`unknown argument: ${argument}`);
  }
  return options;
}

function writeTemplate(filePath, contents, force) {
  fs.writeFileSync(filePath, contents, { encoding: "utf8", flag: force ? "w" : "wx" });
}

if (require.main === module) {
  try {
    const options = parseArguments(process.argv.slice(2));
    const curriculum = loadAndValidateCurriculum(path.resolve(ROOT, options.curriculum));
    const unitsPath = resolveAllowedOutput(ROOT, options.unitsOutput, "content/learning/templates", "grade2-math-units.csv");
    const questionsPath = resolveAllowedOutput(ROOT, options.questionsOutput, "content/learning/templates", "grade2-math-questions.csv");
    const generated = generateTemplateCsv(curriculum);
    writeTemplate(unitsPath, generated.units, options.force);
    writeTemplate(questionsPath, generated.questions, options.force);
    console.log(`${unitsPath}\n${questionsPath}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { QUESTION_HEADERS, STAGES, UNIT_HEADERS, generateTemplateCsv, parseArguments };
