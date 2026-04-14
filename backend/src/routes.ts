import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { adController } from '../controllers/ad.controller';
import { adminController } from '../controllers/admin.controller';
import { aiController } from '../controllers/ai.controller';
import { uploadController, upload } from '../controllers/upload.controller';
import { authenticate, requireAdmin, requireClient } from '../middleware/auth';

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authRouter = Router();
authRouter.post('/register', (req, res, next) => authController.register(req, res).catch(next));
authRouter.post('/login',    (req, res, next) => authController.login(req, res).catch(next));
authRouter.post('/refresh',  (req, res, next) => authController.refresh(req, res).catch(next));
authRouter.post('/logout',   (req, res, next) => authController.logout(req, res).catch(next));
authRouter.get('/me', authenticate, (req, res, next) => authController.me(req, res).catch(next));
authRouter.patch('/profile', authenticate, (req, res, next) => authController.updateProfile(req, res).catch(next));

// ─── Ads (client) ─────────────────────────────────────────────────────────────
export const adRouter = Router();
adRouter.use(authenticate, requireClient);
adRouter.get('/',                (req, res, next) => adController.list(req, res).catch(next));
adRouter.post('/',               (req, res, next) => adController.create(req, res).catch(next));
adRouter.get('/:id',             (req, res, next) => adController.get(req, res).catch(next));
adRouter.patch('/:id',           (req, res, next) => adController.update(req, res).catch(next));
adRouter.delete('/:id',          (req, res, next) => adController.delete(req, res).catch(next));
adRouter.post('/:id/submit',     (req, res, next) => adController.submit(req, res).catch(next));
adRouter.get('/:id/performance', (req, res, next) => adController.getPerformance(req, res).catch(next));

// ─── Admin ────────────────────────────────────────────────────────────────────
export const adminRouter = Router();
adminRouter.use(authenticate, requireAdmin);
adminRouter.get('/ads',              (req, res, next) => adminController.listAds(req, res).catch(next));
adminRouter.get('/ads/pending',      (req, res, next) => adminController.getPendingAds(req, res).catch(next));
adminRouter.post('/ads/:id/approve', (req, res, next) => adminController.approve(req, res).catch(next));
adminRouter.post('/ads/:id/reject',  (req, res, next) => adminController.reject(req, res).catch(next));
adminRouter.get('/stats',            (req, res, next) => adminController.getStats(req, res).catch(next));

// ─── AI ───────────────────────────────────────────────────────────────────────
export const aiRouter = Router();
aiRouter.use(authenticate);
aiRouter.post('/extract-url',    (req, res, next) => aiController.extractUrl(req, res).catch(next));
aiRouter.post('/generate-copy',  (req, res, next) => aiController.generateCopy(req, res).catch(next));
aiRouter.post('/regenerate-copy',(req, res, next) => aiController.regenerateCopy(req, res).catch(next));

// ─── Upload ───────────────────────────────────────────────────────────────────
export const uploadRouter = Router();
uploadRouter.use(authenticate);
uploadRouter.post('/creative',       upload.single('file'), (req, res, next) => uploadController.uploadCreative(req, res).catch(next));
uploadRouter.post('/presigned-url',  (req, res, next) => uploadController.getPresignedUrl(req, res).catch(next));

// ─── Webhooks (no auth — Meta calls these directly) ───────────────────────────
import { webhookController } from '../controllers/webhook.controller';
export const webhookRouter = Router();
webhookRouter.get('/meta',  (req, res) => webhookController.verify(req, res));
webhookRouter.post('/meta', (req, res, next) => webhookController.receive(req, res).catch(next));
