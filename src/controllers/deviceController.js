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

// Devuelve estadísticas específicas por usuario extraídas de `sensor_data`.
// Si el usuario es admin, muestra `device_id` completo y nombre del dispositivo.
// Si es operador (user), enmascara el device_id.
export const getUserStats = (req, res) => {
  const userRole = req.user.role;
  const userId = req.user.id;

  // Para este ejemplo simple, si es admin devolvemos stats de todos los dispositivos.
  // Para usuarios regulares podríamos filtrar por algún mapeo usuario->device; aquí asumimos acceso limitado a ids.

  const query = `
    SELECT sd.device_id, d.name as device_name, sd.latitude, sd.longitude, sd.fuel_level, sd.speed, sd.timestamp
    FROM sensor_data sd
    LEFT JOIN devices d ON d.id = sd.device_id
    WHERE sd.id IN (
      SELECT MAX(id) FROM sensor_data GROUP BY device_id
    )
    ORDER BY sd.timestamp DESC
  `;

  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Error obteniendo estadísticas' });

    const processed = rows.map(r => ({
      device_id: userRole === 'admin' ? r.device_id : maskDeviceId(r.device_id, userRole),
      device_name: userRole === 'admin' ? r.device_name : undefined,
      latitude: r.latitude,
      longitude: r.longitude,
      fuel_level: r.fuel_level,
      speed: r.speed,
      timestamp: r.timestamp
    }));

    return res.json({ user: { id: userId, role: userRole }, stats: processed });
  });
}

// Devuelve historial de sensores agrupado por dispositivo.
export const getHistory = (req, res) => {
  const userRole = req.user.role;

  // Tomamos los últimos 500 registros y los agrupamos por device_id en el servidor.
  const query = `SELECT device_id, speed, fuel_level, timestamp FROM sensor_data ORDER BY timestamp DESC LIMIT 500`;

  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Error obteniendo historial' });

    const grouped = {};
    rows.forEach(r => {
      const key = userRole === 'admin' ? r.device_id : maskDeviceId(r.device_id, userRole);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push({ ts: r.timestamp, speed: r.speed, fuel: r.fuel_level });
    });

    // Para cada dispositivo, invertimos para ordenar ascendente por tiempo y limitamos a 50 puntos
    Object.keys(grouped).forEach(k => {
      grouped[k] = grouped[k].slice(0, 50).reverse();
    });

    return res.json({ history: grouped });
  });
}

// Devuelve alertas predictivas. Solo admin recibe alertas; operadores reciben lista vacía.
export const getAlerts = (req, res) => {
  const userRole = req.user.role;

  if (userRole !== 'admin') {
    return res.json({ alerts: [] });
  }

  // Para cada dispositivo, calculamos a partir de los últimos 5 registros si hay alerta predictiva
  const devicesQuery = `SELECT id FROM devices`;
  db.all(devicesQuery, [], (err, devices) => {
    if (err) return res.status(500).json({ error: 'Error consultando dispositivos' });

    const alerts = [];

    let remaining = devices.length;
    if (remaining === 0) return res.json({ alerts });

    devices.forEach((d) => {
      db.all(
        `SELECT fuel_level, timestamp FROM sensor_data WHERE device_id = ? ORDER BY timestamp DESC LIMIT 5`,
        [d.id],
        (err2, rows) => {
          if (!err2 && rows && rows.length >= 2) {
            const latest = rows[0];
            const oldest = rows[rows.length - 1];
            const timeDiffHours = (new Date(latest.timestamp) - new Date(oldest.timestamp)) / (1000 * 60 * 60);
            const fuelDiff = oldest.fuel_level - latest.fuel_level;

            if (timeDiffHours > 0 && fuelDiff > 0) {
              const consumptionRatePerHour = fuelDiff / timeDiffHours;
              const currentFuel = latest.fuel_level;
              const estimatedAutonomyHours = consumptionRatePerHour > 0 ? currentFuel / consumptionRatePerHour : Infinity;

              if (estimatedAutonomyHours < 1) {
                alerts.push({ deviceId: d.id, title: 'Alerta predictiva: baja autonomía', message: `Autonomía estimada: ${estimatedAutonomyHours.toFixed(2)} h`, level: 'ALTA' });
              }
            }
          }

          remaining -= 1;
          if (remaining === 0) {
            return res.json({ alerts });
          }
        }
      );
    });
  });
}