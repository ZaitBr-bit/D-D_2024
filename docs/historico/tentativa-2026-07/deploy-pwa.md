# Deploy (GitHub Pages) e PWA

## Pipeline determinístico

Nada de `sed`, cópias manuais ou edição de artefato no workflow — o artifact
é gerado e verificado por scripts versionados:

1. **`npm run build:pages -- --out _dist --version <versão>`**
   (`scripts/prepare-pages.mjs`): monta o artifact do Pages a partir de
   `site/` + `dados/pacotes/**`, substitui o marcador único
   `__DEPLOY_VERSION__` (título do app e versão do SW) e gera o manifesto de
   precache (`scripts/precache-manifest.mjs`) com **SHA-256 real** de cada
   arquivo. A geração é determinística: mesmo input ⇒ mesmo output.
2. **`npm run verify:pages -- --dir _dist`**
   (`scripts/verify-pages-artifact.mjs`): verificação INDEPENDENTE do
   artifact (arquivos previstos, hashes do manifesto, versão aplicada,
   nenhum resíduo de dev).
3. **`.github/workflows/deploy.yml`**: publica no Pages somente após o
   workflow reutilizável `ci.yml` passar por inteiro (`needs: verify`) —
   Node/dados, Firestore Emulator, browser (funcional + compat + PWA +
   visual). Falhou qualquer job, não há publicação.

## Service Worker transacional (`site/sw.js`)

- A versão do SW carrega o marcador `DEPLOY_VERSION`; instalar uma versão
  nova só "vira" depois de TODO o precache baixado e validado (instalação
  transacional — nunca um cache meio-atualizado).
- **Cache-first estrito por manifesto**: só entra no cache de precache o que
  está no manifesto gerado no build, verificado por hash.
- Recursos fora do manifesto usam um cache separado (`CACHE_ONDEMAND`),
  nunca misturado ao precache.
- `site/js/infra/pwa/service-worker-client.js` aplica updates e recarrega a
  página "quando seguro" (sem modal aberto/edição em curso).

Cobertura automatizada: `tests/e2e/pwa-precache.spec.js`,
`pwa-offline.spec.js`, `pwa-update.spec.js` (config próprio
`playwright.pwa.config.js`, servido sob um prefixo de path como no Pages) e
`tests/deploy/**` (manifesto, artifact, workflows).

## CSP

`site/index.html` declara a Content-Security-Policy do app. Desde a Task 37,
`script-src` NÃO contém `'unsafe-inline'` (nenhum handler inline sobrou —
gate `check:inline-handlers`); `style-src` mantém `'unsafe-inline'` por
escopo aprovado. Origem externa permitida apenas para o SDK do
Firebase/Google (gstatic/googleapis) — a asserção vive em
`tests/e2e/security-content.spec.js`.

## Verificação manual do prompt de instalação

Único item manual (o restante é automatizado): confirmar que o navegador
oferece o prompt NATIVO de instalação da PWA e que o app abre standalone —
ver roteiro em `docs/testing.md`.
