import { Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { LocationLite, LocationRepository } from '../../location/location.repository';
import { FeedFileService } from '../common/feed-file.service';
import {
  AvailabilityEntity,
  AvailabilityLocationResult,
} from './availability-feed.types';

type AvailabilityFeedPayload = {
  metadata: {
    processing_instruction: 'PROCESS_AS_COMPLETE';
    shard_number: number;
    total_shards: number;
    nonce: string;
    generation_timestamp: number;
  };
  availability: AvailabilityEntity[];
};

type HourWindow = {
  openingTime: string;
  closingTime: string;
};

type TableDef = {
  minCapacity: number;
  maxCapacity: number;
};

type ReservationDef = {
  partySize: number;
};

@Injectable()
export class AvailabilityFeedService {
  private readonly slotIntervalMinutes = 30;
  private readonly durationSec = 1800;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly locationRepository: LocationRepository,
    private readonly feedFileService: FeedFileService,
  ) {}

  async generate(locationIds: string[]): Promise<{
    availability: AvailabilityEntity[];
    locationResults: AvailabilityLocationResult[];
    dataPath: string;
  }> {
    const locations = await this.locationRepository.findByIds(locationIds);
    const allAvailability: AvailabilityEntity[] = [];
    const locationResults: AvailabilityLocationResult[] = [];

    for (const location of locations) {
      try {
        const generated = await this.buildLocationAvailability(location);
        allAvailability.push(...generated);
        locationResults.push({
          locationId: location.id,
          status: 'success',
          records: generated.length,
        });
      } catch (error) {
        locationResults.push({
          locationId: location.id,
          status: 'failed',
          records: 0,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const payload: AvailabilityFeedPayload = {
      metadata: {
        processing_instruction: 'PROCESS_AS_COMPLETE',
        shard_number: 0,
        total_shards: 1,
        nonce: `${DateTime.utc().toMillis()}`,
        generation_timestamp: DateTime.utc().toUnixInteger(),
      },
      availability: allAvailability,
    };

    const { dataPath } = await this.feedFileService.writeFeedFile(
      'reservation_availability',
      payload,
    );

    return { availability: allAvailability, locationResults, dataPath };
  }

  private async buildLocationAvailability(
    location: LocationLite,
  ): Promise<AvailabilityEntity[]> {
    if (!location.timezoneCd) {
      throw new Error('Location timezone is missing');
    }

    const reservationDayLimit = this.getReservationDayLimit(location.attributes);
    const localDates = this.buildDateRangeForLocation(
      location.timezoneCd,
      reservationDayLimit,
    );
    const nowUtcEpoch = DateTime.utc().toUnixInteger();
    const todayLocal = DateTime.now()
      .setZone(location.timezoneCd)
      .toFormat('yyyy-LL-dd');

    const [hours, tables, reservations] = await Promise.all([
      this.prismaService.db.mhLocationHours.findMany({
        where: {
          locationId: location.id,
          hourType: 'OPEN',
        },
        select: {
          hourType: true,
          weekday: true,
          openingTime: true,
          closingTime: true,
          isReservationEnable: true,
          isEnabled: true,
        },
      }),
      this.prismaService.db.mhTable.findMany({
        where: { locationId: location.id },
        select: {
          minCapacity: true,
          maxCapacity: true,
          isEnabled: true,
          attributes: true,
        },
      }),
      this.prismaService.db.mhReservation.findMany({
        where: {
          locationId: location.id,
          isReservation: 1,
          reservationStatus: {
            notIn: ['X', 'Y', 'C', 'N'],
          },
          reservationDate: {
            in: localDates,
          },
        },
        select: {
          partySize: true,
          reservationDate: true,
          reservationSlot: true,
        },
      }),
    ]);

    const validTables = this.filterEligibleTables(tables);
    if (!validTables.length) {
      return [];
    }

    const allPartySizes = this.getPartySizes(validTables);
    const reservationsBySlot = this.groupReservationsBySlot(reservations);
    const results: AvailabilityEntity[] = [];

    for (const localDate of localDates) {
      const windows = this.pickWindowsForDate(hours, localDate, location.timezoneCd);
      for (const window of windows) {
        const slotTimes = this.buildSlots(window.openingTime, window.closingTime);
        for (const slot of slotTimes) {
          const slotKey = `${localDate}|${slot}`;
          const slotReservations = reservationsBySlot.get(slotKey) ?? [];
          const startSec = this.localDateTimeToUtcEpoch(
            localDate,
            slot,
            location.timezoneCd,
          );
          if (localDate === todayLocal && startSec <= nowUtcEpoch) {
            continue;
          }

          for (const partySize of allPartySizes) {
            const compatibleTables = validTables.filter(
              (table) =>
                partySize >= table.minCapacity && partySize <= table.maxCapacity,
            );
            if (!compatibleTables.length) {
              continue;
            }

            const occupied = this.computeOccupiedCount(
              compatibleTables,
              slotReservations,
            );
            const spotsTotal = compatibleTables.length;
            const spotsOpen = Math.max(spotsTotal - occupied, 0);

            results.push({
              merchant_id: location.id,
              service_id: `reservation_${location.id}`,
              start_sec: startSec,
              duration_sec: this.durationSec,
              local_datetime: `${localDate} ${slot}`,
              day: this.getWeekdayShort(localDate, location.timezoneCd),
              spots_total: spotsTotal,
              spots_open: spotsOpen,
              resources: {
                party_size: partySize,
              },
            });
          }
        }
      }
    }

    return results;
  }

  private filterEligibleTables(
    rows: Array<{
      minCapacity: number | null;
      maxCapacity: number | null;
      isEnabled: number | null;
      attributes: unknown | null;
    }>,
  ): TableDef[] {
    return rows
      .filter((row) => row.isEnabled === 1)
      .filter((row) => row.minCapacity !== null && row.maxCapacity !== null)
      .filter((row) => this.isReservationTable(row.attributes))
      .map((row) => ({
        minCapacity: row.minCapacity as number,
        maxCapacity: row.maxCapacity as number,
      }));
  }

  private isReservationTable(attributes: unknown | null): boolean {
    if (!attributes) {
      return false;
    }

    try {
      if (typeof attributes === 'string') {
        const parsed = JSON.parse(attributes) as { isReservation?: number | string };
        return Number(parsed.isReservation) === 1;
      }

      if (typeof attributes === 'object') {
        const parsed = attributes as { isReservation?: number | string };
        return Number(parsed.isReservation) === 1;
      }

      return false;
    } catch {
      return false;
    }
  }

  private getPartySizes(tables: TableDef[]): number[] {
    const sizes = new Set<number>();
    for (const table of tables) {
      for (let size = table.minCapacity; size <= table.maxCapacity; size += 1) {
        sizes.add(size);
      }
    }

    return [...sizes].sort((a, b) => a - b);
  }

  private groupReservationsBySlot(
    rows: Array<{
      partySize: number | null;
      reservationDate: string | null;
      reservationSlot: string | null;
    }>,
  ): Map<string, ReservationDef[]> {
    const grouped = new Map<string, ReservationDef[]>();

    for (const row of rows) {
      if (!row.partySize || !row.reservationDate || !row.reservationSlot) {
        continue;
      }

      const normalizedSlot = this.normalizeReservationSlot(row.reservationSlot);
      if (!normalizedSlot) {
        continue;
      }

      const key = `${row.reservationDate}|${normalizedSlot}`;
      const existing = grouped.get(key) ?? [];
      existing.push({ partySize: row.partySize });
      grouped.set(key, existing);
    }

    return grouped;
  }

  private normalizeReservationSlot(slot: string): string | null {
    const trimmed = slot.trim().toUpperCase();
    const match = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
    if (!match) {
      return null;
    }

    let hour = Number(match[1]);
    const minute = Number(match[2]);
    const suffix = match[3];

    if (hour < 1 || hour > 12 || minute < 0 || minute > 59) {
      return null;
    }

    if (suffix === 'AM') {
      if (hour === 12) {
        hour = 0;
      }
    } else if (hour !== 12) {
      hour += 12;
    }

    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
  }

  private pickWindowsForDate(
    rows: Array<{
      hourType: string;
      weekday: string | null;
      openingTime: string | null;
      closingTime: string | null;
      isReservationEnable: number | null;
      isEnabled: number | null;
    }>,
    localDate: string,
    timezone: string,
  ): HourWindow[] {
    const dayNumber = this.getWeekdayNumber(localDate, timezone);

    const enabledRows = rows.filter(
      (row) =>
        row.hourType === 'OPEN' &&
        Number(row.isEnabled) === 1 &&
        Number(row.isReservationEnable) === 1 &&
        !!row.openingTime &&
        !!row.closingTime,
    );

    const zeroRows = enabledRows.filter((row) => row.weekday === '0');
    if (zeroRows.length > 0) {
      return zeroRows.map((row) => ({
        openingTime: row.openingTime as string,
        closingTime: row.closingTime as string,
      }));
    }

    return enabledRows
      .filter((row) => Number(row.weekday) === dayNumber)
      .map((row) => ({
        openingTime: row.openingTime as string,
        closingTime: row.closingTime as string,
      }));
  }

  private getWeekdayNumber(localDate: string, timezone: string): number {
    const local = DateTime.fromFormat(localDate, 'yyyy-LL-dd', {
      zone: timezone,
    });
    if (!local.isValid) {
      throw new Error(
        `Invalid local date "${localDate}" for timezone "${timezone}"`,
      );
    }

    return local.weekday;
  }

  private getWeekdayShort(localDate: string, timezone: string): string {
    const local = DateTime.fromFormat(localDate, 'yyyy-LL-dd', {
      zone: timezone,
    });
    if (!local.isValid) {
      throw new Error(
        `Invalid local date "${localDate}" for timezone "${timezone}"`,
      );
    }

    return local.toFormat('ccc');
  }

  private buildSlots(openingTime: string, closingTime: string): string[] {
    const [openHour, openMinute] = openingTime.split(':').map(Number);
    const [closeHour, closeMinute] = closingTime.split(':').map(Number);
    if (
      Number.isNaN(openHour) ||
      Number.isNaN(openMinute) ||
      Number.isNaN(closeHour) ||
      Number.isNaN(closeMinute)
    ) {
      return [];
    }

    const openMinutes = openHour * 60 + openMinute;
    const closeMinutes = closeHour * 60 + closeMinute;
    const slots: string[] = [];

    for (
      let current = openMinutes;
      current + this.slotIntervalMinutes <= closeMinutes;
      current += this.slotIntervalMinutes
    ) {
      const hh = Math.floor(current / 60);
      const mm = current % 60;
      slots.push(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`);
    }

    return slots;
  }

  private computeOccupiedCount(
    tables: TableDef[],
    reservations: ReservationDef[],
  ): number {
    const relevantReservations = reservations.filter((reservation) =>
      tables.some(
        (table) =>
          reservation.partySize >= table.minCapacity &&
          reservation.partySize <= table.maxCapacity,
      ),
    );

    if (!relevantReservations.length) {
      return 0;
    }

    const adjacency = relevantReservations.map((reservation) =>
      tables
        .map((table, index) =>
          reservation.partySize >= table.minCapacity &&
          reservation.partySize <= table.maxCapacity
            ? index
            : -1,
        )
        .filter((index) => index >= 0),
    );

    const matchedTableByIndex = new Array<number>(tables.length).fill(-1);

    const findMatch = (reservationIndex: number, seen: boolean[]): boolean => {
      for (const tableIndex of adjacency[reservationIndex]) {
        if (seen[tableIndex]) {
          continue;
        }
        seen[tableIndex] = true;

        if (
          matchedTableByIndex[tableIndex] === -1 ||
          findMatch(matchedTableByIndex[tableIndex], seen)
        ) {
          matchedTableByIndex[tableIndex] = reservationIndex;
          return true;
        }
      }

      return false;
    };

    let matched = 0;
    for (let i = 0; i < relevantReservations.length; i += 1) {
      const seen = new Array<boolean>(tables.length).fill(false);
      if (findMatch(i, seen)) {
        matched += 1;
      }
    }

    return matched;
  }

  private getReservationDayLimit(attributes: string | null): number {
    if (!attributes) {
      return 7;
    }

    try {
      const parsed = JSON.parse(attributes) as { reservationDayLimit?: number };
      const limit = Number(parsed.reservationDayLimit);
      if (!Number.isFinite(limit) || limit <= 0) {
        return 7;
      }

      return Math.floor(limit);
    } catch {
      return 7;
    }
  }

  private buildDateRangeForLocation(timezone: string, dayLimit: number): string[] {
    const start = DateTime.now().setZone(timezone).startOf('day');
    if (!start.isValid) {
      throw new Error(`Invalid timezone "${timezone}"`);
    }

    const dates: string[] = [];
    for (let offset = 0; offset <= dayLimit; offset += 1) {
      dates.push(start.plus({ days: offset }).toFormat('yyyy-LL-dd'));
    }

    return dates;
  }

  private localDateTimeToUtcEpoch(
    dateYmd: string,
    timeHms: string,
    timezone: string,
  ): number {
    const local = DateTime.fromFormat(
      `${dateYmd} ${timeHms}`,
      'yyyy-LL-dd HH:mm:ss',
      { zone: timezone },
    );
    if (!local.isValid) {
      throw new Error(
        `Invalid local datetime "${dateYmd} ${timeHms}" for timezone "${timezone}"`,
      );
    }

    return local.toUTC().toUnixInteger();
  }
}
