import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import db from './config/database.js';
import authRoutes from './routes/authRoutes.js';
import deviceRoutes from './routes/deviceRoutes.js'; 
import { initWebSocket } from './config/websocket.js';
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api', authRoutes);
app.use('/api', deviceRoutes); 

app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Servidor corriendo' });
});

// Servidor HTTP Combinado
const server = createServer(app);

// Inicializar WebSockets compartiendo el mismo servidor y puerto
initWebSocket(server);

server.listen(PORT, () => {
  console.log(`Servidor backend escuchando en http://localhost:${PORT}`);
});