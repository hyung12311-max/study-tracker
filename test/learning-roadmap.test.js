const assert = require("node:assert/strict");
const test = require("node:test");

const utils = require("../server/api/rewards/_utils");
const roadmapHandler = require("../server/api/learning/roadmap");

const FAMILY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PARENT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CHILD_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const COURSE_ID = "51000000-0000-4000-8000-000000000001";
const MAKE_TEN_UNIT_ID = "52000000-0000-4000-8000-000000000001";
const GRADE2_UNIT_ID = "52000000-0000-4000-8000-000000000002";
const MAKE_TEN_V1 = "53000000-0000-4000-8000-000000000001";
const MAKE_TEN_V2 = "53000000-0000-4000-8000-000000000002";
const GRADE2_V1 = "53000000-0000-4000-8000-000000000003";

function responseCapture() {
  return {
    statusCode: 0,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    end(value) { this.body = JSON.parse(value); },
  };
}

function request(method = "GET") {
  return {
    method,
    url: `/api/learning/roadmap?assignedMemberId=${CHILD_ID}`,
    headers: {},
  };
}

function replaceUtils(overrides) {
  const originals = {};
  for (const [key, value] of Object.entries(overrides)) {
    originals[key] = utils[key];
    utils[key] = value;
  }
  return () => Object.assign(utils, originals);
}

function parentMocks(supabaseFetch) {
  return {
    authenticate: (_request, role) => {
      assert.equal(role, "parent");
      return { sub: PARENT_ID, family: FAMILY_ID, role: "parent" };
    },
    memberInFamily: async () => ({
      id: PARENT_ID,
      family_id: FAMILY_ID,
      role: "parent",
      is_active: true,
    }),
    supabaseFetch,
  };
}

test("parent roadmap merges the curriculum order with published and assignment state", async () => {
  const queried = [];
  const restore = replaceUtils(parentMocks(async (path) => {
    queried.push(path);
    if (path.startsWith("family_members?")) {
      assert.match(path, new RegExp(`family_id=eq\\.${FAMILY_ID}`));
      assert.match(path, new RegExp(`id=eq\\.${CHILD_ID}`));
      return [{ id: CHILD_ID, family_id: FAMILY_ID, role: "child", is_active: true }];
    }
    if (path.startsWith("learning_courses?")) {
      assert.match(path, new RegExp(`id=eq\\.${COURSE_ID}`));
      assert.match(path, /course_code=eq\.math-core/);
      assert.match(path, /status=eq\.published/);
      return [{
        id: COURSE_ID,
        course_code: "math-core",
        internal_name: "수학 기초 과정",
        subject_name: "수학",
        status: "published",
      }];
    }
    if (path.startsWith("learning_units?")) {
      assert.match(path, /select=id,course_id,unit_code,display_title,sort_order/);
      return [
        { id: MAKE_TEN_UNIT_ID, course_id: COURSE_ID, unit_code: "make-ten", display_title: "10을 만들어요", sort_order: 1 },
        { id: GRADE2_UNIT_ID, course_id: COURSE_ID, unit_code: "grade2-three-digit-numbers", display_title: "세 자리 수를 알아봐요", sort_order: 2 },
      ];
    }
    if (path.startsWith("learning_content_versions?")) {
      assert.match(path, /status=eq\.published/);
      assert.match(path, /order=unit_id\.asc,version_no\.desc/);
      return [
        { id: MAKE_TEN_V2, unit_id: MAKE_TEN_UNIT_ID, version_no: 2 },
        { id: MAKE_TEN_V1, unit_id: MAKE_TEN_UNIT_ID, version_no: 1 },
        { id: GRADE2_V1, unit_id: GRADE2_UNIT_ID, version_no: 1 },
      ];
    }
    if (path.startsWith("learning_assignments?")) {
      assert.match(path, new RegExp(`family_id=eq\\.${FAMILY_ID}`));
      assert.match(path, new RegExp(`assigned_member_id=eq\\.${CHILD_ID}`));
      return [
        { unit_id: MAKE_TEN_UNIT_ID, status: "completed" },
        { unit_id: GRADE2_UNIT_ID, status: "completed" },
        { unit_id: GRADE2_UNIT_ID, status: "active" },
      ];
    }
    if (path.startsWith("learning_stages?")) {
      return [
        ...Array.from({ length: 4 }, () => ({ content_version_id: MAKE_TEN_V2 })),
        ...Array.from({ length: 4 }, () => ({ content_version_id: GRADE2_V1 })),
      ];
    }
    throw new Error(`Unexpected path: ${path}`);
  }));
  try {
    const response = responseCapture();
    await roadmapHandler(request(), response);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body.roadmap.course, {
      courseId: COURSE_ID,
      slug: "math-core",
      displayName: "수학 기초 과정",
      subject: "수학",
    });
    assert.equal(response.body.roadmap.preparationUnits.length, 1);
    assert.deepEqual(response.body.roadmap.preparationUnits[0], {
      unitId: MAKE_TEN_UNIT_ID,
      availability: "published",
      publishedVersion: { contentVersionId: MAKE_TEN_V2, versionNumber: 2, stageCount: 4 },
      assignmentState: "completed",
      userStatus: "completed",
      unitCode: "make-ten",
      displayTitle: "10을 만들어요",
      position: "before-curriculum",
    });
    const units = response.body.roadmap.curriculumUnits;
    assert.equal(units.length, 12);
    assert.deepEqual(units.map((unit) => unit.curriculumOrder), Array.from({ length: 12 }, (_, index) => index + 1));
    assert.equal(units[0].unitCode, "grade2-three-digit-numbers");
    assert.equal(units[0].availability, "published");
    assert.equal(units[0].assignmentState, "completed");
    assert.equal(units[0].userStatus, "completed");
    assert.deepEqual(units[0].publishedVersion, {
      contentVersionId: GRADE2_V1,
      versionNumber: 1,
      stageCount: 4,
    });
    assert.equal(units[0].recommendationLevel, "초등 2");
    assert.equal(units[1].unitCode, "grade2-shapes");
    assert.equal(units[1].availability, "preparing");
    assert.equal(units[1].publishedVersion, null);
    assert.equal(units[1].assignmentState, "unassigned");
    assert.equal(units[1].userStatus, "preparing");
    assert.deepEqual(units[2].prerequisiteUnitCodes, ["grade2-three-digit-numbers"]);
    assert.equal(queried.some((path) => /learning_questions|learning_question_options/.test(path)), false);
    assert.equal(response.headers["Cache-Control"], "no-store");
  } finally {
    restore();
  }
});

test("roadmap exposes one user status with completed, active, and cancelled precedence", () => {
  const states = roadmapHandler.assignmentStates([
    { unit_id: "available", status: "cancelled" },
    { unit_id: "assigned", status: "cancelled" },
    { unit_id: "assigned", status: "active" },
    { unit_id: "completed", status: "active" },
    { unit_id: "completed", status: "completed" },
  ]);
  const version = { id: GRADE2_V1 };
  assert.equal(states.get("available"), undefined);
  assert.equal(states.get("assigned"), "active");
  assert.equal(states.get("completed"), "completed");
  assert.equal(roadmapHandler.userStatus(null, "active"), "preparing");
  assert.equal(roadmapHandler.userStatus(version, "unassigned"), "available");
  assert.equal(roadmapHandler.userStatus(version, "active"), "assigned");
  assert.equal(roadmapHandler.userStatus(version, "completed"), "completed");
  assert.equal(roadmapHandler.userStatus(version, "cancelled"), "available");
});

test("child cannot access parent roadmap metadata", async () => {
  let queried = false;
  const restore = replaceUtils({
    authenticate: (_request, role) => {
      assert.equal(role, "parent");
      throw utils.err("활성 부모 권한이 필요합니다.", 403, "ACTIVE_PARENT_REQUIRED");
    },
    supabaseFetch: async () => { queried = true; return []; },
  });
  try {
    const response = responseCapture();
    await roadmapHandler(request(), response);
    assert.equal(response.statusCode, 403);
    assert.equal(queried, false);
    assert.doesNotMatch(JSON.stringify(response.body), /math-core|초등 2|recommendation/);
  } finally {
    restore();
  }
});

test("roadmap is read-only", async () => {
  const response = responseCapture();
  await roadmapHandler(request("POST"), response);
  assert.equal(response.statusCode, 405);
  assert.equal(response.headers.Allow, "GET");
});
