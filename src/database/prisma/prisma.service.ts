import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { CryptoService } from '../../common/crypto/crypto.service';
import { loadEnv } from '../../config/env.config';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly client: PrismaClient;

  constructor(private readonly cryptoService: CryptoService) {
    const env = loadEnv();
    const decryptedPassword = this.cryptoService.decryptTripleDesBase64(
      env.dbPassword,
      env.encryptionKey,
    );

    const jdbcLessUrl = env.dbUrl.startsWith('jdbc:')
      ? env.dbUrl.slice(5)
      : env.dbUrl;
    const parsedUrl = new URL(jdbcLessUrl);

    if (!parsedUrl.pathname || parsedUrl.pathname === '/') {
      parsedUrl.pathname = `/${env.dbName}`;
    }

    const adapter = new PrismaMariaDb({
      host: parsedUrl.hostname,
      port: parsedUrl.port ? Number(parsedUrl.port) : 3306,
      user: env.dbUser,
      password: decryptedPassword,
      database: parsedUrl.pathname.replace(/^\//, '') || env.dbName,
    });

    this.client = new PrismaClient({ adapter });
  }

  get db(): PrismaClient {
    return this.client;
  }

  async onModuleInit(): Promise<void> {
    await this.client.$connect();
    this.logger.log('Prisma connected to MySQL');
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
    this.logger.log('Prisma connection closed');
  }
}
