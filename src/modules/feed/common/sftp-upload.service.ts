import { Injectable, Logger } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import SftpClient from 'ssh2-sftp-client';
import { loadEnv } from '../../../config/env.config';

type FeedType = 'merchant' | 'service' | 'availability';

@Injectable()
export class SftpUploadService {
  private readonly logger = new Logger(SftpUploadService.name);

  async upload(feedType: FeedType, localFilePath: string): Promise<void> {
    const env = loadEnv();
    if (!env.sftp.enabled) {
      this.logger.log(`SFTP disabled. Skipping ${feedType} upload.`);
      return;
    }

    if (!env.sftp.privateKeyPath) {
      throw new Error('GOOGLE_SFTP_KEY_PATH is required when SFTP is enabled.');
    }

    const username = this.resolveUsername(feedType);
    if (!username) {
      throw new Error(`Missing SFTP username for ${feedType} in ${env.sftp.environment}.`);
    }

    const privateKey = await readFile(env.sftp.privateKeyPath, 'utf8');
    const sftp = new SftpClient();

    try {
      await sftp.connect({
        host: env.sftp.host,
        port: env.sftp.port,
        username,
        privateKey,
        passphrase: env.sftp.privateKeyPassphrase,
        readyTimeout: 30000,
      });

      const remoteFileName = basename(localFilePath);
      await sftp.put(localFilePath, remoteFileName);
      this.logger.log(`Uploaded ${feedType} feed to Google SFTP as ${remoteFileName}`);
    } finally {
      await sftp.end().catch(() => undefined);
    }
  }

  private resolveUsername(feedType: FeedType): string {
    const env = loadEnv();
    const isProd = env.sftp.environment === 'production';

    if (feedType === 'merchant') {
      return isProd
        ? env.sftp.users.merchantProduction
        : env.sftp.users.merchantSandbox;
    }

    if (feedType === 'service') {
      return isProd
        ? env.sftp.users.serviceProduction
        : env.sftp.users.serviceSandbox;
    }

    return isProd
      ? env.sftp.users.availabilityProduction
      : env.sftp.users.availabilitySandbox;
  }
}
