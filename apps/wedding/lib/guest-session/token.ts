import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const TOKEN_VERSION = "v1";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_SESSION_SECONDS = 60 * 60 * 24 * 180;

interface EncodedGuestSessionClaims {
  sub: string;
  iat: number;
  exp: number;
  jti: string;
  v: 1;
}

export interface SignGuestSessionOptions {
  now?: Date;
  ttlSeconds?: number;
  nonce?: string;
}

function assertSecret(secret: string): void {
  if (Buffer.byteLength(secret, "utf8") < 32) {
    throw new TypeError("Guest session secret must contain at least 32 bytes");
  }
}

function signatureFor(content: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(content).digest();
}

export function signGuestSessionToken(
  invitationId: string,
  secret: string,
  options: SignGuestSessionOptions = {},
): string {
  if (!UUID_PATTERN.test(invitationId)) {
    throw new TypeError("Invitation ID must be a UUID");
  }

  assertSecret(secret);

  const ttlSeconds = options.ttlSeconds ?? MAX_SESSION_SECONDS;
  if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds < 60 || ttlSeconds > MAX_SESSION_SECONDS) {
    throw new RangeError("Guest session lifetime is outside the allowed range");
  }

  const issuedAt = Math.floor((options.now ?? new Date()).getTime() / 1000);
  const claims: EncodedGuestSessionClaims = {
    sub: invitationId,
    iat: issuedAt,
    exp: issuedAt + ttlSeconds,
    jti: options.nonce ?? randomBytes(16).toString("base64url"),
    v: 1,
  };
  const encodedClaims = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
  const signedContent = `${TOKEN_VERSION}.${encodedClaims}`;
  const signature = signatureFor(signedContent, secret).toString("base64url");

  return `${signedContent}.${signature}`;
}

export function verifyGuestSessionToken(
  token: string | null | undefined,
  secret: string,
  now: Date = new Date(),
): { invitationId: string } | null {
  if (!token || token.length > 1024) {
    return null;
  }

  try {
    assertSecret(secret);
    const [version, encodedClaims, encodedSignature, extra] = token.split(".");
    if (version !== TOKEN_VERSION || !encodedClaims || !encodedSignature || extra !== undefined) {
      return null;
    }

    const expected = signatureFor(`${version}.${encodedClaims}`, secret);
    const supplied = Buffer.from(encodedSignature, "base64url");
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      return null;
    }

    const claims = JSON.parse(
      Buffer.from(encodedClaims, "base64url").toString("utf8"),
    ) as Partial<EncodedGuestSessionClaims>;
    const nowSeconds = Math.floor(now.getTime() / 1000);

    if (
      claims.v !== 1 ||
      typeof claims.sub !== "string" ||
      !UUID_PATTERN.test(claims.sub) ||
      typeof claims.iat !== "number" ||
      !Number.isSafeInteger(claims.iat) ||
      typeof claims.exp !== "number" ||
      !Number.isSafeInteger(claims.exp) ||
      typeof claims.jti !== "string" ||
      claims.jti.length < 16 ||
      claims.iat > nowSeconds + 60 ||
      claims.exp <= nowSeconds ||
      claims.exp - claims.iat > MAX_SESSION_SECONDS
    ) {
      return null;
    }

    return { invitationId: claims.sub };
  } catch {
    return null;
  }
}

export const guestSessionMaxAgeSeconds = MAX_SESSION_SECONDS;
