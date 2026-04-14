import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { AppError } from '../middleware/errorHandler';
import { UploadCreativeResponse } from '../types/shared';

const s3 = new S3Client({
  region: config.aws.region,
  credentials: {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey,
  },
});

export class UploadService {
  async uploadCreative(
    buffer: Buffer,
    mimeType: string,
    originalName: string
  ): Promise<UploadCreativeResponse> {
    if (!config.aws.accessKeyId) {
      throw new AppError(503, 'Storage service not configured');
    }

    const isVideo = config.upload.allowedVideoTypes.includes(mimeType as any);
    const isImage = config.upload.allowedImageTypes.includes(mimeType as any);

    if (!isImage && !isVideo) {
      throw new AppError(400, `Unsupported file type: ${mimeType}`);
    }

    if (buffer.length > config.upload.maxSizeMb * 1024 * 1024) {
      throw new AppError(400, `File exceeds max size of ${config.upload.maxSizeMb}MB`);
    }

    const ext = originalName.split('.').pop() ?? 'bin';
    const key = `creatives/${uuidv4()}.${ext}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: config.aws.s3Bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        CacheControl: 'max-age=31536000',
      })
    );

    const url = `https://${config.aws.s3Bucket}.s3.${config.aws.region}.amazonaws.com/${key}`;

    return {
      url,
      key,
      type: isVideo ? 'VIDEO' : 'IMAGE',
      size: buffer.length,
      mimeType,
    };
  }

  async getPresignedUploadUrl(fileName: string, mimeType: string): Promise<{ url: string; key: string }> {
    const ext = fileName.split('.').pop() ?? 'bin';
    const key = `creatives/${uuidv4()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: config.aws.s3Bucket,
      Key: key,
      ContentType: mimeType,
    });

    const url = await getSignedUrl(s3, command, { expiresIn: 300 }); // 5 minutes
    return { url, key };
  }

  async deleteCreative(key: string): Promise<void> {
    await s3.send(new DeleteObjectCommand({ Bucket: config.aws.s3Bucket, Key: key }));
  }

  getPublicUrl(key: string): string {
    return `https://${config.aws.s3Bucket}.s3.${config.aws.region}.amazonaws.com/${key}`;
  }
}

export const uploadService = new UploadService();
