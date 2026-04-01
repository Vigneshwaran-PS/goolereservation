import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    console.log('Batch job started');
    console.log('Running sample logic...');
    console.log('Batch job completed');
  } finally {
    await app.close();
  }
}

bootstrap()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error('Batch job failed', error);
    process.exit(1);
  });