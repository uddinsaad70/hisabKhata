// apps/api/src/sync/sync.schema.ts
import { z } from "zod";

const uuidSchema = z.string().uuid("Invalid UUID format");

const amountSchema = z.union([z.string(), z.number()]).transform((val) => {
  const num = typeof val === "number" ? val : Number(val);
  if (!Number.isFinite(num) || num <= 0 || num > 999999999.99) {
    throw new Error("Amount must be between 0.01 and 99,99,99,999.99");
  }
  return num.toFixed(2);
});

export const pushBusinessItemSchema = z.object({
  id: uuidSchema,
  name: z.string().trim().min(1).max(120),
  currency: z.enum(["BDT", "INR"]).default("BDT"),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  isDeleted: z.boolean().default(false),
});

export const pushCustomerItemSchema = z.object({
  id: uuidSchema,
  businessId: uuidSchema,
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(30).nullable().optional(),
  avatarInitials: z.string().trim().min(1).max(4),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  isDeleted: z.boolean().default(false),
});

export const pushCustomerEntryItemSchema = z.object({
  id: uuidSchema,
  businessId: uuidSchema,
  customerId: uuidSchema,
  type: z.enum(["GAVE", "GOT"]),
  amount: amountSchema,
  details: z.string().max(500).nullable().optional(),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid YYYY-MM-DD date"),
  entryTime: z.string().trim().min(1).max(16),
  timestamp: z.number().int().nonnegative(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  isDeleted: z.boolean().default(false),
});

export const pushCashbookEntryItemSchema = z.object({
  id: uuidSchema,
  businessId: uuidSchema,
  type: z.enum(["IN", "OUT"]),
  paymentMode: z.enum(["CASH", "ONLINE"]).default("CASH"),
  amount: amountSchema,
  details: z.string().max(500).nullable().optional(),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid YYYY-MM-DD date"),
  entryTime: z.string().trim().min(1).max(16),
  timestamp: z.number().int().nonnegative(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  isDeleted: z.boolean().default(false),
});

export const syncPushRequestSchema = z
  .object({
    deviceId: z.string().trim().min(1, "deviceId is required"),
    changes: z.object({
      businesses: z.array(pushBusinessItemSchema).default([]),
      customers: z.array(pushCustomerItemSchema).default([]),
      customerEntries: z.array(pushCustomerEntryItemSchema).default([]),
      cashbookEntries: z.array(pushCashbookEntryItemSchema).default([]),
    }),
  })
  .superRefine((data, ctx) => {
    const totalRows =
      data.changes.businesses.length +
      data.changes.customers.length +
      data.changes.customerEntries.length +
      data.changes.cashbookEntries.length;

    if (totalRows > 200) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Batch size (${totalRows}) exceeds maximum limit of 200 rows per push request.`,
        path: ["changes"],
      });
    }
  });

export type SyncPushRequestInput = z.infer<typeof syncPushRequestSchema>;
