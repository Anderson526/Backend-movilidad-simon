# Backend - Movilidad (Documentación)

## Resumen del proyecto
Backend en Node.js (Express) + SQLite + WebSocket para ingestión de telemetría IoT, consulta del estado de la flota y autenticación básica.

- Tecnologías: Node (ES modules), Express 5, sqlite3, ws, cors.
- Entrypoint: `src/index.js`
- Base de datos: `database.sqlite` en la raíz del proyecto.


## Estructura del repositorio

- package.json — scripts: `dev` (nodemon) y `start`.
- database.sqlite — base de datos SQLite local (creada y utilizada por `src/config/database.js`).
- src/
  - index.js — inicializa Express, rutas y WebSocket server.
  - config/
    - database.js — conexión SQLite, creación automática de tablas y seed inicial.
    - websocket.js — `initWebSocket(server)` y `broadcast(event, data)`.
  - controllers/
    - authController.js — `login` (POST /api/login).
    - deviceController.js — `ingestTelemetry` (POST /api/telemetry) y `getDevicesStatus` (GET /api/devices).
  - routes/
    - authRoutes.js — POST `/api/login`.
    - deviceRoutes.js — POST `/api/telemetry` (público), GET `/api/devices` (protegido).
  - middlewares/
    - authMiddleware.js — `authenticateJWT`, `authorizeRoles(...)`.
  - utils/
    - jwt.js — implementación manual de JWT (`generateToken`, `verifyToken`).


## Base de datos (esquema)

Tablas principales (creadas en `src/config/database.js`):

- users
  - id INTEGER PRIMARY KEY AUTOINCREMENT
  - username TEXT UNIQUE NOT NULL
  - password TEXT NOT NULL
  - role TEXT NOT NULL DEFAULT 'user'
  - Seed: `admin` / `admin123` (admin), `operador` / `user123` (user)

- devices
  - id TEXT PRIMARY KEY (ej. `DEV-8832-XC54`)
  - name TEXT NOT NULL
  - status TEXT DEFAULT 'active'

- sensor_data
  - id INTEGER PRIMARY KEY AUTOINCREMENT
  - device_id TEXT (FK -> devices.id)
  - latitude REAL NOT NULL
  - longitude REAL NOT NULL
  - fuel_level REAL NOT NULL
  - temperature REAL NOT NULL
  - speed REAL NOT NULL
  - timestamp DATETIME DEFAULT CURRENT_TIMESTAMP


## Endpoints API

- POST /api/login
  - Descripción: autenticación básica.
  - Body: `{ "username": string, "password": string }`
  - Respuestas: 200 + `{ token, user }` | 400/401/500
  - Nota: contraseñas comparadas en texto plano (mejorar).

- POST /api/telemetry
  - Descripción: endpoint público para que dispositivos IoT envíen telemetría.
  - Body: `{ device_id, latitude, longitude, fuel_level, temperature, speed }`
  - Acciones: inserta en `sensor_data`, calcula alerta predictiva de combustible usando últimas 5 lecturas, emite evento WebSocket `telemetry_update`.
  - Respuesta: 201 con `{ dataId, predictiveFuelAlert }` o 400/500.

- GET /api/devices
  - Descripción: lista dispositivos con última telemetría.
  - Autorización: `Authorization: Bearer <token>` requerido (middleware `authenticateJWT`).
  - Lógica: LEFT JOIN con `sensor_data` para obtener última lectura por dispositivo; aplica `maskDeviceId` si el rol no es `admin`.


## JWT (implementación y recomendaciones)

- Implementación actual: `src/utils/jwt.js` crea/verifica JWT manualmente con HMAC-SHA256.
  - Header: `{ alg: 'HS256', typ: 'JWT' }`
  - Payload: se añade `exp` (2 horas).
  - Secret: `tu_clave_secreta_super_segura_iot` (valor en código).

- Recomendaciones:
  - Mover secret a variable de entorno (`process.env.JWT_SECRET`) y usar dotenv.
  - Usar la librería `jsonwebtoken` para robustez y manejo de refresh tokens.
  - Implementar revocación/blacklist si se necesita logout inmediato.


## WebSocket (tiempo real)

- Inicialización: `initWebSocket(server)` en `src/config/websocket.js`.
- Broadcast: `broadcast(event, data)` envía `{ event, data }` JSON a clientes conectados.
- Evento principal: `telemetry_update` con payload:
  ```json
  {
    "device_id": "DEV-...",
    "latitude": 12.3,
    "longitude": -45.6,
    "fuel_level": 50,
    "temperature": 22,
    "speed": 60,
    "predictiveFuelAlert": false,
    "timestamp": "2026-..."
  }
  ```


## Middlewares y autorización

- `authenticateJWT` verifica header `Authorization: Bearer <token>` y coloca `req.user` con `{ id, username, role }`.
- `authorizeRoles(...allowedRoles)` restringe rutas por rol.


## Lógicas críticas y validaciones

- `ingestTelemetry` valida que todos los campos de sensores estén presentes.
- Cálculo de alerta predictiva de combustible:
  - Toma hasta 5 lecturas recientes, calcula tasa de consumo por hora y estima autonomía.
  - Si la autonomía estimada < 1 hora => `predictiveFuelAlert: true`.
- `maskDeviceId` oculta parte del ID para usuarios no-admin (`DEV-****-XC54`).


## Cómo ejecutar

1. Instalar dependencias:

```bash
npm install
```

2. Ejecutar en desarrollo:

```bash
npm run dev
```

3. Ejecutar en producción:

```bash
npm start
```

- Variable opcional: `PORT` (por defecto 3000).
- JWT secret: mover a `process.env.JWT_SECRET` en producción.


## Ejemplos (curl)

- Login:

```bash
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

- Enviar telemetría:

```bash
curl -X POST http://localhost:3000/api/telemetry \
  -H "Content-Type: application/json" \
  -d '{"device_id":"DEV-8832-XC54","latitude":12.3,"longitude":-45.6,"fuel_level":50,"temperature":22,"speed":60}'
```

- Consultar dispositivos (protegido):

```bash
curl -X GET http://localhost:3000/api/devices \
  -H "Authorization: Bearer <TOKEN>"
```


## Notas de seguridad y mejoras sugeridas

1. No guardar contraseñas en texto plano: usar `bcrypt` para hashear contraseñas.
2. Mover secret JWT a variables de entorno y usar librería `jsonwebtoken`.
3. Forzar HTTPS en producción y habilitar cabeceras de seguridad (helmet).
4. Validar y sanear entradas con `Joi` o `zod`.
5. Añadir logging estructurado y manejo de errores centralizado.
6. Considerar paginación y límites para consultas a la DB.


## Posibles próximos pasos
- Generar una colección Postman / Insomnia con ejemplos.
- Añadir refresh tokens y logout seguro.
- Implementar hashing de contraseñas y migrar usuarios existentes.
- Añadir pruebas unitarias/integración.



