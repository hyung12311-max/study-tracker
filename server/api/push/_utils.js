const webPush = require("web-push");

const json = (response, status, body) => {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
};

const readJson = (request) => new Promise((resolve, reject) => {
  let body = "";
  request.on("data", (chunk) => {
    body += chunk;
    if (body.length > 1024 * 1024) {
      reject(new Error("Request body is too large."));
      request.destroy();
    }
  });
  request.on("end", () => {
    if (!body) return resolve({});
    try {
      resolve(JSON.parse(body));
    } catch (error) {
      reject(new Error("Invalid JSON body."));
    }
  });
  request.on("error", reject);
});

function env(name) {
  return process.env[name] || "";
}

function requireEnv(names) {
  const missing = names.filter((name) => !env(name));
  if (missing.length) {
    const error = new Error(`Missing environment variables: ${missing.join(", ")}`);
    error.statusCode = 500;
    error.code = "ENV_MISSING";
    error.missingEnvironmentVariables = missing;
    throw error;
  }
}

function configureWebPush() {
  console.log("[webpush/configure] env", {
    VAPID_PUBLIC_KEY: Boolean(env("VAPID_PUBLIC_KEY")),
    VAPID_PRIVATE_KEY: Boolean(env("VAPID_PRIVATE_KEY")),
    VAPID_SUBJECT: Boolean(env("VAPID_SUBJECT")),
    VAPID_PUBLIC_KEY_LENGTH: env("VAPID_PUBLIC_KEY").length,
    VAPID_SUBJECT_VALUE: env("VAPID_SUBJECT") || null,
  });
  requireEnv(["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"]);
  console.log("[webpush/configure] before setVapidDetails");
  webPush.setVapidDetails(env("VAPID_SUBJECT"), env("VAPID_PUBLIC_KEY"), env("VAPID_PRIVATE_KEY"));
  console.log("[webpush/configure] after setVapidDetails");
}

async function supabaseFetch(path, options = {}) {
  requireEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  const baseUrl = env("SUPABASE_URL").replace(/\/$/, "");
  let response;
  try {
    response = await fetch(`${baseUrl}/rest/v1/${path}`, {
      ...options,
      headers: {
        apikey: env("SUPABASE_SERVICE_ROLE_KEY"),
        Authorization: `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
  } catch (cause) {
    const error = new Error("Unable to connect to Supabase.");
    error.statusCode = 502;
    error.code = "SUPABASE_CONNECTION_FAILED";
    error.causeMessage = cause?.message || String(cause);
    throw error;
  }
  if (!response.ok) {
    const text = await response.text();
    let details = {};
    try { details = text ? JSON.parse(text) : {}; } catch { details = { message: text.slice(0, 500) }; }
    const error = new Error("Supabase rejected the request.");
    error.statusCode = response.status >= 500 ? 502 : response.status;
    error.code = "SUPABASE_REQUEST_FAILED";
    error.supabaseStatus = response.status;
    error.supabaseCode = details.code || null;
    error.supabaseMessage = details.message || details.hint || "Supabase request failed.";
    throw error;
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function normalizeSubscription(row) {
  return {
    endpoint: row.endpoint,
    keys: {
      p256dh: row.p256dh,
      auth: row.auth,
    },
  };
}

function validateSubscriptionPayload(subscription) {
  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const auth = subscription?.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    const error = new Error("endpoint, keys.p256dh, and keys.auth are required.");
    error.statusCode = 400;
    throw error;
  }
  const url = new URL(endpoint);
  if (url.protocol !== "https:") {
    const error = new Error("Push endpoint must be HTTPS.");
    error.statusCode = 400;
    throw error;
  }
  return { endpoint, p256dh, auth };
}

async function markInactive(endpoint) {
  await supabaseFetch(`push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`, {
    method: "PATCH",
    body: JSON.stringify({ is_active: false }),
  });
}

function methodNotAllowed(response) {
  response.setHeader("Allow", "GET, POST");
  return json(response, 405, { error: "Method not allowed." });
}

module.exports = {
  configureWebPush,
  env,
  json,
  markInactive,
  methodNotAllowed,
  normalizeSubscription,
  readJson,
  requireEnv,
  supabaseFetch,
  validateSubscriptionPayload,
  webPush,
};
