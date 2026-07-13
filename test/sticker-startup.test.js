const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("sticker startup never renders a cached or fallback count", () => {
  const html = read("index.html");
  const app = read("js/app.js");
  const rewardStore = read("js/reward-store.js");

  assert.match(html, /id="stickerCount">-</);
  assert.doesNotMatch(app, /cached\.stickerCount|localData\.stickerCount/);
  assert.doesNotMatch(app, /client\.from\("sticker_history"\)/);
  assert.doesNotMatch(app, /\$\("#stickerCount"\)\.textContent/);
  assert.match(rewardStore, /count\.textContent="-"/);
  assert.match(rewardStore, /count\.textContent=String\(value\)/);
  assert.match(rewardStore, /currentMemberKey!==memberKey/);
});

test("service worker keeps API data out of cache and rotates the app shell cache", () => {
  const worker = read("service-worker.js");

  assert.match(worker, /hagyeom-study-sticker-v45/);
  assert.match(worker, /url\.pathname\.startsWith\("\/api\/"\)/);
  assert.match(worker, /networkFirst\(event\.request\)/);
});
