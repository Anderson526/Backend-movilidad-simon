import crypto from 'crypto';

const SECRET_KEY = 'tu_clave_secreta_super_segura_iot'; // En producción usaría process.env

// Función auxiliar para convertir a Base64Url
function toBase64Url(string, encoding = 'utf-8') {
  return Buffer.from(string, encoding)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

// Función auxiliar para decodificar desde Base64Url
function fromBase64Url(base64url) {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf-8');
}

// Generación JWT manualmente
export function generateToken(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  
  // Añadir tiempo de expiración (ej: 2 horas)
  const tokenPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + (2 * 60 * 60)
  };

  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(tokenPayload));

  // Crear la firma usando la librería criptográfica nativa de Node (crypto)
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(signatureInput)
    .digest();
  
  const encodedSignature = toBase64Url(signature, 'binary');

  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

// Validación JWT manualmente
export function verifyToken(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, encodedSignature] = parts;

    // Re-calcular la firma para verificar integridad
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const calculatedSignature = crypto
      .createHmac('sha256', SECRET_KEY)
      .update(signatureInput)
      .digest();
    
    const expectedSignature = toBase64Url(calculatedSignature, 'binary');

    // Si la firma no coincide, el token fue manipulado
    if (encodedSignature !== expectedSignature) return null;

    // Decodificar payload y verificar expiración
    const payload = JSON.parse(fromBase64Url(encodedPayload));
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      return null; // Token expirado
    }

    return payload; // Token válido, retornamos los datos del usuario
  } catch (error) {
    return null;
  }
}