import sqlite3 from 'sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, '../../database.sqlite');

// Conectar a la base de datos 
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error al conectar a SQLite:', err.message);
  } else {
    console.log('Conectado con éxito a la base de datos SQLite.');
  }
});

// Inicializar tablas esenciales
db.serialize(() => {
  // Tabla de Usuarios (roles: admin, user)
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      full_name TEXT,
      role TEXT NOT NULL DEFAULT 'user'
    )
  `);

  // Tabla de Dispositivos / Vehículos (para el IoT)
  db.run(`
    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY, -- Ej: DEV-1234-XC54
      name TEXT NOT NULL,
      status TEXT DEFAULT 'active'
    )
  `);

  // Tabla de Historial de Sensores (Ubicación, Combustible, Temperatura)
  db.run(`
    CREATE TABLE IF NOT EXISTS sensor_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id TEXT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      fuel_level REAL NOT NULL, -- Porcentaje o litros (0 a 100)
      temperature REAL NOT NULL,
      speed REAL NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (device_id) REFERENCES devices(id)
    )
  `);

  // Insertar datos de prueba iniciales (Solo si la tabla de usuarios está vacía)
  db.get("SELECT COUNT(*) as count FROM users", [], (err, row) => {
    if (row && row.count === 0) {
        //users de prueba
      db.run("INSERT INTO users (username, password, full_name, role) VALUES ('admin', 'admin123', 'Admin Super', 'admin')");
      db.run("INSERT INTO users (username, password, full_name, role) VALUES ('operador', 'user123', 'Operador Ejemplo', 'user')");
      
      // Dispositivos de prueba
      db.run("INSERT INTO devices (id, name) VALUES ('DEV-8832-XC54', 'Camión de Carga 1')");
      db.run("INSERT INTO devices (id, name) VALUES ('DEV-1102-AA99', 'Turbo Reparto 2')");
      
      console.log('Datos de prueba (usuarios y dispositivos) creados con éxito.');
    }
  });
});

export default db;