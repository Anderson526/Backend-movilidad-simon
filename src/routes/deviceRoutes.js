import { Router } from 'express';
import { ingestTelemetry, getDevicesStatus } from '../controllers/deviceController.js';
import { authenticateJWT } from '../middlewares/authMiddleware.js';

const router = Router();

// Endpoint público o IoT para recibir telemetría de los vehículos
router.post('/telemetry', ingestTelemetry);

// Endpoint protegido: Requiere JWT manual para ver el listado y estado de la flota
router.get('/devices', authenticateJWT, getDevicesStatus);

export default router;