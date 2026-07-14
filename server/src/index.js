import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { getStore } from "./db/leadStore.js";
import { generateRouter } from "./routes/generate.js";
import { leadsRouter } from "./routes/leads.js";
import { searchRouter } from "./routes/search.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Optional admin protection: set ADMIN_PASSWORD in the environment to require
// HTTP Basic auth on /admin and /api/admin. Unset = open (local dev).
function adminGuard(req, res, next) {
  const pass = process.env.ADMIN_PASSWORD;
  if (!pass) return next();
  const hdr = req.headers.authorization || "";
  const decoded = hdr.startsWith("Basic ") ? Buffer.from(hdr.slice(6), "base64").toString() : "";
  if (decoded.split(":").slice(1).join(":") === pass) return next();
  res.set("WWW-Authenticate", 'Basic realm="Intro Generator Admin"');
  res.status(401).send("Authentication required");
}
app.use(["/admin", "/api/admin"], adminGuard);

app.get("/api/health", async (_req, res) => {
  const store = await getStore();
  res.json({
    ok: true,
    storage: store.mode,
    ai: { baseUrl: config.ai.baseUrl, model: config.ai.model },
    search: config.firecrawlKey ? "firecrawl" : "duckduckgo (free)",
  });
});

app.use("/api", generateRouter);
app.use("/api", leadsRouter);
app.use("/api", searchRouter);

// Standalone admin dashboard — a React app in the top-level /admin folder,
// deployable independently; the API serves its build for convenience.
const ADMIN_DIR = path.join(__dirname, "../../admin/dist");
app.use("/admin", express.static(ADMIN_DIR));
app.get("/admin", (_req, res) => res.sendFile(path.join(ADMIN_DIR, "index.html")));

// Production: serve the built React client from the same server, so one
// deployment (one subdomain) hosts app + API + admin. In dev, Vite serves
// the client on :5173 instead and this block finds no dist folder.
import fs from "node:fs";
const CLIENT_DIST = path.join(__dirname, "../../client/dist");
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get(/^\/(?!api\/|admin).*/, (_req, res) =>
    res.sendFile(path.join(CLIENT_DIST, "index.html"))
  );
  console.log("[web] serving client build from client/dist");
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Server error" });
});

async function start() {
  try {
    const store = await getStore();
    console.log(`[db] storage mode: ${store.mode}`);
  } catch (e) {
    console.error("[db] init failed:", e.message);
  }
  const server = app.listen(config.port, () => {
    console.log(`\n  Intro Generator API → http://localhost:${config.port}`);
    console.log(`  Admin dashboard      → http://localhost:${config.port}/admin`);
    console.log(`  AI: ${config.ai.model} @ ${config.ai.baseUrl}`);
    console.log(`  Search: ${config.firecrawlKey ? "Firecrawl" : "DuckDuckGo (free, no key)"}\n`);
  });
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `\n  Port ${config.port} is already in use — the server is probably already running.` +
          `\n  Check http://localhost:${config.port}/api/health` +
          `\n  Or stop the old one first:  taskkill /F /IM node.exe\n`
      );
      process.exit(1);
    }
    throw err;
  });
}

start();
