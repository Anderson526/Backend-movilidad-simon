import db from '../config/database.js';

// Función utilitaria para enmascarar IDs de dispositivos si NO es admin (Requisito de Privacidad)
const maskDeviceId = (id, role) => {
  if (role === 'admin') return id;
  // Transforma DEV-8832-XC54 -> DEV-****-XC54
  const parts = id.split('-');
  if (parts.length === 3) {
    return `${parts[0]}-****-${parts[2]}`;
  }
  return id;
};

//Ingesta de datos de sensores (POST /api/telemetry)
export const ingestTelemetry = (req, res) => {
  const { device_id, latitude, longitude, fuel_level, temperature, speed } = req.body;

  if (!device_id || latitude === undefined || longitude === undefined || fuel_level === undefined || temperature === undefined || speed === undefined) {
    return res.status(400).json({ error: 'Todos los campos de los sensores son requeridos.' });
  }

  // Insertar la lectura actual en la base de datos
  const query = `
    INSERT INTO sensor_data (device_id, latitude, longitude, fuel_level, temperature, speed)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.run(query, [device_id, latitude, longitude, fuel_level, temperature, speed], function (err) {
    if (err) {
      return res.status(500).json({ error: 'Error al guardar la telemetría.' });
    }

    // --- ALGORITMO PREDICTIVO DE COMBUSTIBLE ---
    // Obtenemos las últimas lecturas para calcular la tasa de consumo de este vehículo
    db.all(
      `SELECT fuel_level, timestamp FROM sensor_data WHERE device_id = ? ORDER BY timestamp DESC LIMIT 5`,
      [device_id],
      (err, rows) => {
        let triggerAlert = false;

        if (!err && rows.length >= 2) {
          const latest = rows[0];
          const oldest = rows[rows.length - 1];
          
          // Diferencia de tiempo en horas
          const timeDiffHours = (new Date(latest.timestamp) - new Date(oldest.timestamp)) / (1000 * 60 * 60);
          // Diferencia de nivel de combustible
          const fuelDiff = oldest.fuel_level - latest.fuel_level;

          if (timeDiffHours > 0 && fuelDiff > 0) {
            const consumptionRatePerHour = fuelDiff / timeDiffHours; // Cuánto consume por hora
            const currentFuel = latest.fuel_level;
            const estimatedAutonomyHours = currentFuel / consumptionRatePerHour;

            // Si le queda menos de 1 hora de autonomía, activamos la alerta predictiva
            if (estimatedAutonomyHours < 1) {
              triggerAlert = true;
            }
          }
        }

        return res.status(201).json({
          message: 'Telemetría procesada con éxito.',
          dataId: this.lastID,
          predictiveFuelAlert: triggerAlert // Informa si el nivel bajará a < 1 hora de autonomía
        });
      }
    );
  });
};

// Obtener la última ubicación de las flotas (GET /api/devices)
export const getDevicesStatus = (req, res) => {
  const userRole = req.user.role; // Obtenido del token manual gracias al middleware

  // Obtiene el último registro de telemetría de cada vehículo registrado
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

    // Mapear los resultados aplicando enmascaramiento de privacidad de ID si no es admin
    const processedDevices = rows.map((device) => ({
      ...device,
      id: maskDeviceId(device.id, userRole), // Aplica máscara si corresponde
    }));

    return res.json(processedDevices);
  });
};