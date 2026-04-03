export type AppEnv = {
  dbUrl: string;
  dbName: string;
  dbUser: string;
  dbPassword: string;
  encryptionKey: string;
  sftp: {
    enabled: boolean;
    environment: 'sandbox' | 'production';
    host: string;
    port: number;
    privateKeyPath: string;
    privateKeyPassphrase?: string;
    users: {
      merchantSandbox: string;
      merchantProduction: string;
      serviceSandbox: string;
      serviceProduction: string;
      availabilitySandbox: string;
      availabilityProduction: string;
    };
  };
};

const requiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

const optionalEnv = (name: string): string | undefined => {
  const value = process.env[name]?.trim();
  return value || undefined;
};

const booleanEnv = (name: string, fallback = false): boolean => {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) {
    return fallback;
  }

  return value === '1' || value === 'true' || value === 'yes';
};

const numberEnv = (name: string, fallback: number): number => {
  const value = process.env[name]?.trim();
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid number in environment variable: ${name}`);
  }

  return parsed;
};

export const loadEnv = (): AppEnv => ({
  dbUrl: requiredEnv('DB_URL'),
  dbName: requiredEnv('DB_NAME'),
  dbUser: requiredEnv('DB_USER'),
  dbPassword: requiredEnv('DB_PASSWORD'),
  encryptionKey: requiredEnv('ENCRYPTION_KEY'),
  sftp: {
    enabled: booleanEnv('ENABLE_SFTP_UPLOAD', false),
    environment:
      optionalEnv('GOOGLE_SFTP_ENV')?.toLowerCase() === 'production'
        ? 'production'
        : 'sandbox',
    host: optionalEnv('GOOGLE_SFTP_HOST') ?? 'partnerupload.google.com',
    port: numberEnv('GOOGLE_SFTP_PORT', 19321),
    privateKeyPath: optionalEnv('GOOGLE_SFTP_KEY_PATH') ?? '',
    privateKeyPassphrase: optionalEnv('GOOGLE_SFTP_KEY_PASSPHRASE'),
    users: {
      merchantSandbox: optionalEnv('GOOGLE_SFTP_USER_MERCHANT_SANDBOX') ?? '',
      merchantProduction:
        optionalEnv('GOOGLE_SFTP_USER_MERCHANT_PRODUCTION') ?? '',
      serviceSandbox: optionalEnv('GOOGLE_SFTP_USER_SERVICE_SANDBOX') ?? '',
      serviceProduction: optionalEnv('GOOGLE_SFTP_USER_SERVICE_PRODUCTION') ?? '',
      availabilitySandbox:
        optionalEnv('GOOGLE_SFTP_USER_AVAILABILITY_SANDBOX') ?? '',
      availabilityProduction:
        optionalEnv('GOOGLE_SFTP_USER_AVAILABILITY_PRODUCTION') ?? '',
    },
  },
});
