import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';

export type LocationLite = {
  id: string;
  locationName: string;
  locationSlug: string | null;
  city: string | null;
  stateCd: string | null;
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
      },
      select: {
        id: true,
        locationName: true,
        locationSlug: true,
        city: true,
        stateCd: true,
        timezoneCd: true,
        isEnabled: true,
      },
    });
  }
}
