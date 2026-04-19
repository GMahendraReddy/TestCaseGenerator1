import cors from "cors";
import express from "express";
import OpenAI from "openai";
import { getOpenRouterApiKey, loadEnv } from "./loadEnv.js";
import { buildTestCasesWorkbook } from "./services/excelService.js";
import { generateTestCasesWithOpenAI } from "./services/openaiService.js";

loadEnv();

const PORT = Number(process.env.PORT) || 5000;
const OPENROUTER_API_KEY = getOpenRouterApiKey();
const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini";

if (!OPENROUTER_API_KEY) {
  console.warn(
    [
      "Warning: OPENROUTER_API_KEY is not set or is still a placeholder.",
      "Add your key to `.env` in the project root or in `backend/.env`, e.g.:",
      "  OPENROUTER_API_KEY=sk-or-v1-...",
      "Get a key at https://openrouter.ai/keys — then restart the API.",
    ].join("\n")
  );
}

const openai = new OpenAI({
  apiKey: OPENROUTER_API_KEY ?? "missing-key",
  baseURL: "https://openrouter.ai/api/v1",
});

const app = express();

// Enable CORS for all origins (allow requests from Vercel frontend)
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "512kb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/generate", async (req, res) => {
  if (!OPENROUTER_API_KEY) {
    res.status(503).json({
      error:
        "Server is not configured with OPENROUTER_API_KEY. Add OPENROUTER_API_KEY=sk-or-v1-... to the project root `.env` (or `backend/.env`), save, and restart the dev server.",
    });
    return;
  }

  const userStory = req.body?.userStory;
  if (typeof userStory !== "string" || !userStory.trim()) {
    res.status(400).json({
      error: 'Request body must include a non-empty string "userStory"',
    });
    return;
  }

  try {
    const testCases = await generateTestCasesWithOpenAI(
      openai,
      OPENROUTER_MODEL,
      userStory.trim()
    );
    const buffer = await buildTestCasesWorkbook(testCases);

    const filename = `test-cases-${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[POST /generate]", err);
    res.status(500).json({ error: message });
  }
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
