import ExcelJS from "exceljs";
import type { GeneratedTestCase } from "../types.js";

const HEADERS = [
  "TC.NO",
  "Description",
  "Pre Condition",
  "Steps",
  "Expected Result",
  "Priority",
  "Severity",
  "Type",
  "Test Technique",
  "Execution Date",
] as const;

function stepsToMultiline(steps: string[]): string {
  return steps.map((s, i) => `${i + 1}. ${s}`).join("\n");
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }
  if (typeof value === "object" && value !== null && "richText" in value) {
    const rt = value as { richText: { text: string }[] };
    return rt.richText.map((t) => t.text).join("");
  }
  return String(value);
}

function autoFitColumns(sheet: ExcelJS.Worksheet, columnCount: number): void {
  for (let col = 1; col <= columnCount; col++) {
    let maxLen = (HEADERS[col - 1] ?? "").length;
    sheet.eachRow({ includeEmpty: true }, (row) => {
      const text = cellText(row.getCell(col).value);
      for (const line of text.split("\n")) {
        maxLen = Math.max(maxLen, line.length);
      }
    });
    sheet.getColumn(col).width = Math.min(Math.max(maxLen + 2, 10), 55);
  }
}

export async function buildTestCasesWorkbook(
  testCases: GeneratedTestCase[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Test Cases Generator";
  const sheet = workbook.addWorksheet("Test Cases", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  const headerRow = sheet.addRow([...HEADERS]);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: "middle", wrapText: true };

  for (const tc of testCases) {
    const row = sheet.addRow([
      tc.tcNo,
      tc.description,
      tc.preCondition,
      stepsToMultiline(tc.steps),
      tc.expectedResult,
      tc.priority,
      tc.severity,
      tc.type,
      tc.testTechnique,
      tc.executionDate,
    ]);
    row.alignment = { vertical: "top", wrapText: true };
  }

  autoFitColumns(sheet, HEADERS.length);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
