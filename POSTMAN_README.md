Instrucciones rápidas — Colección Postman

1) Importar la colección
- Abre Postman -> Import -> File -> selecciona `postman_collection.json` (ubicado en la raíz del backend). 

2) Importar el Environment
- Import -> File -> selecciona `postman_environment.json`.

3) Ejecutar el servidor
- Asegúrate de arrancar el backend en `http://localhost:3000`.

4) Obtener token
- Llama a `POST /api/login` con credenciales (por ejemplo desde la colección: `operator1` / `pass123`).
- Copia el `token` devuelto y pégalo en la variable de entorno `token` (o usa la opción de Postman para guardar la respuesta en la variable).

5) Usar endpoints protegidos
- Después de configurar `token`, puedes ejecutar `GET /api/devices` y `GET /api/stats`.

Notas
- `POST /api/telemetry` es público: puede ser llamado por dispositivos IoT sin token.
- Si quieres que añada ejemplos de respuesta o scripts de test en la colección, dímelo y los añado.