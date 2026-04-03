import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';

export type LocationLite = {
  id: string;
  merchantId: string;
  locationName: string;
  locationSlug: string | null;
  attributes: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  addressLine3: string | null;
  city: string | null;
  stateCd: string | null;
  postalCd: string | null;
  countryCd: string;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  timezoneCd: string | null;
  isEnabled: boolean;
};

@Injectable()
export class LocationRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async findByIds(locationIds: string[]): Promise<LocationLite[]> {
    if (!locationIds.length) {
      return [];
    }

    return this.prismaService.db.mhLocation.findMany({
      where: {
        id: {
          in: locationIds,
        },
        isEnabled: true,
        countryCd: 'US',
      },
      select: {
        id: true,
        merchantId: true,
        locationName: true,
        locationSlug: true,
        attributes: true,
        addressLine1: true,
        addressLine2: true,
        addressLine3: true,
        city: true,
        stateCd: true,
        postalCd: true,
        countryCd: true,
        latitude: true,
        longitude: true,
        phone: true,
        timezoneCd: true,
        isEnabled: true,
      },
    });
  }
}
