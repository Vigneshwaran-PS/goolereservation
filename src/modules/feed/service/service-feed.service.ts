import { Injectable } from '@nestjs/common';
import { LocationRepository } from '../../location/location.repository';
import { FeedFileService } from '../common/feed-file.service';
import { ServiceEntity } from './service-feed.types';

type ServiceFeedPayload = {
  metadata: {
    processing_instruction: 'PROCESS_AS_COMPLETE';
    shard_number: number;
    total_shards: number;
    nonce: string;
    generation_timestamp: number;
  };
  service: ServiceEntity[];
};

@Injectable()
export class ServiceFeedService {
  constructor(
    private readonly locationRepository: LocationRepository,
    private readonly feedFileService: FeedFileService,
  ) {}

  async generate(locationIds: string[]): Promise<{
    services: ServiceEntity[];
    dataPath: string;
  }> {
    const locations = await this.locationRepository.findByIds(locationIds);
    const services = locations.map((location) => ({
      merchant_id: location.id,
      localized_service_name: {
        value: 'Reservation',
        localized_value: [
          {
            locale: 'en',
            value: 'Reservation',
          },
        ],
      },
      service_id: `reservation_${location.id}`,
    }));

    const payload: ServiceFeedPayload = {
      metadata: {
        processing_instruction: 'PROCESS_AS_COMPLETE',
        shard_number: 0,
        total_shards: 1,
        nonce: `${Date.now()}`,
        generation_timestamp: Math.floor(Date.now() / 1000),
      },
      service: services,
    };

    const { dataPath } = await this.feedFileService.writeFeedFile(
      'reservation_service',
      payload,
    );

    return { services, dataPath };
  }
}
