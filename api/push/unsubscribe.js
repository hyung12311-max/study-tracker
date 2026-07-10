const { json, methodNotAllowed, readJson, supabaseFetch } = require("./_utils");

module.exports = async function handler(request, response) {
  if (request.method !== "POST") return methodNotAllowed(response);

  try {
    const body = await readJson(request);
    if (!body.endpoint) return json(response, 400, { error: "endpoint is required." });

    await supabaseFetch(`push_subscriptions?endpoint=eq.${encodeURIComponent(body.endpoint)}`, {
      method: "PATCH",
      body: JSON.stringify({ is_active: false }),
    });

    return json(response, 200, { ok: true });
  } catch (error) {
    return json(response, error.statusCode || 500, { error: error.message });
  }
};
