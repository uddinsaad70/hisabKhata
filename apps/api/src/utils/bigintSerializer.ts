// apps/api/src/utils/bigintSerializer.ts

/**
 * Recursively converts any BigInt values inside an object or array into safe JS Numbers
 * so Express res.json() never throws a BigInt serialization TypeError.
 */
export function sanitizeBigIntForJson<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === "bigint") {
    return Number(data) as unknown as T;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeBigIntForJson(item)) as unknown as T;
  }

  if (data instanceof Date) {
    return data;
  }

  if (typeof data === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = sanitizeBigIntForJson(value);
    }
    return result as T;
  }

  return data;
}
