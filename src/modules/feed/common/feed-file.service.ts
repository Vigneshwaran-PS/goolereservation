import { Injectable } from '@nestjs/common';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DateTime } from 'luxon';

@Injectable()
export class FeedFileService {
  private readonly outputDir = join(process.cwd(), 'logs', 'feeds');

  async writeFeedFile<T>(
    filePrefix: string,
    payload: T,
  ): Promise<{ dataPath: string; timestamp: number }> {
    const timestamp = DateTime.utc().toUnixInteger();
    const dataFileName = `${filePrefix}_${timestamp}.json`;
    const dataPath = join(this.outputDir, dataFileName);

    await mkdir(this.outputDir, { recursive: true });
    await writeFile(dataPath, JSON.stringify(payload, null, 2), 'utf8');

    return { dataPath, timestamp };
  }
}
