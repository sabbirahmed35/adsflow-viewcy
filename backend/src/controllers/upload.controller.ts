import { Request, Response } from 'express';
import multer from 'multer';
import { uploadService } from '../services/upload.service';
import { ok } from '../middleware/errorHandler';
import { AppError } from '../middleware/errorHandler';
import { config } from '../config';

const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: { fileSize: config.upload.maxSizeMb * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      ...config.upload.allowedImageTypes,
      ...config.upload.allowedVideoTypes,
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError(400, `Unsupported file type: ${file.mimetype}`) as any);
    }
  },
});

export class UploadController {
  async uploadCreative(req: Request, res: Response) {
    if (!req.file) throw new AppError(400, 'No file provided');
    const result = await uploadService.uploadCreative(
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname
    );
    ok(res, result);
  }

  async getPresignedUrl(req: Request, res: Response) {
    const { fileName, mimeType } = req.body;
    if (!fileName || !mimeType) throw new AppError(400, 'fileName and mimeType required');
    const result = await uploadService.getPresignedUploadUrl(fileName, mimeType);
    ok(res, result);
  }
}

export const uploadController = new UploadController();
