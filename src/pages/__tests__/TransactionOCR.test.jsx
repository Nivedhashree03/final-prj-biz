import { expect, test } from 'vitest';
import { extractAmount } from "../../utils/ocrUtils";

test("should pick bottom-most total instead of highest", () => {
  const mockText = `
    Item A 2000
    Item B 1472
    Total 3472
    Discount -16
    Grand Total
    3456
  `;

  const result = extractAmount(mockText);

  expect(result).toBe(3456);
});
