export const SESSION_COOKIE = "nook_session";

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

async function signature(username: string, secret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const result = await crypto.subtle.sign("HMAC", key, encoder.encode(username));
  return toBase64Url(new Uint8Array(result));
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

export async function createSessionToken(username: string, secret: string) {
  return `${encodeURIComponent(username)}.${await signature(username, secret)}`;
}

export async function verifySessionToken(token: string | undefined, username: string, secret: string) {
  if (!token) return false;
  const separator = token.lastIndexOf(".");
  if (separator < 1) return false;
  const tokenUsername = decodeURIComponent(token.slice(0, separator));
  if (!constantTimeEqual(tokenUsername, username)) return false;
  const expected = await createSessionToken(username, secret);
  return constantTimeEqual(token, expected);
}
