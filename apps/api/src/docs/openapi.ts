// apps/api/src/docs/openapi.ts
import { Router, type Request, type Response } from "express";

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "HisabKhata Cloud Sync API",
    version: "1.5.0",
    description:
      "Offline-first Customer Ledger & Cashbook Synchronization API (Node.js + Express + Prisma + PostgreSQL).",
  },
  servers: [
    {
      url: "http://localhost:4000",
      description: "Local Development Server",
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
  },
  paths: {
    "/health": {
      get: {
        tags: ["System"],
        summary: "Health check endpoint",
        responses: {
          "200": {
            description: "API service is healthy",
          },
        },
      },
    },
    "/auth/register": {
      post: {
        tags: ["Auth"],
        summary:
          "Register a new user account with email, password, and optional Base64 avatar",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "email", "password", "deviceId"],
                properties: {
                  name: { type: "string", example: "Md. Saad Uddin" },
                  email: {
                    type: "string",
                    format: "email",
                    example: "saad@example.com",
                  },
                  password: {
                    type: "string",
                    minLength: 4,
                    example: "secret123",
                  },
                  deviceId: {
                    type: "string",
                    example: "0192a8b0-0000-7000-8000-111111111111",
                  },
                  deviceName: { type: "string", example: "Samsung Galaxy A55" },
                  platform: { type: "string", enum: ["android", "ios", "web"] },
                  avatarBase64: { type: ["string", "null"] },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "User registered and session tokens issued" },
          "409": { description: "Email already exists" },
        },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login with email and password",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password", "deviceId"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string" },
                  deviceId: { type: "string" },
                  deviceName: { type: "string" },
                  platform: { type: "string", enum: ["android", "ios", "web"] },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Authenticated successfully" },
          "401": { description: "Invalid credentials" },
        },
      },
    },
    "/auth/google": {
      post: {
        tags: ["Auth"],
        summary: "Authenticate or register via Google ID Token",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["idToken", "deviceId"],
                properties: {
                  idToken: { type: "string" },
                  deviceId: { type: "string" },
                  deviceName: { type: "string" },
                  platform: { type: "string", enum: ["android", "ios", "web"] },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Google authentication succeeded" },
          "401": { description: "Invalid Google ID Token" },
        },
      },
    },
    "/auth/refresh": {
      post: {
        tags: ["Auth"],
        summary:
          "Rotate a 30-day refresh token and obtain a new 15-minute access token",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["refreshToken", "deviceId"],
                properties: {
                  refreshToken: { type: "string" },
                  deviceId: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Tokens rotated successfully" },
          "401": {
            description: "Refresh token invalid, expired, or already used",
          },
        },
      },
    },
    "/auth/profile": {
      patch: {
        tags: ["Auth"],
        summary: "Update authenticated user's display name or profile avatar",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  avatarBase64: { type: ["string", "null"] },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Profile updated" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/sync/push": {
      post: {
        tags: ["Sync"],
        summary:
          "Idempotent batch push (max 200 rows) in FK order with LWW conflict resolution",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["deviceId", "changes"],
                properties: {
                  deviceId: { type: "string" },
                  changes: {
                    type: "object",
                    properties: {
                      businesses: { type: "array", items: { type: "object" } },
                      customers: { type: "array", items: { type: "object" } },
                      customerEntries: {
                        type: "array",
                        items: { type: "object" },
                      },
                      cashbookEntries: {
                        type: "array",
                        items: { type: "object" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description:
              "Batch processed with accepted IDs and rejectedConflicts",
          },
          "403": { description: "Forbidden cross-user businessId access" },
        },
      },
    },
    "/sync/pull": {
      get: {
        tags: ["Sync"],
        summary:
          "Paginated pull using server_updated_at cursor with 90-day 410 Gone guard",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "deviceId",
            in: "query",
            required: true,
            schema: { type: "string" },
          },
          {
            name: "cursor",
            in: "query",
            required: false,
            schema: { type: "string" },
          },
          {
            name: "limit",
            in: "query",
            required: false,
            schema: { type: "integer", default: 200, minimum: 1, maximum: 500 },
          },
        ],
        responses: {
          "200": {
            description: "Paginated changes, nextCursor, and hasMore flag",
          },
          "410": {
            description: "Cursor older than 90 days — full resync required",
          },
        },
      },
    },
  },
} as const;

export const docsRouter = Router();

docsRouter.get("/openapi.json", (_req: Request, res: Response) => {
  res.status(200).json(openApiDocument);
});

docsRouter.get("/", (_req: Request, res: Response) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>HisabKhata API Docs (OpenAPI 3.1)</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body style="margin:0;padding:0;">
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      SwaggerUIBundle({
        url: '/docs/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true
      });
    };
  </script>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
});
