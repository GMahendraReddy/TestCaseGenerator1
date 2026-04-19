import OpenAI from "openai";
import type { GeneratedTestCase } from "../types.js";

const MAX_TEST_CASES = 15;

const SYSTEM_PROMPT = `You are a senior QA engineer with deep experience in test design, risk-based testing, and acceptance criteria.

Given a user story or feature description, generate up to ${MAX_TEST_CASES} high-quality, non-duplicate manual test cases using:
- Equivalence Partitioning (EP)
- Boundary Value Analysis (BVA)
- Negative Testing (meaningful, risk-based)
- Edge Cases

## Steps — realistic test data (mandatory)
Every step must be executable by a manual tester without guessing. Use CONCRETE sample values in the steps themselves:
- Names, emails, phone numbers, addresses, IDs, amounts, dates/times, URLs, file names, role names, search strings.
- Examples: use "user+jane.doe@example.com" not "valid email"; "49.99" and "50.00" not "a price"; "2025-04-19" not "a date".
- If the story implies limits (length, range, count) but does not specify numbers, infer sensible industry-typical limits and state that assumption briefly in preCondition (e.g. "Assume password policy 8–64 characters per product standard").
- Do NOT write vague steps like "enter valid data" or "perform the action" without specifying what to enter or click.

## Boundary Value Analysis — must cover where rules/limits exist
Where the story involves numeric limits, string length, cardinality, timeouts, pagination, or min/max business rules, include dedicated Boundary-type cases that explicitly exercise:
- Valid minimum (min) and valid maximum (max) accepted values.
- Immediately below minimum (invalid) and immediately above maximum (invalid), when applicable (e.g. min−1, max+1 for integers; one character below/above for length).
- Truly invalid inputs: wrong type, empty where not allowed, null/missing required fields, disallowed characters — each as its own case when it adds distinct risk.
Label in description or steps which boundary is being tested (e.g. "exactly 8 characters", "one below minimum length").

## Negative testing — meaningful, not trivial
Negative cases must tie to real risk or user impact, for example:
- Business rule violations (not just "wrong format"), authorization/conflicts, concurrency/idempotency where relevant, partial failures, rollback expectations.
- Error handling: user-visible error message, field-level validation, HTTP/API status or code ONLY if the story is API-related; otherwise UI/system behavior.
Avoid shallow negatives that only repeat "invalid input" without saying what is invalid and what should happen. Each negative case should answer: what goes wrong, and how the user/system proves it (observable outcome).

## Expected results — clarity and verifiability
expectedResult must state OBSERVABLE, CHECKABLE outcomes:
- What the user sees (exact message text pattern or key phrase when appropriate), OR what state is true after the step (record created, email not sent, button disabled).
- For errors: what is blocked or rejected AND how feedback appears (not only "error shown").
- Avoid vague phrases like "works correctly", "behaves as expected", "system handles it" — replace with specific pass/fail criteria.

## Coverage and deduplication
- Spread cases across Positive, Negative, Edge, and Boundary as appropriate; do not omit boundaries when limits are implied.
- Avoid duplicate or near-duplicate cases (same intent with different wording).

You MUST respond with VALID JSON ONLY — no markdown, no code fences, no commentary before or after the JSON.

The JSON MUST be a single object with exactly one property "testCases" whose value is an array of at most ${MAX_TEST_CASES} objects. Each object MUST use these keys and value types:

{
  "testCases": [
    {
      "tcNo": "TC_001",
      "description": "Short test case description",
      "preCondition": "Required setup before execution",
      "steps": ["Step 1", "Step 2", "Step 3"],
      "expectedResult": "Expected outcome",
      "priority": "High | Medium | Low",
      "severity": "Critical | Major | Minor",
      "type": "Positive | Negative | Edge | Boundary",
      "testTechnique": "BVA | Equivalence | Negative | Edge",
      "executionDate": ""
    }
  ]
}

Rules:
- Use sequential tcNo values: TC_001, TC_002, ... (three-digit suffix).
- priority must be exactly one of: High, Medium, Low.
- severity must be exactly one of: Critical, Major, Minor.
- type must be exactly one of: Positive, Negative, Edge, Boundary.
- testTechnique must be exactly one of: BVA, Equivalence, Negative, Edge (pick the primary technique).
- executionDate must be an empty string "" (filled later in test execution tracking).
- steps must be a non-empty array of strings.`;

function extractJsonPayload(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");
  }
  return s.trim();
}

function parseTestCasesArray(parsed: unknown): unknown[] | null {
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (typeof parsed === "object" && parsed !== null) {
    const o = parsed as Record<string, unknown>;
    if (Array.isArray(o.testCases)) return o.testCases;
    if (Array.isArray(o.test_cases)) return o.test_cases;
    if (Array.isArray(o.cases)) return o.cases;
  }
  return null;
}

function nonEmptyStr(v: unknown, fallback: string): string {
  if (v === undefined || v === null) return fallback;
  const s = String(v).replace(/^\uFEFF/, "").trim();
  return s.length ? s : fallback;
}

function normalizeSteps(raw: unknown): string[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return ["-"];
  }
  const steps = raw
    .map((s) => (typeof s === "string" ? s.trim() : String(s).trim()))
    .filter((s) => s.length > 0);
  return steps.length ? steps : ["-"];
}

function normalizeTestCase(item: unknown, index: number): GeneratedTestCase {
  const o = item as Record<string, unknown>;
  const tcNoRaw =
    o.tcNo ?? o.tc_no ?? o.id ?? o.TC_NO;
  const tcNo = nonEmptyStr(
    tcNoRaw,
    `TC_${String(index + 1).padStart(3, "0")}`
  );

  const description = nonEmptyStr(
    o.description ?? o.title ?? o.summary,
    `Test case ${index + 1}`
  );

  const preCondition = nonEmptyStr(
    o.preCondition ?? o.precondition ?? o.preConditions ?? o.preconditions,
    "-"
  );

  const steps = normalizeSteps(o.steps);

  const expectedResult = nonEmptyStr(
    o.expectedResult ?? o.expected_result ?? o.expected,
    "-"
  );

  const priority = nonEmptyStr(o.priority, "Medium");
  const severity = nonEmptyStr(o.severity, "Major");
  const type = nonEmptyStr(o.type ?? o.testType, "Positive");
  const testTechnique = nonEmptyStr(
    o.testTechnique ?? o.test_technique ?? o.technique,
    "Equivalence"
  );

  const executionDate = nonEmptyStr(o.executionDate ?? o.execution_date, "-");

  return {
    tcNo,
    description,
    preCondition,
    steps,
    expectedResult,
    priority,
    severity,
    type,
    testTechnique,
    executionDate,
  };
}

function dedupeByDescription(cases: GeneratedTestCase[]): GeneratedTestCase[] {
  const seen = new Set<string>();
  const out: GeneratedTestCase[] = [];
  for (const c of cases) {
    const key = c.description.toLowerCase().replace(/\s+/g, " ").trim();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

export async function generateTestCasesWithOpenAI(
  openai: OpenAI,
  model: string,
  userStory: string
): Promise<GeneratedTestCase[]> {
  const completion = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          "User story / feature:",
          "",
          userStory.trim(),
          "",
          "Apply for this generation:",
          "- Steps: include realistic sample data (specific emails, amounts, dates, texts) in the steps; no vague placeholders.",
          "- Boundaries: where limits apply, include cases for valid min/max and invalid just-outside (e.g. min−1, max+1) with those exact values in steps.",
          "- Negatives: each negative case must name the invalid condition and a meaningful observable outcome (not only 'error shown').",
          "- expectedResult: state checkable criteria (UI text, disabled state, record count, redirect), not generic 'success' or 'failure'.",
        ].join("\n"),
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.35,
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("Model returned an empty response");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonPayload(raw));
  } catch {
    throw new Error("Model response was not valid JSON");
  }

  const arr = parseTestCasesArray(parsed);
  if (!arr) {
    throw new Error('Model JSON must be an array or contain a "testCases" array');
  }

  const normalized = arr.map((tc, i) => normalizeTestCase(tc, i));
  const deduped = dedupeByDescription(normalized);
  return deduped.slice(0, MAX_TEST_CASES);
}
