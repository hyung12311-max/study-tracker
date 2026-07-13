const assert = require("node:assert/strict");
const test = require("node:test");

const utils = require("../server/api/rewards/_utils");
const handler = require("../server/api/study/reading-plans");

function responseCapture() {
  return {
    statusCode: 0,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    end(value) { this.body = JSON.parse(value); },
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

async function createWith(body) {
  let rpcBody = null;
  const restore = replaceUtils({
    authenticate: () => ({ sub: "parent-id", family: "family-id", key: "mother", role: "parent" }),
    memberInFamily: async () => ({ id: "parent-id", role: "parent", is_active: true }),
    readJson: async () => body,
    supabaseFetch: async (path, options) => {
      assert.equal(path, "rpc/create_reading_plan");
      rpcBody = JSON.parse(options.body);
      return [{ reading_plan_id: "reading-id", generated_count: 12, first_study_date: "2026-07-13", last_study_date: "2026-08-07" }];
    },
  });
  try {
    const response = responseCapture();
    await handler({ method: "POST", headers: {} }, response);
    return { response, rpcBody };
  } finally {
    restore();
  }
}

test("free reading creates repeated habit dates without title or pages", async () => {
  const { response, rpcBody } = await createWith({ mode: "free", weekdays: [1, 3, 5] });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.generatedCount, 12);
  assert.equal(rpcBody.p_reading_mode, "free");
  assert.equal(rpcBody.p_book_title, null);
  assert.equal(rpcBody.p_start_page, null);
  assert.equal(rpcBody.p_end_page, null);
  assert.deepEqual(rpcBody.p_study_weekdays, [1, 3, 5]);
});

test("page reading keeps one optional title and one repeated page range", async () => {
  const { response, rpcBody } = await createWith({ mode: "pages", weekdays: [5, 1, 3, 3], bookTitle: "마법천자문", startPage: 20, endPage: 40 });
  assert.equal(response.statusCode, 200);
  assert.equal(rpcBody.p_reading_mode, "pages");
  assert.equal(rpcBody.p_book_title, "마법천자문");
  assert.equal(rpcBody.p_start_page, 20);
  assert.equal(rpcBody.p_end_page, 40);
  assert.deepEqual(rpcBody.p_study_weekdays, [1, 3, 5]);
});

test("page reading allows the book title to be empty", async () => {
  const { response, rpcBody } = await createWith({ mode: "pages", weekdays: [2, 4], startPage: 20, endPage: 40 });
  assert.equal(response.statusCode, 200);
  assert.equal(rpcBody.p_book_title, null);
  assert.equal(rpcBody.p_start_page, 20);
  assert.equal(rpcBody.p_end_page, 40);
});

test("page reading rejects an invalid page range before writing", async () => {
  let wrote = false;
  const restore = replaceUtils({
    authenticate: () => ({ sub: "parent-id", family: "family-id", role: "parent" }),
    memberInFamily: async () => ({ id: "parent-id", role: "parent", is_active: true }),
    readJson: async () => ({ mode: "pages", weekdays: [1], startPage: 40, endPage: 20 }),
    supabaseFetch: async () => { wrote = true; },
  });
  try {
    const response = responseCapture();
    await handler({ method: "POST", headers: {} }, response);
    assert.equal(response.statusCode, 400);
    assert.equal(response.body.code, "INVALID_READING_PAGES");
    assert.equal(wrote, false);
  } finally {
    restore();
  }
});
