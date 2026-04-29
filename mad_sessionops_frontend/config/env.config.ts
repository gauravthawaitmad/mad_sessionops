// Centralized environment configuration
// This provides type-safe access to environment variables

interface EnvConfig {
  // App
  appName: string;
  appEnv: "development" | "staging" | "production";
  appUrl: string;
  appVersion: string;

  // API
  apiUrl: string;
  apiTimeout: number;

  // Features
  enableAnalytics: boolean;
  enableDebug: boolean;
  enableMockApi: boolean;

  // Logging
  logLevel: "debug" | "info" | "warn" | "error";

  // Private (server-side only)
  apiSecretKey?: string;
}

// Helper function to get boolean from string
const getBoolean = (value: string | undefined, defaultValue: boolean = false): boolean => {
  if (!value) return defaultValue;
  return value.toLowerCase() === "true";
};

// Helper function to get number from string
const getNumber = (value: string | undefined, defaultValue: number): number => {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

// Validate required environment variables
const validateEnv = () => {
  const required = ["NEXT_PUBLIC_API_URL", "NEXT_PUBLIC_APP_NAME"];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}\n` +
        "Please check your .env.local file."
    );
  }
};

// Validate on build
if (typeof window === "undefined") {
  validateEnv();
}

export const env: EnvConfig = {
  // App
  appName: process.env.NEXT_PUBLIC_APP_NAME || "MAD Platform",
  appEnv: (process.env.NEXT_PUBLIC_APP_ENV as EnvConfig["appEnv"]) || "development",
  appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  appVersion: process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0",

  // API
  apiUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api",
  apiTimeout: getNumber(process.env.NEXT_PUBLIC_API_TIMEOUT, 30000),

  // Features
  enableAnalytics: getBoolean(process.env.NEXT_PUBLIC_ENABLE_ANALYTICS),
  enableDebug: getBoolean(process.env.NEXT_PUBLIC_ENABLE_DEBUG),
  enableMockApi: getBoolean(process.env.NEXT_PUBLIC_ENABLE_MOCK_API),

  // Logging
  logLevel: (process.env.NEXT_PUBLIC_LOG_LEVEL as EnvConfig["logLevel"]) || "info",

  // Private (only accessible server-side)
  apiSecretKey: process.env.API_SECRET_KEY,
};

// Export individual values for convenience
export const { appName, appEnv, appUrl, apiUrl, enableAnalytics, enableDebug } = env;

// Helper to check environment
export const isDevelopment = env.appEnv === "development";
export const isStaging = env.appEnv === "staging";
export const isProduction = env.appEnv === "production";

// Helper for logging
export const shouldLog = (level: EnvConfig["logLevel"]) => {
  const levels = ["debug", "info", "warn", "error"];
  const currentLevelIndex = levels.indexOf(env.logLevel);
  const requestedLevelIndex = levels.indexOf(level);
  return requestedLevelIndex >= currentLevelIndex;
};
