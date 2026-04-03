import { Injectable, Logger } from '@nestjs/common';
import { MerchantFeedService } from '../modules/feed/merchant/merchant-feed.service';
import { ServiceFeedService } from '../modules/feed/service/service-feed.service';
import { SftpUploadService } from '../modules/feed/common/sftp-upload.service';
import { AvailabilityFeedService } from '../modules/feed/availability/availability-feed.service';

@Injectable()
export class ReservationSyncJob {
  private readonly logger = new Logger(ReservationSyncJob.name);

  constructor(
    private readonly merchantFeedService: MerchantFeedService,
    private readonly serviceFeedService: ServiceFeedService,
    private readonly availabilityFeedService: AvailabilityFeedService,
    private readonly sftpUploadService: SftpUploadService,
  ) {}

  async run(): Promise<void> {
    this.logger.log('Reservation sync job started');

    const locationIds = [
      '04749fc5-6ab6-4e4e-b14e-eca1a7724435',
      '13823ccb-9b7c-4aa8-a188-acf239d8564c',
      '14d293a8-81c5-40b2-a208-be1c03a93fad',
    ];

    const { merchants, dataPath } = await this.merchantFeedService.generate(
      locationIds,
    );
    this.logger.log(`Merchant feed records generated: ${merchants.length}`);
    this.logger.log(`Merchant feed file: ${dataPath}`);
    // await this.sftpUploadService.upload('merchant', dataPath);

    const { services, dataPath: serviceDataPath } =
      await this.serviceFeedService.generate(locationIds);
    this.logger.log(`Service feed records generated: ${services.length}`);
    this.logger.log(`Service feed file: ${serviceDataPath}`);
    // await this.sftpUploadService.upload('service', serviceDataPath);

    const {
      availability,
      dataPath: availabilityDataPath,
      locationResults,
    } = await this.availabilityFeedService.generate(locationIds);
    this.logger.log(`Availability feed records generated: ${availability.length}`);
    this.logger.log(`Availability feed file: ${availabilityDataPath}`);
    // await this.sftpUploadService.upload('availability', availabilityDataPath);

    const successfulLocations = locationResults.filter(
      (result) => result.status === 'success',
    );
    const failedLocations = locationResults.filter(
      (result) => result.status === 'failed',
    );
    this.logger.log(
      `Availability build success locations: ${successfulLocations
        .map((result) => `${result.locationId}(${result.records})`)
        .join(', ')}`,
    );
    this.logger.log(
      `Availability build failed locations: ${failedLocations
        .map((result) => `${result.locationId}(${result.error})`)
        .join(', ')}`,
    );

    const merchantIds = new Set(merchants.map((merchant) => merchant.merchant_id));
    const serviceMerchantIds = new Set(
      services.map((service) => service.merchant_id),
    );
    const sameLocations =
      merchantIds.size === serviceMerchantIds.size &&
      [...merchantIds].every((id) => serviceMerchantIds.has(id));

    this.logger.log(`Merchant and Service locations match: ${sameLocations}`);

    // TODO: Add reservation feed API calls and SMTP send here.
    this.logger.log('Reservation sync job completed');
  }
}
