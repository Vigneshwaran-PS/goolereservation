import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CryptoService } from './common/crypto/crypto.service';
import { PrismaService } from './database/prisma/prisma.service';
import { ReservationSyncJob } from './jobs/reservation-sync.job';
import { LocationRepository } from './modules/location/location.repository';
import { MerchantFeedService } from './modules/feed/merchant/merchant-feed.service';
import { FeedFileService } from './modules/feed/common/feed-file.service';
import { ServiceFeedService } from './modules/feed/service/service-feed.service';
import { SftpUploadService } from './modules/feed/common/sftp-upload.service';
import { AvailabilityFeedService } from './modules/feed/availability/availability-feed.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [
    AppService,
    CryptoService,
    PrismaService,
    LocationRepository,
    FeedFileService,
    SftpUploadService,
    MerchantFeedService,
    ServiceFeedService,
    AvailabilityFeedService,
    ReservationSyncJob,
  ],
})
export class AppModule {}
