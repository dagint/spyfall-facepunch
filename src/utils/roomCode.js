const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I/O/0/1 to avoid confusion

/** Generate a random 4-character room code */
export function generateRoomCode() {
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

/** Validate a room code format */
export function isValidRoomCode(code) {
  if (typeof code !== 'string') return false;
  code = code.toUpperCase().trim();
  return code.length === 4 && [...code].every((c) => CHARS.includes(c));
}

/** Normalize a room code to uppercase */
export function normalizeRoomCode(code) {
  return String(code).toUpperCase().trim();
}
