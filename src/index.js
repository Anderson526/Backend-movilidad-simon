// src/index.js
// Punto de entrada inicial para el backend API.
// Requerimientos principales:
// - Autenticación JWT manual
// - Endpoints de ingesta de sensores (GPS, combustible, temperatura)
// - Cálculo predictivo de combustible y alertas
// - Persistencia en PostgreSQL/SQLite
// - WebSockets para actualizaciones en tiempo real

console.log('Backend skeleton creado.');


import express from 'express';
import cors from 'cors';
import db from './config/database.js';
import authRoutes from './routes/authRoutes.js';
import deviceRoutes from './routes/deviceRoutes.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Registrar rutas
app.use('/api', authRoutes); // <- Ruta de autenticación conectada

app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Servidor corriendo' });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor backend escuchando en http://localhost:${PORT}`);
});