import { Injectable, Logger } from '@nestjs/common';
import { LocationRepository } from '../modules/location/location.repository';

@Injectable()
export class ReservationSyncJob {
  private readonly logger = new Logger(ReservationSyncJob.name);

  constructor(private readonly locationRepository: LocationRepository) {}

  async run(): Promise<void> {
    this.logger.log('Reservation sync job started');

    const locationIds = [
      '04749fc5-6ab6-4e4e-b14e-eca1a7724435',
      '13823ccb-9b7c-4aa8-a188-acf239d8564c',
      '14d293a8-81c5-40b2-a208-be1c03a93fad',
    ];

    const locations = await this.locationRepository.findByIds(locationIds);
    this.logger.log(`findByIds fetched ${locations.length} locations`);
    this.logger.log(`Location details: ${JSON.stringify(locations)}`);

    // TODO: Add reservation feed API calls and SMTP send here.
    this.logger.log('Reservation sync job completed');
  }
}
