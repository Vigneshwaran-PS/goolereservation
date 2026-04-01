import { Injectable } from '@nestjs/common';
import { createDecipheriv } from 'node:crypto';

@Injectable()
export class CryptoService {
  decryptTripleDesBase64(encryptedValue: string, encryptionKey: string): string {
    const keyBytes = Buffer.from(encryptionKey, 'utf8');
    if (keyBytes.length < 24) {
      throw new Error('ENCRYPTION_KEY must be at least 24 bytes for TripleDES');
    }

    const normalizedKey = Buffer.alloc(24);
    keyBytes.copy(normalizedKey, 0, 0, 24);

    const decipher = createDecipheriv('des-ede3', normalizedKey, null);
    decipher.setAutoPadding(true);

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, 'base64')),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }
}
