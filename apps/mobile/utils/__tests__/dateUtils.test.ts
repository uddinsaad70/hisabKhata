import {
  getLocalDateString,
  getLocalTimeString,
  isFutureDate,
  formatRelativeTime,
} from "../dateUtils";

describe("dateUtils local timezone helpers (CP01)", () => {
  it("keeps local midnight (00:15 AM) on the same local calendar date instead of shifting to previous UTC day", () => {
    const localMidnight = new Date(2026, 9, 19, 0, 15, 0); // 19 Oct 2026, 00:15 AM local
    expect(getLocalDateString(localMidnight)).toBe("2026-10-19");
    expect(getLocalTimeString(localMidnight)).toMatch(/12:15\s*AM/i);
  });

  it("returns true for tomorrow in isFutureDate and false for today or past dates", () => {
    const today = new Date(2026, 9, 18, 12, 0, 0); // 18 Oct 2026
    expect(isFutureDate("2026-10-19", today)).toBe(true);
    expect(isFutureDate("2026-10-18", today)).toBe(false);
    expect(isFutureDate("2026-10-17", today)).toBe(false);
  });

  it('formats relative time strings like "26 minutes ago"', () => {
    const nowMs = 1792300000000;
    expect(formatRelativeTime(nowMs - 26 * 60 * 1000, nowMs)).toBe(
      "26 minutes ago",
    );
  });
});
