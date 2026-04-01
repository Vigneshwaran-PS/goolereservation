export type AppEnv = {
  dbUrl: string;
  dbName: string;
  dbUser: string;
  dbPassword: string;
  encryptionKey: string;
};

const requiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

export const loadEnv = (): AppEnv => ({
  dbUrl: requiredEnv('DB_URL'),
  dbName: requiredEnv('DB_NAME'),
  dbUser: requiredEnv('DB_USER'),
  dbPassword: requiredEnv('DB_PASSWORD'),
  encryptionKey: requiredEnv('ENCRYPTION_KEY'),
});
