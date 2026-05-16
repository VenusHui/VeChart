import { randomUUID } from 'crypto';

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CosStorageService {
  private readonly logger = new Logger(CosStorageService.name);
  private readonly bucket: string;
  private readonly publicBaseUrl: string;
  private readonly client: S3Client | null;

  constructor(configService: ConfigService) {
    this.bucket = configService.get<string>('COS_BUCKET', '');
    this.publicBaseUrl = configService.get<string>('COS_PUBLIC_BASE_URL', '');

    const accessKeyId = configService.get<string>('COS_SECRET_ID');
    const secretAccessKey = configService.get<string>('COS_SECRET_KEY');
    const endpoint = normalizeCosEndpoint(
      configService.get<string>('COS_ENDPOINT'),
      this.bucket
    );
    const region = configService.get<string>('COS_REGION', 'ap-shanghai');

    if (this.bucket && accessKeyId && secretAccessKey && endpoint) {
      this.client = new S3Client({
        region,
        endpoint,
        credentials: {
          accessKeyId,
          secretAccessKey
        },
        forcePathStyle: false
      });
    } else {
      this.client = null;
      this.logger.warn('COS credentials are missing. Uploads will fall back to provided image URLs.');
    }
  }

  async uploadBase64Image(dataUrl: string) {
    if (!this.client || !dataUrl.startsWith('data:')) {
      return {
        imageUrl: dataUrl,
        thumbnailUrl: dataUrl
      };
    }

    const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) {
      return {
        imageUrl: dataUrl,
        thumbnailUrl: dataUrl
      };
    }

    const [, contentType, payload] = match;
    const extension = contentType.split('/')[1] || 'jpg';
    const key = `uploads/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extension}`;
    const body = Buffer.from(payload, 'base64');

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        ACL: 'public-read'
      })
    );

    const publicUrl = `${this.publicBaseUrl.replace(/\/$/, '')}/${key}`;
    return {
      imageUrl: publicUrl,
      thumbnailUrl: publicUrl
    };
  }
}

function normalizeCosEndpoint(endpoint: string | undefined, bucket: string) {
  if (!endpoint) {
    return endpoint;
  }

  try {
    const url = new URL(endpoint);
    const bucketPrefix = `${bucket}.`;
    if (url.hostname.startsWith(bucketPrefix)) {
      url.hostname = url.hostname.slice(bucketPrefix.length);
    }
    return url.toString();
  } catch {
    return endpoint;
  }
}
