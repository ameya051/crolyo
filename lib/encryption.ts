import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { logger } from "@/lib/logger";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex) {
    logger.error("encryption.key.missing");
    throw new Error("ENCRYPTION_KEY environment variable is not set");
  }
  const key = Buffer.from(keyHex, "hex");
  if (key.length !== 32) {
    logger.error("encryption.key.invalid_length", undefined, { keyLength: key.length });
    throw new Error("ENCRYPTION_KEY must be a 32-byte value encoded as 64 hex characters");
  }
  return key;
}

export function encrypt(plaintext: string): string {
  try {
    const key = getKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    logger.info("encryption.encrypt.succeeded");
    return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
  } catch (error) {
    logger.error("encryption.encrypt.failed", error);
    throw error;
  }
}

export function decrypt(encrypted: string): string {
  try {
    const key = getKey();
    const data = Buffer.from(encrypted, "base64");
    if (data.length < IV_LENGTH + AUTH_TAG_LENGTH) {
      logger.warn("encryption.decrypt.invalid_payload", { payloadLength: data.length });
      throw new Error("Invalid encrypted payload");
    }
    const iv = data.subarray(0, IV_LENGTH);
    const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    logger.info("encryption.decrypt.succeeded");
    return plaintext.toString("utf8");
  } catch (error) {
    logger.error("encryption.decrypt.failed", error);
    throw error;
  }
}
