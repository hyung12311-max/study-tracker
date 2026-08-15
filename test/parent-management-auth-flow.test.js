const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js", "app.js"), "utf8");
const familyChat = fs.readFileSync(path.join(root, "js", "family-chat.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const familyPinApi = fs.readFileSync(path.join(root, "server", "api", "family", "pin.js"), "utf8");
const bookPlansApi = fs.readFileSync(path.join(root, "server", "api", "study", "book-plans.js"), "utf8");

test("authenticated Parent enters parent management without a duplicate password dialog", () => {
  assert.match(app, /function enterParentMode\(\) \{\s*if \(familyChatController\?\.currentMember\(\)\?\.role !== "parent"\) \{[\s\S]*?return;[\s\S]*?\}\s*isParentMode = true;/);
  assert.match(app, /#parentAccessButton"\)\.addEventListener\("click", enterParentMode\)/);
  assert.match(app, /viewName === "parent" && !isParentMode[\s\S]*?enterParentMode\(\);[\s\S]*?return;/);
  assert.doesNotMatch(app, /PARENT_PASSWORD|openPasswordDialog|handlePasswordSubmit|passwordDialog|parentPasswordInput/);
  assert.doesNotMatch(html, /id="passwordDialog"|id="passwordForm"|id="parentPasswordInput"/);
});

test("Child and unauthenticated actors remain outside parent management", () => {
  assert.match(app, /currentMember\(\)\?\.role !== "parent"/);
  assert.match(app, /부모 사용자로 인증해야 부모관리를 이용할 수 있어요/);
  assert.match(app, /if \(!parentAuthenticated\) isParentMode = false/);
  assert.match(app, /#parentAccessButton"\)\.hidden = isParentMode \|\| !parentAuthenticated/);
});

test("Parent selection still verifies the family PIN before creating the session", () => {
  assert.match(familyChat, /selected\.role\s*===\s*"child"/);
  assert.match(familyChat, /request\("\/api\/family\/verify-pin"/);
  assert.match(familyChat, /body:JSON\.stringify\(\{memberId:selected\.id,pin,/);
  assert.doesNotMatch(familyChat, /memberKey:selected\.member_key,pin/);
  assert.match(html, /id="familyPinInput"[^>]*pattern="\[0-9\]\{4\}"/);
});

test("Parent-only APIs keep server-side Parent authorization", () => {
  assert.match(familyPinApi, /authenticateActiveMember\(req,\{requiredRole:"parent"\}\)/);
  assert.match(bookPlansApi, /authenticate\(request, "parent"\)/);
});
