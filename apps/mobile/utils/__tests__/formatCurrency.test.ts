import { roundMoney, isSettled, formatCurrency } from "../formatCurrency";
import { COLORS, getThemeColors } from "../../constants/theme";

describe("formatCurrency and money precision helpers (CP01)", () => {
  it("rounds floating-point amounts accurately to 2 decimal places", () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
    expect(roundMoney(10.005)).toBe(10.01);
  });

  it("checks settled balance using Math.abs(bal) < 0.005", () => {
    expect(isSettled(0.004)).toBe(true);
    expect(isSettled(0.01)).toBe(false);
  });

  it("formats BDT and INR with en-IN grouping", () => {
    expect(formatCurrency(4203148, "BDT")).toBe("৳ 42,03,148");
    expect(formatCurrency(1250.5, "INR")).toBe("₹ 1,250.50");
  });

  it("exposes spec color tokens and light/dark theme palettes", () => {
    expect(COLORS.primaryBlue).toBe("#1355A3");
    expect(COLORS.primaryRed).toBe("#C91C42");
    expect(COLORS.primaryGreen).toBe("#108944");
    expect(COLORS.lightPinkColumnTint).toBe("#FFF5F6");
    expect(COLORS.activeTabIndicator).toBe("#FFC107");
    expect(getThemeColors("dark").pageBackgroundGrey).toBe("#0F172A");
  });
});
