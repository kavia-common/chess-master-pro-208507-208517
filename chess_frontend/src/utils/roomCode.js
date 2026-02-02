const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// PUBLIC_INTERFACE
export function createRoomCode(len = 6) {
  let out = "";
  for (let i = 0; i < len; i += 1) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}
