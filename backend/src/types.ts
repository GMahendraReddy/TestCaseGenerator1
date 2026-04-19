/** Normalized test case used for Excel export (no undefined; strings use "-" when unknown). */
export interface GeneratedTestCase {
  tcNo: string;
  description: string;
  preCondition: string;
  steps: string[];
  expectedResult: string;
  priority: string;
  severity: string;
  type: string;
  testTechnique: string;
  executionDate: string;
}
