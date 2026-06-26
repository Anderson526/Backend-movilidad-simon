import db from '../config/database.js';
import { broadcast } from '../config/websocket.js'; 

const maskDeviceId = (id, role) => {
  if (role === 'admin') return id;
  const parts = id.split('-');
  if (parts.length === 3) {
    return `${parts[0]}-****-${parts[2]}`;
  }
  return id;
};

export const ingestTelemetry = (req, res) => {
  const { device_id, latitude, longitude, fuel_level, temperature, speed } = req.body;

  if (!device_id || latitude === undefined || longitude === undefined || fuel_level === undefined || temperature === undefined || speed === undefined) {
    return res.status(400).json({ error: 'Todos los campos de los sensores son requeridos.' });
  }

  const query = `
    INSERT INTO sensor_data (device_id, latitude, longitude, fuel_level, temperature, speed)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.run(query, [device_id, latitude, longitude, fuel_level, temperature, speed], function (err) {
    if (err) {
      return res.status(500).json({ error: 'Error al guardar la telemetría.' });
    }

    db.all(
      `SELECT fuel_level, timestamp FROM sensor_data WHERE device_id = ? ORDER BY timestamp DESC LIMIT 5`,
      [device_id],
      (err, rows) => {
        let triggerAlert = false;

        if (!err && rows.length >= 2) {
          const latest = rows[0];
          const oldest = rows[rows.length - 1];
          const timeDiffHours = (new Date(latest.timestamp) - new Date(oldest.timestamp)) / (1000 * 60 * 60);
          const fuelDiff = oldest.fuel_level - latest.fuel_level;

          if (timeDiffHours > 0 && fuelDiff > 0) {
            const consumptionRatePerHour = fuelDiff / timeDiffHours;
            const currentFuel = latest.fuel_level;
            const estimatedAutonomyHours = currentFuel / consumptionRatePerHour;

            if (estimatedAutonomyHours < 1) {
              triggerAlert = true;
            }
          }
        }

        // --- EMISIÓN EN TIEMPO REAL ---
        // objeto de telemetría en vivo
        const telemetryLivePayload = {
          device_id,
          latitude,
          longitude,
          fuel_level,
          temperature,
          speed,
          predictiveFuelAlert: triggerAlert, // Alerta predictiva en vivo
          timestamp: new Date().toISOString()
        };

        // Emitimos por el WebSocket a todos los clientes web conectados
        broadcast('telemetry_update', telemetryLivePayload);

        return res.status(201).json({
          message: 'Telemetría procesada con éxito.',
          dataId: this.lastID,
          predictiveFuelAlert: triggerAlert
        });
      }
    );
  });
};

export const getDevicesStatus = (req, res) => {
  const userRole = req.user.role;
  const query = `
    SELECT d.id, d.name, sd.latitude, sd.longitude, sd.fuel_level, sd.temperature, sd.speed, sd.timestamp
    FROM devices d
    LEFT JOIN sensor_data sd ON sd.device_id = d.id
    WHERE sd.id = (SELECT MAX(id) FROM sensor_data WHERE device_id = d.id) 
       OR sd.id IS NULL
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Error al obtener flotas.' });
    }
    const processedDevices = rows.map((device) => ({
      ...device,
      id: maskDeviceId(device.id, userRole),
    }));
    return res.json(processedDevices);
  });
};