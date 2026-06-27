import db from '../config/database.js';
import { generateToken } from '../utils/jwt.js';

export const login = (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  }

  // Buscar usuario en SQLite
  db.get(
    'SELECT id, username, password, role, full_name FROM users WHERE username = ?',
    [username],
    (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Error interno del servidor' });
      }

      if (!user || user.password !== password) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }

      // Generar token con la lógica manual pasándole ID, Rol y nombre completo
      const token = generateToken({ id: user.id, username: user.username, role: user.role, full_name: user.full_name });

      return res.json({
        message: 'Autenticación exitosa',
        token,
        user: { id: user.id, username: user.username, role: user.role, full_name: user.full_name }
      });
    }
  );
};

export const register = (req, res) => {
  const { username, password, full_name, role } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  }

  // role se permite opcionalmente, por defecto 'user'
  const userRole = role || 'user';

  db.run(
    'INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)',
    [username, password, full_name || null, userRole],
    function (err) {
      if (err) {
        if (err.message && err.message.includes('UNIQUE')) {
          return res.status(409).json({ error: 'El nombre de usuario ya existe' });
        }
        return res.status(500).json({ error: 'Error al crear el usuario' });
      }

      const createdUser = { id: this.lastID, username, full_name: full_name || null, role: userRole };
      const token = generateToken({ id: createdUser.id, username: createdUser.username, role: createdUser.role, full_name: createdUser.full_name });

      return res.status(201).json({ message: 'Usuario creado', user: createdUser, token });
    }
  );
};