import cors from "cors";
import express from "express";
import ExcelJS from "exceljs";

const PORT = Number(process.env.PORT) || 5000;

const app = express();

console.log("SERVER STARTED");

// Enable CORS for all origins
app.use(cors({ origin: "*" }));
app.use(express.json());

// Test route
app.get("/test", (_req, res) => {
  res.send("WORKING");
});

// Generate test cases endpoint
app.post("/generate", async (req, res) => {
  const { userStory } = req.body;

  if (!userStory || typeof userStory !== "string" || !userStory.trim()) {
    res.status(400).json({ error: "userStory is required" });
    return;
  }

  try {
    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Test Cases");

    // Add headers
    worksheet.columns = [
      { header: "TC.NO", key: "tcNo", width: 10 },
      { header: "Description", key: "description", width: 40 },
      { header: "Steps", key: "steps", width: 50 },
      { header: "Expected Result", key: "expectedResult", width: 40 },
    ];

    // Add sample test case based on user story
    worksheet.addRow({
      tcNo: 1,
      description: `Verify user can ${userStory.trim()}`,
      steps: `1. Navigate to the application\n2. Perform the action: ${userStory.trim()}\n3. Verify the result`,
      expectedResult: "User should be able to successfully complete the action",
    });

    // Set response headers
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", "attachment; filename=testcases.xlsx");

    // Send Excel file
    const buffer = await workbook.xlsx.writeBuffer();
    res.send(buffer);
  } catch (err) {
    console.error("[POST /generate]", err);
    res.status(500).json({ error: "Failed to generate Excel file" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
