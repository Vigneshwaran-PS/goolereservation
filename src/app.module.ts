import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CryptoService } from './common/crypto/crypto.service';
import { PrismaService } from './database/prisma/prisma.service';
import { ReservationSyncJob } from './jobs/reservation-sync.job';
import { LocationRepository } from './modules/location/location.repository';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [
    AppService,
    CryptoService,
    PrismaService,
    LocationRepository,
    ReservationSyncJob,
  ],
})
export class AppModule {}
