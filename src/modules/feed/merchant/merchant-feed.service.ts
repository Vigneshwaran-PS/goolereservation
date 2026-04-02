import { Injectable } from '@nestjs/common';
import { LocationLite, LocationRepository } from '../../location/location.repository';
import { FeedFileService } from '../common/feed-file.service';
import { MerchantEntity } from './merchant-feed.types';

type MerchantFeedPayload = {
  metadata: {
    processing_instruction: 'PROCESS_AS_COMPLETE';
    shard_number: number;
    total_shards: number;
    nonce: string;
    generation_timestamp: number;
  };
  merchant: MerchantEntity[];
};

@Injectable()
export class MerchantFeedService {
  constructor(
    private readonly locationRepository: LocationRepository,
    private readonly feedFileService: FeedFileService,
  ) {}

  async generate(locationIds: string[]): Promise<{
    merchants: MerchantEntity[];
    dataPath: string;
  }> {
    const locations = await this.locationRepository.findByIds(locationIds);
    const merchants = locations
      .filter((location) => location.latitude !== null && location.longitude !== null)
      .map((location) => this.toMerchantEntity(location));

    const payload: MerchantFeedPayload = {
      metadata: {
        processing_instruction: 'PROCESS_AS_COMPLETE',
        shard_number: 0,
        total_shards: 1,
        nonce: `${Date.now()}`,
        generation_timestamp: Math.floor(Date.now() / 1000),
      },
      merchant: merchants,
    };

    const { dataPath } = await this.feedFileService.writeFeedFile(
      'reservation_merchant',
      payload,
    );

    return { merchants, dataPath };
  }

  private toMerchantEntity(location: LocationLite): MerchantEntity {
    const streetAddress = [
      location.addressLine1,
      location.addressLine2,
      location.addressLine3,
    ]
      .filter((part) => part && part.trim().length > 0)
      .join(', ');

    return {
      category: 'restaurant',
      merchant_id: location.id,
      name: location.locationName,
      telephone: this.normalizePhone(location.phone),
      url: this.buildLocationUrl(location.locationSlug),
      geo: {
        latitude: location.latitude ?? 0,
        longitude: location.longitude ?? 0,
        address: {
          street_address: streetAddress,
          locality: location.city ?? '',
          region: location.stateCd ?? '',
          postal_code: location.postalCd ?? '',
          country: location.countryCd,
        },
      },
    };
  }

  private normalizePhone(rawPhone: string | null): string {
    const digits = (rawPhone ?? '').replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('1')) {
      return `+${digits}`;
    }

    if (digits.length === 10) {
      return `+1${digits}`;
    }

    return '+10000000000';
  }

  private buildLocationUrl(locationSlug: string | null): string {
    if (!locationSlug) {
      return 'https://www.maghil.com';
    }

    return `https://${locationSlug}.maghil.com/restaurant/${locationSlug}/menu/Pickup`;
  }
}
