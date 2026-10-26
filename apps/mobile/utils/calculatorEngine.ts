// apps/mobile/utils/calculatorEngine.ts
import { roundMoney } from "./formatCurrency";

/**
 * Safely evaluates a mathematical expression string.
 * Replaces display operators (×, ÷) with JS operators (*, /).
 * Strips trailing operators before evaluation.
 * Returns "Error" on division by zero or invalid expressions.
 */
export function evaluateExpression(expression: string): string {
  try {
    if (!expression) return "";

    // Remove spaces and replace display operators
    let expr = expression
      .replace(/\s+/g, "")
      .replace(/×/g, "*")
      .replace(/÷/g, "/");

    // Handle percentage (e.g., 500+5% -> roughly 500+0.05 in simple eval)
    expr = expr.replace(/%/g, "/100");

    // Strip trailing operators (e.g., "500+" -> "500")
    expr = expr.replace(/[\+\-\*\/\.]$/, "");

    if (!expr) return "";

    // Strict validation to prevent prototype pollution or code injection
    if (/[^0-9\.\+\-\*\/\(\)]/g.test(expr)) {
      return "Error";
    }

    // Explicitly check for division by zero (e.g., "100/0" or "50/0.00")
    if (/\/[0\.]+(?!\d)/.test(expr)) {
      return "Error";
    }

    // Safely evaluate the sanitized math expression
    // eslint-disable-next-line no-new-func
    const result = new Function(`return ${expr}`)();

    if (!Number.isFinite(result)) {
      return "Error";
    }

    // Ensure rounding to 2 decimal places exactly as per Specification Section 4
    const rounded = roundMoney(result);
    return rounded.toString();
  } catch (error) {
    return "Error";
  }
}

/**
 * Checks if the last character of the expression is an operator.
 */
export function endsWithOperator(expression: string): boolean {
  return /[\+\-\×\÷\.\%]$/.test(expression.trim());
}
