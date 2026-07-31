const fs = require("node:fs");
const path = require("node:path");

function recommendationFixture() {
  const fixture = structuredClone(JSON.parse(fs.readFileSync(
    path.join(__dirname, "..", "..", "content", "learning", "math", "make-ten-v2.json"),
    "utf8",
  )));
  let sequence = 1;
  const replaceId = (item) => {
    item.id = `72000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;
    sequence += 1;
  };
  replaceId(fixture.course);
  replaceId(fixture.unit);
  replaceId(fixture.version);
  for (const stage of fixture.stages) {
    replaceId(stage);
    for (const question of stage.questions) {
      replaceId(question);
      for (const option of question.options) replaceId(option);
    }
  }
  fixture.course.slug = "grade2-math";
  fixture.course.internalName = "Grade 2 Math";
  fixture.unit.slug = "grade2-recommendation-fixture";
  fixture.unit.title = "테스트 단원";
  fixture.unit.displayOrder = 1;
  fixture.version.label = "v1";
  fixture.version.number = 1;
  fixture.recommendation = {
    subject: "math",
    recommendedStartLevelCode: "elementary_2",
    recommendedEndLevelCode: "elementary_2",
    parentSortOrder: 1,
  };
  return fixture;
}

module.exports = { recommendationFixture };
