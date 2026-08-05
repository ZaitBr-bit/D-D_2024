// ============================================================
// Utilitário mínimo de hash SHA-256 usado pelo pipeline de deploy
// determinístico (Task 35): gerador do artifact Pages e verificador.
// ============================================================
import { createHash } from 'node:crypto';

/**
 * Calcula o SHA-256 dos bytes fornecidos.
 * @param {Buffer|Uint8Array} bytes - conteúdo já lido do disco (bytes finais,
 *   pós-transformação — nunca uma string tratada como texto/encoding).
 * @returns {string} hash em hexadecimal minúsculo (64 caracteres).
 */
export function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
