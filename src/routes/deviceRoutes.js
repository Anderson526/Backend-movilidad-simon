import { Router } from 'express';
import { ingestTelemetry, getDevicesStatus, getUserStats, getHistory, getAlerts } from '../controllers/deviceController.js';
import { authenticateJWT } from '../middlewares/authMiddleware.js';

const router = Router();

// Endpoint público o IoT para recibir telemetría de los vehículos
router.post('/telemetry', ingestTelemetry);

// Endpoint protegido: Requiere JWT manual para ver el listado y estado de la flota
router.get('/devices', authenticateJWT, getDevicesStatus);
router.get('/stats', authenticateJWT, getUserStats);
router.get('/history', authenticateJWT, getHistory);
router.get('/alerts', authenticateJWT, getAlerts);

export default router;