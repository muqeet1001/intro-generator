import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: Number(process.env.PORT || 5000),
  dbMode: (process.env.DB_MODE || "file").toLowerCase(), // "file" | "mongo"
  dataFile: process.env.DATA_FILE || "./data/leads.json",
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/intro_generator",
  ai: {
    baseUrl: (process.env.AI_BASE_URL || "http://localhost:11434/v1").replace(/\/$/, ""),
    apiKey: process.env.AI_API_KEY || "",
    model: process.env.AI_MODEL || "gemma4:e4b",
  },
  // SVTouch Lovable app's public MCP server — generation runs on Lovable AI credits.
  lovableMcpUrl: process.env.LOVABLE_MCP_URL || "",
  firecrawlKey: process.env.FIRECRAWL_API_KEY || "",
  serperKey: process.env.SERPER_API_KEY || "",
  googleKey: process.env.GOOGLE_API_KEY || "",
  googleCx: process.env.GOOGLE_CSE_ID || "",
  searchSiteFilter: process.env.SEARCH_SITE_FILTER || "site:linkedin.com/in",
};
