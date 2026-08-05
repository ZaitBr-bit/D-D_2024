// Utilitário vendorizado a partir de `ajv-formats/dist/formats.js`
// (ajv-formats 3.0.1, MIT) — só a implementação do format "date-time" em
// modo estrito (fuso horário obrigatório), reescrita como ESM puro sem
// dependências. Fiel ao algoritmo original: `date()` valida a parte de
// data (incluindo ano bissexto), `time()` valida a parte de hora (incluindo
// segundo bissexto) exigindo fuso horário, e `date_time()` exige as duas
// partes separadas por "T"/espaço — RFC 3339 §5.6. Rejeita corretamente
// mês/dia/hora fora de faixa e offsets de fuso horário inválidos (ex.:
// "2026-02-30T12:00:00Z", "2026-07-28T99:00:00Z",
// "2026-02-28T12:00:00+25:00"), o que uma validação por regex simples não
// consegue expressar.
//
// Mantido aqui (em vez de importar o pacote `ajv-formats`) para que o
// navegador nunca precise carregar o motor `ajv-formats` completo, só esta
// implementação de um único format. Exportado no mesmo formato
// `{ fullFormats: { "date-time": { validate, compare } } }` que o código
// standalone gerado pelo Ajv espera (ver
// scripts/generate-schema-validators.mjs, RUNTIME_REQUIRE_SUBSTITUTIONS).

/**
 * @param {number} year
 * @returns {boolean}
 */
function isLeapYear(year) {
  // https://tools.ietf.org/html/rfc3339#appendix-C
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

const DATE = /^(\d\d\d\d)-(\d\d)-(\d\d)$/;
const DAYS = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * Valida a parte de data (full-date, RFC 3339 §5.6), incluindo ano
 * bissexto para fevereiro.
 * @param {string} str
 * @returns {boolean}
 */
function date(str) {
  const matches = DATE.exec(str);
  if (!matches) return false;
  const year = +matches[1];
  const month = +matches[2];
  const day = +matches[3];
  return month >= 1 && month <= 12 && day >= 1 && day <= (month === 2 && isLeapYear(year) ? 29 : DAYS[month]);
}

/**
 * @param {string} d1
 * @param {string} d2
 * @returns {number|undefined}
 */
function compareDate(d1, d2) {
  if (!(d1 && d2)) return undefined;
  if (d1 > d2) return 1;
  if (d1 < d2) return -1;
  return 0;
}

const TIME = /^(\d\d):(\d\d):(\d\d(?:\.\d+)?)(z|([+-])(\d\d)(?::?(\d\d))?)?$/i;

/**
 * Valida a parte de hora (full-time, RFC 3339 §5.6) exigindo fuso horário
 * (modo estrito, igual ao `fullFormats["date-time"]` do ajv-formats
 * quando registrado sem `{mode: "fast"}` — o modo padrão de `addFormats`).
 * @param {string} str
 * @returns {boolean}
 */
function time(str) {
  const matches = TIME.exec(str);
  if (!matches) return false;
  const hr = +matches[1];
  const min = +matches[2];
  const sec = +matches[3];
  const tz = matches[4];
  const tzSign = matches[5] === '-' ? -1 : 1;
  const tzH = +(matches[6] || 0);
  const tzM = +(matches[7] || 0);
  if (tzH > 23 || tzM > 59 || !tz) return false;
  if (hr <= 23 && min <= 59 && sec < 60) return true;
  // segundo bissexto
  const utcMin = min - tzM * tzSign;
  const utcHr = hr - tzH * tzSign - (utcMin < 0 ? 1 : 0);
  return (utcHr === 23 || utcHr === -1) && (utcMin === 59 || utcMin === -1) && sec < 61;
}

/**
 * @param {string} s1
 * @param {string} s2
 * @returns {number|undefined}
 */
function compareTime(s1, s2) {
  if (!(s1 && s2)) return undefined;
  const t1 = new Date(`2020-01-01T${s1}`).valueOf();
  const t2 = new Date(`2020-01-01T${s2}`).valueOf();
  if (!(t1 && t2)) return undefined;
  return t1 - t2;
}

const DATE_TIME_SEPARATOR = /t|\s/i;

/**
 * Valida um timestamp completo (date-time, RFC 3339 §5.6): data + "T"/espaço
 * + hora, com fuso horário obrigatório.
 * @param {string} str
 * @returns {boolean}
 */
function dateTime(str) {
  const parts = str.split(DATE_TIME_SEPARATOR);
  return parts.length === 2 && date(parts[0]) && time(parts[1]);
}

/**
 * @param {string} dt1
 * @param {string} dt2
 * @returns {number|undefined}
 */
function compareDateTime(dt1, dt2) {
  if (!(dt1 && dt2)) return undefined;
  const d1 = new Date(dt1).valueOf();
  const d2 = new Date(dt2).valueOf();
  if (!(d1 && d2)) return undefined;
  return d1 - d2;
}

export default {
  fullFormats: {
    'date-time': { validate: dateTime, compare: compareDateTime },
  },
};
