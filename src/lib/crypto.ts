import { createCipheriv, createDecipheriv, randomBytes } from "crypto"

/**
 * Criptografia simétrica (AES-256-GCM) para guardar segredos em repouso —
 * em especial os tokens OAuth do Mercado Pago de cada salão, que dão acesso
 * ao dinheiro do vendedor. NUNCA logar o texto puro.
 *
 * A chave vem de ENCRYPTION_KEY (32 bytes em base64). Gere com:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 *
 * Formato de saída (texto): base64(iv) : base64(authTag) : base64(ciphertext)
 */

const ALGO = "aes-256-gcm"
const IV_BYTES = 12 // recomendado p/ GCM

export class EncryptionKeyMissingError extends Error {
  constructor() {
    super("ENCRYPTION_KEY não configurada (32 bytes em base64)")
    this.name = "EncryptionKeyMissingError"
  }
}

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY
  if (!raw) throw new EncryptionKeyMissingError()
  const key = Buffer.from(raw, "base64")
  if (key.length !== 32) {
    throw new Error(
      "ENCRYPTION_KEY inválida: precisa ter 32 bytes (base64 de 32 bytes)."
    )
  }
  return key
}

export function encrypt(plain: string): string {
  const key = getKey()
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGO, key, iv)
  const ciphertext = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return [
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":")
}

export function decrypt(payload: string): string {
  const key = getKey()
  const [ivB64, tagB64, dataB64] = payload.split(":")
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Texto criptografado em formato inválido")
  }
  const iv = Buffer.from(ivB64, "base64")
  const tag = Buffer.from(tagB64, "base64")
  const data = Buffer.from(dataB64, "base64")
  const decipher = createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8"
  )
}

export function isEncryptionConfigured(): boolean {
  try {
    getKey()
    return true
  } catch {
    return false
  }
}
