const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = Number(process.env.PORT || 5500);
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
};

http.createServer((request, response) => {
  const urlPath = decodeURIComponent(request.url.split("?")[0]);
  if (urlPath.startsWith("/api/")) {
    try {
      const handler = require(path.join(root, "api", "[...path].js"));
      Promise.resolve(handler(request, response)).catch((error) => {
        console.error("[dev api] request failed", { path: urlPath, message: error.message });
        if (!response.headersSent) response.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
        if (!response.writableEnded) response.end(JSON.stringify({ error: "Local API request failed." }));
      });
    } catch (error) {
      console.error("[dev api] router unavailable", { path: urlPath, message: error.message });
      response.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ error: "Local API router unavailable." }));
    }
    return;
  }
  const relativePath = urlPath === "/" ? "index.html" : urlPath.slice(1);
  const filePath = path.normalize(path.join(root, relativePath));

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, body) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    response.writeHead(200, { "Content-Type": types[path.extname(filePath)] || "text/plain" });
    response.end(body);
  });
}).listen(port, "127.0.0.1", () => {
  console.log(`Study tracker running at http://127.0.0.1:${port}`);
});
