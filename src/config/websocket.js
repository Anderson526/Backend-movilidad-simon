import { WebSocketServer } from 'ws';

let wss = null;
const clients = new Set();

// Inicializar el servidor de WebSockets acoplado al servidor HTTP de Express
export const initWebSocket = (server) => {
  wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('Nuevo cliente Frontend conectado por WebSocket');

    ws.on('close', () => {
      clients.delete(ws);
      console.log('Cliente Frontend desconectado de WebSocket');
    });
  });
};

// Función global para emitir eventos en tiempo real desde cualquier controlador
export const broadcast = (event, data) => {
  const payload = JSON.stringify({ event, data });
  
  for (const client of clients) {
    if (client.readyState === 1) { // 1 significa estado OPEN
      client.send(payload);
    }
  }
};