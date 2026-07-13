const restore = require("./session-restore");
module.exports = async function legacyDeviceSession(request, response) {
  if (request.method !== "GET") return restore(request, response);
  request.method = "POST";
  request.body = {};
  return restore(request, response);
};
