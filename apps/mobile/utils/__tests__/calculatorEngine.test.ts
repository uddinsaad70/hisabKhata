// apps/mobile/utils/__tests__/calculatorEngine.test.ts
import { evaluateExpression, endsWithOperator } from "../calculatorEngine";

describe("Calculator Engine", () => {
  it("evaluates simple addition and subtraction", () => {
    expect(evaluateExpression("41300+7000")).toBe("48300");
    expect(evaluateExpression("500-200")).toBe("300");
  });

  it("handles display operators (×, ÷)", () => {
    expect(evaluateExpression("100×5")).toBe("500");
    expect(evaluateExpression("500÷2")).toBe("250");
  });

  it("evaluates chained expressions properly", () => {
    expect(evaluateExpression("41300+7000-300×2")).toBe("47700"); // BODMAS: 300*2 = 600, 48300 - 600
  });

  it("strips trailing operators before evaluation", () => {
    expect(evaluateExpression("500+")).toBe("500");
    expect(evaluateExpression("100×")).toBe("100");
  });

  it("rounds to 2 decimal places exactly", () => {
    // 100 / 3 = 33.3333... -> 33.33
    expect(evaluateExpression("100÷3")).toBe("33.33");
    // 10.005 -> 10.01 (Round half up)
    expect(evaluateExpression("10+0.005")).toBe("10.01");
  });

  it("returns Error on division by zero", () => {
    expect(evaluateExpression("100÷0")).toBe("Error");
    expect(evaluateExpression("50/0.00")).toBe("Error");
  });

  it("checks for trailing operators correctly", () => {
    expect(endsWithOperator("500+")).toBe(true);
    expect(endsWithOperator("500×")).toBe(true);
    expect(endsWithOperator("500")).toBe(false);
  });
});
