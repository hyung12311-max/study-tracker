const test = require("node:test");
const assert = require("node:assert/strict");
const { Readable } = require("node:stream");
const { EventEmitter } = require("node:events");
const { readJson } = require("../server/api/push/_utils");

const LIMIT = 1024 * 1024;
const parse = chunks => readJson(Readable.from(chunks));
const parserError = message => error => {
  assert.equal(error.constructor, Error);
  assert.equal(error.message, message);
  assert.equal(error.statusCode, undefined);
  assert.equal(error.code, undefined);
  return true;
};

for (const text of ["ASCII", "한글 이름", "🧒🐻"]) {
  test(`readJson preserves single-chunk ${text}`, async () => {
    const value = { text };
    assert.deepEqual(await parse([Buffer.from(JSON.stringify(value))]), value);
  });
}

for (const text of ["한", "🧒"]) {
  test(`readJson preserves every byte split inside ${text}`, async () => {
    const value = { text }, bytes = Buffer.from(JSON.stringify(value));
    const start = bytes.indexOf(Buffer.from(text));
    for (let offset = 1; offset < Buffer.byteLength(text); offset++) {
      const split = start + offset;
      assert.deepEqual(await parse([bytes.subarray(0, split), bytes.subarray(split)]), value);
    }
  });
}

test("readJson preserves mixed multibyte JSON delivered one byte at a time", async () => {
  const value = { 이름: "한글🧒🐻", nested: ["가", "😀", 42, true, null] };
  const bytes = Buffer.from(JSON.stringify(value));
  assert.deepEqual(await parse(Array.from(bytes, (_, index) => bytes.subarray(index, index + 1))), value);
});

test("readJson accepts decoded string chunks and mixed string/Buffer chunks", async () => {
  assert.deepEqual(await parse(['{"text":"', "한🧒", Buffer.from('"}')]), { text: "한🧒" });
});

test("readJson returns an empty object for an empty body", async () => {
  assert.deepEqual(await parse([]), {});
  assert.deepEqual(await parse([Buffer.alloc(0), ""]), {});
});

test("readJson retains a generic malformed JSON error", async () => {
  for (const body of ['{"private-body":', "   "]) {
    await assert.rejects(parse([Buffer.from(body)]), parserError("Invalid JSON body."));
  }
});

test("readJson retains JSON values without Content-Type validation", async () => {
  for (const value of [null, false, 42, "text", [1, 2]]) {
    const request = Readable.from([Buffer.from(JSON.stringify(value))]);
    request.headers = { "content-type": "text/plain" };
    assert.deepEqual(await readJson(request), value);
  }
});

test("readJson accepts valid JSON at exactly the byte limit", async () => {
  const value = "a".repeat(LIMIT - 2), bytes = Buffer.from(JSON.stringify(value));
  assert.equal(bytes.length, LIMIT);
  assert.equal(await parse([bytes.subarray(0, 17), bytes.subarray(17)]), value);
});

test("readJson rejects one byte over the limit and destroys the request", async () => {
  const bytes = Buffer.from(JSON.stringify("a".repeat(LIMIT - 1)));
  assert.equal(bytes.length, LIMIT + 1);
  const request = Readable.from([bytes.subarray(0, LIMIT), bytes.subarray(LIMIT)]);
  await assert.rejects(readJson(request), parserError("Request body is too large."));
  assert.equal(request.destroyed, true);
});

test("readJson enforces byte limits for multibyte Buffer and string bodies", async () => {
  const value = "한".repeat(Math.floor((LIMIT - 2) / 3)) + "aa";
  const body = JSON.stringify(value);
  assert.equal(Buffer.byteLength(body), LIMIT);
  assert.ok(body.length < LIMIT);
  for (const chunk of [body, Buffer.from(body)]) assert.equal(await parse([chunk]), value);
  // Trailing whitespace remains valid JSON but puts this body one byte over.
  for (const chunk of [body + " ", Buffer.from(body + " ")]) {
    await assert.rejects(parse([chunk]), parserError("Request body is too large."));
  }
});

test("readJson forwards the original stream error", async () => {
  const request = new Readable({ read() {} });
  const error = new Error("stream failure");
  const pending = readJson(request);
  request.push(Buffer.from('{"text":'));
  request.destroy(error);
  await assert.rejects(pending, actual => actual === error);
});

test("readJson preserves event-only stream support and ignores data after overflow", async () => {
  const request = new EventEmitter();
  let destroyed = 0;
  request.destroy = () => { destroyed++; };
  const pending = readJson(request);
  request.emit("data", Buffer.alloc(LIMIT, 32));
  request.emit("data", Buffer.from(" "));
  request.emit("data", Buffer.from("more data"));
  request.emit("end");
  await assert.rejects(pending, parserError("Request body is too large."));
  assert.equal(destroyed, 1);
});
