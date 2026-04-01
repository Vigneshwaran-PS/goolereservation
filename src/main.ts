import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ReservationSyncJob } from './jobs/reservation-sync.job';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    const reservationSyncJob = app.get(ReservationSyncJob);
    await reservationSyncJob.run();
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
