const { env, json } = require("./_utils");

module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return json(response, 405, { error: "Method not allowed." });
  }

  const publicKey = env("VAPID_PUBLIC_KEY");
  return json(response, 200, {
    configured: Boolean(publicKey),
    publicKey,
  });
};
