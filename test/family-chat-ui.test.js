const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("family chat renders one author header with name, avatar, and time for every message", () => {
  const source = read("js/family-chat.js");

  assert.match(source, /sender\.className="family-message-sender"/);
  assert.match(source, /authorInfo\.className="family-message-author-info"/);
  assert.match(source, /name\.className="family-message-name"/);
  assert.match(source, /time\.className="family-message-time"/);
  assert.match(source, /row\.dataset\.memberKey=memberKey/);
  assert.doesNotMatch(source, /if\(!mine&&!grouped\)/);
  assert.equal((source.match(/stack\.append\(sender\)/g) || []).length, 1);
});

test("family chat author styles keep accessible mobile sizes and participant colors", () => {
  const styles = read("css/styles.css");

  assert.match(styles, /\.family-message-avatar[^}]*flex: 0 0 36px[^}]*font-size: 24px/s);
  assert.match(styles, /\.family-message-name[^}]*font-size: 15px[^}]*font-weight: 800/s);
  assert.match(styles, /\.family-message-time[^}]*font-size: 11px/s);
  for (const key of ["mother", "father", "hagyeom", "dayul"]) {
    assert.match(styles, new RegExp(`data-member-key="${key}"`));
  }
  assert.match(styles, /\.mine \.family-message-sender \{ flex-direction: row-reverse; text-align: right; \}/);
  assert.match(styles, /@media \(max-width:760px\)[\s\S]*\.family-message-stack \{ max-width: 84%; \}/);
  assert.match(styles, /\.family-message-delivery\.failed[^}]*cursor: pointer/s);
  assert.match(styles, /\.family-message-sender[^}]*width: max-content[^}]*max-width: 100%/s);
  assert.match(styles, /\.family-message-name[^}]*overflow: visible[^}]*text-overflow: clip[^}]*white-space: normal/s);
  assert.doesNotMatch(styles, /\.family-message-name[^}]*text-overflow: ellipsis/s);
});

test("family chat sends optimistically before starting the API request", () => {
  const source = read("js/family-chat.js");
  const sendStart = source.indexOf("function send(event)");
  const sendEnd = source.indexOf("async function savePushSubscription", sendStart);
  const send = source.slice(sendStart, sendEnd);

  assert.ok(sendStart >= 0);
  assert.ok(send.indexOf('input.value=""') < send.indexOf("mergeMessages([optimistic])"));
  assert.ok(send.indexOf("mergeMessages([optimistic])") < send.indexOf("appendMessages([optimistic]"));
  assert.ok(send.indexOf("appendMessages([optimistic]") < send.indexOf("persistOptimisticMessage(clientMessageId)"));
  assert.doesNotMatch(send, /await request/);
  assert.doesNotMatch(source, /state\.sending/);
  assert.match(source, /status:"sending",isOptimistic:true/);
  assert.match(source, /status:"failed"/);
  assert.match(source, /dataset\.retryClientMessageId/);
});

test("family chat reconciles optimistic, API, and realtime messages without a list reload", () => {
  const source = read("js/family-chat.js");
  const mergeStart = source.indexOf("function mergeMessages");
  const mergeEnd = source.indexOf("async function markRead", mergeStart);
  const merge = source.slice(mergeStart, mergeEnd);
  const realtimeStart = source.indexOf("async payload=>");
  const realtimeEnd = source.indexOf("}).subscribe", realtimeStart);
  const realtimeInsert = source.slice(realtimeStart, realtimeEnd);

  assert.ok(merge.indexOf("client_message_id===clientId") < merge.indexOf("message.id===incoming.id"));
  assert.match(merge, /isSameFallbackMessage/);
  assert.match(merge, /serverMessage\?"sent"/);
  assert.match(realtimeInsert, /payload\.new/);
  assert.match(realtimeInsert, /mergeMessages\(\[message\]\)/);
  assert.doesNotMatch(realtimeInsert, /loadMessages/);
});
