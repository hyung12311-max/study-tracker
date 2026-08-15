const { json } = require("./_utils");

module.exports = async function handler(request, response) {
  return json(response, 410, {
    ok: false,
    error: "This push endpoint has been retired.",
    code: "PUSH_ENDPOINT_RETIRED",
  });
};
