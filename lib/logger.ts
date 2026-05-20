import pino from "pino";

export const logger = pino({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  redact: [
    "authorization",
    "cookie",
    "x-api-key",
    "*.password",
    "*.token",
    "*.secret",
  ],
});
