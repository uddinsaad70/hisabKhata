import "react-native-get-random-values";
import { generateId, isValidUuidV7 } from "../uuid";

describe("UUID v7 generator (utils/uuid.ts)", () => {
  it("generates a valid version 7 UUID", () => {
    const id = generateId();
    expect(isValidUuidV7(id)).toBe(true);
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("generates unique IDs on consecutive calls", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });

  it("sorts chronologically when generated across different timestamps", async () => {
    const firstId = generateId();
    await new Promise((resolve) => setTimeout(resolve, 10));
    const secondId = generateId();

    expect(firstId < secondId).toBe(true);
  });
});
