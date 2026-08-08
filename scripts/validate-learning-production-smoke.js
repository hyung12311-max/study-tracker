const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_CONTRACT = path.join(__dirname, "../docs/phase-f-production-smoke-contract.json");
const REQUIRED_READS = new Set([
  "planning", "scores", "attempt-history", "skills", "recommendations", "mistakes", "mistake-review",
]);
const REQUIRED_MUTATIONS = new Set(["reveal", "review-start", "review-answer", "review-abandon"]);
const REQUIRED_DENYLIST = new Set([
  "correctAnswer", "explanation", "family_id", "service_role", "sqlstate", "stack",
]);

function fail(message) {
  throw new Error(`Invalid Phase F production smoke contract: ${message}`);
}

function exactNames(rows, expected, label) {
  const names = new Set(rows.map((row) => row.name));
  if (names.size !== expected.size || [...expected].some((name) => !names.has(name))) {
    fail(`${label} names do not match the approved set`);
  }
}

function validateContract(contract) {
  if (!contract || typeof contract !== "object" || Array.isArray(contract)) fail("root must be an object");
  if (contract.version !== "phase-f-v1") fail("unsupported version");
  const baseUrl = new URL(contract.productionBaseUrl);
  if (baseUrl.protocol !== "https:" || baseUrl.pathname !== "/" || baseUrl.search || baseUrl.hash) {
    fail("productionBaseUrl must be one HTTPS origin");
  }
  if (contract.unitTestsPerformNetworkRequests !== false) fail("unit tests must not perform network requests");
  if (contract.productionMutationBudget !== 0) fail("production mutation budget must be zero");
  if (contract.base?.method !== "GET" || contract.base?.path !== "/") fail("base smoke must be GET /");
  if (!contract.base.expectedStatuses?.includes(200) || !contract.base.contentTypes?.includes("text/html")) {
    fail("base smoke must require HTTP 200 HTML");
  }
  if (!Array.isArray(contract.assets) || contract.assets.length < 5) fail("approved asset inventory is incomplete");
  for (const asset of contract.assets) {
    if (!asset.path?.startsWith("/") || !asset.contentType || !asset.markers?.length) fail("every asset needs path, content type, and markers");
  }
  if (!Array.isArray(contract.readOnlyEndpoints)) fail("readOnlyEndpoints must be an array");
  exactNames(contract.readOnlyEndpoints, REQUIRED_READS, "read-only endpoint");
  for (const endpoint of contract.readOnlyEndpoints) {
    if (endpoint.method !== "GET" || !endpoint.path.startsWith("/api/learning/")) fail(`${endpoint.name} must be a learning GET`);
  }
  const expectation = contract.unauthenticatedExpectation;
  if (!expectation || !expectation.statuses?.includes(401) || !expectation.statuses?.includes(403)) {
    fail("unauthenticated expectation must allow 401 and 403");
  }
  if (!expectation.codes?.includes("AUTH_REQUIRED") || expectation.privatePayloadAllowed !== false) {
    fail("unauthenticated responses must require auth and deny private payloads");
  }
  if (!Array.isArray(contract.mutationEndpoints)) fail("mutationEndpoints must be an array");
  exactNames(contract.mutationEndpoints, REQUIRED_MUTATIONS, "mutation endpoint");
  for (const endpoint of contract.mutationEndpoints) {
    if (endpoint.method !== "POST" || endpoint.guardOnly !== true || endpoint.execute !== false || endpoint.payload !== null) {
      fail(`${endpoint.name} must remain a non-executing guard-only POST contract`);
    }
  }
  const placeholders = contract.placeholderPolicy;
  if (!placeholders || placeholders.actualProductionIdentifiersAllowed !== false || placeholders.zeroUuidAllowed !== false || placeholders.nonNilUuidRequired !== true) {
    fail("placeholder identifiers must be non-production, non-zero UUIDs");
  }
  for (const endpoint of [...contract.readOnlyEndpoints, ...contract.mutationEndpoints]) {
    for (const placeholder of endpoint.path.matchAll(/\{([^}]+)\}/g)) {
      if (!placeholders.names.includes(placeholder[1])) fail(`unknown placeholder ${placeholder[1]}`);
    }
  }
  if (!Array.isArray(contract.privateResponseDenylist)) fail("private response denylist must be an array");
  for (const field of REQUIRED_DENYLIST) {
    if (!contract.privateResponseDenylist.includes(field)) fail(`denylist is missing ${field}`);
  }
  const uat = contract.authenticatedUiUat;
  if (!uat || uat.required !== false || uat.blocking !== false || uat.acquireCredentials !== false || uat.backlogWhenSessionUnavailable !== true) {
    fail("authenticated UI UAT must remain optional, non-blocking, and credential-free");
  }
  return contract;
}

function loadContract(file = DEFAULT_CONTRACT) {
  return validateContract(JSON.parse(fs.readFileSync(file, "utf8")));
}

if (require.main === module) {
  const contract = loadContract(process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_CONTRACT);
  process.stdout.write(`${JSON.stringify({
    ok: true,
    version: contract.version,
    assets: contract.assets.length,
    readOnlyEndpoints: contract.readOnlyEndpoints.length,
    mutationEndpointsExecuted: contract.mutationEndpoints.filter((endpoint) => endpoint.execute).length,
    productionMutationBudget: contract.productionMutationBudget,
  })}\n`);
}

module.exports = { DEFAULT_CONTRACT, loadContract, validateContract };
