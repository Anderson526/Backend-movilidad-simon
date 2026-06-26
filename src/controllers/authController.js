import db from '../config/database.js';
import { generateToken } from '../utils/jwt.js';

export const login = (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  }

  // Buscar usuario en SQLite
  db.get(
    'SELECT id, username, password, role FROM users WHERE username = ?',
    [username],
    (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Error interno del servidor' });
      }

      if (!user || user.password !== password) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }

      // Generar token con la lógica manual pasándole ID y Rol
      const token = generateToken({ id: user.id, username: user.username, role: user.role });

      return res.json({
        message: 'Autenticación exitosa',
        token,
        user: { id: user.id, username: user.username, role: user.role }
      });
    }
  );
};