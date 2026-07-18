// Pluggable lead store: JSON file (default, zero-setup) or MongoDB (true MERN).
// Both expose the same async interface: init(), insert(lead), list(), markEmailed(id).
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { config } from "../config.js";

// ── File store ────────────────────────────────────────────
function createFileStore() {
  const file = path.resolve(config.dataFile);

  async function readAll() {
    try {
      const raw = await fs.readFile(file, "utf8");
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  async function writeAll(rows) {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(rows, null, 2), "utf8");
  }

  return {
    mode: "file",
    async init() {
      await fs.mkdir(path.dirname(file), { recursive: true });
    },
    async insert(lead) {
      const rows = await readAll();
      const row = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...lead };
      rows.push(row);
      await writeAll(rows);
      return row;
    },
    async list() {
      const rows = await readAll();
      return rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    },
    async markEmailed(id, emailed = true) {
      const rows = await readAll();
      const row = rows.find((r) => r.id === id);
      if (row) {
        row.emailSent = emailed;
        await writeAll(rows);
      }
    },
    async remove(id) {
      const rows = await readAll();
      const next = rows.filter((r) => r.id !== id);
      await writeAll(next);
      return rows.length - next.length;
    },
  };
}

// ── Mongo store ───────────────────────────────────────────
async function createMongoStore() {
  const { default: mongoose } = await import("mongoose");
  // Fail fast (8s) instead of hanging indefinitely if Atlas is unreachable /
  // the IP isn't whitelisted — the caller falls back to the file store.
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 8000 });

  const LeadSchema = new mongoose.Schema(
    {
      name: String,
      email: { type: String, default: "" },
      kind: { type: String, default: "generated" }, // "generated" | "email_requested"
      category: { type: String, default: "" }, // Founder | Job Seeker | Agripreneur | ...
      source: { type: String, default: "" },
      linkedin: [String],
      website: [String],
      payload: { type: Object, default: {} },
      intros: { type: Object, default: {} },
      emailSent: { type: Boolean, default: false },
    },
    { timestamps: true }
  );

  const Lead = mongoose.models.Lead || mongoose.model("Lead", LeadSchema);

  const toDTO = (d) => ({
    id: String(d._id),
    createdAt: d.createdAt?.toISOString?.() || new Date().toISOString(),
    name: d.name,
    email: d.email,
    kind: d.kind || "generated",
    category: d.category || "",
    source: d.source || "",
    linkedin: d.linkedin || [],
    website: d.website || [],
    payload: d.payload || {},
    intros: d.intros || {},
    emailSent: !!d.emailSent,
  });

  return {
    mode: "mongo",
    async init() {},
    async insert(lead) {
      const doc = await Lead.create(lead);
      return toDTO(doc);
    },
    async list() {
      const docs = await Lead.find().sort({ createdAt: -1 }).lean({ virtuals: false });
      return docs.map((d) => toDTO({ ...d, createdAt: d.createdAt }));
    },
    async markEmailed(id, emailed = true) {
      await Lead.findByIdAndUpdate(id, { emailSent: emailed });
    },
    async remove(id) {
      try {
        const r = await Lead.findByIdAndDelete(id);
        return r ? 1 : 0;
      } catch {
        return 0; // invalid ObjectId, etc.
      }
    },
  };
}

let store = null;

export async function getStore() {
  if (store) return store;
  if (config.dbMode === "mongo") {
    try {
      store = await createMongoStore();
      console.log("[db] connected to MongoDB");
    } catch (e) {
      console.warn(`[db] MongoDB unavailable (${e.message}) — falling back to file store`);
      store = createFileStore();
    }
  } else {
    store = createFileStore();
  }
  await store.init();
  return store;
}
