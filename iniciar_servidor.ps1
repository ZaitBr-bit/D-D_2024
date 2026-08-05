# ============================================================
# Servidor local de desenvolvimento (Task 37).
#
# Runtime local NAO exige Node: o padrao continua `python -m http.server`
# (qualquer Python 3 do PATH, sem .venv). Node e obrigatorio apenas para
# testes/validacao/artifact — quem ja o tem pode optar pelo MESMO servidor
# estatico usado pelos testes (scripts/serve-static.mjs) com -UsarNode.
#
# Parametros:
#   -Porta <n>          porta do servidor (padrao 8000; com -UsarNode, 4173)
#   -UsarNode           usa `node scripts/serve-static.mjs` em vez de Python
#   -AbrirNavegador     abre o navegador na pagina inicial (nunca abre sozinho)
# ============================================================
param(
    [int]$Porta = 0,
    [switch]$UsarNode,
    [switch]$AbrirNavegador
)

# Define a porta padrao conforme o servidor escolhido (4173 e a porta que os
# testes E2E ja usam; manter a mesma facilita reaproveitar o cache do browser).
if ($Porta -eq 0) {
    if ($UsarNode) { $Porta = 4173 } else { $Porta = 8000 }
}

$raiz = $PSScriptRoot
$url = "http://127.0.0.1:$Porta/site/index.html"

Write-Host "Iniciando servidor D&D na porta $Porta..." -ForegroundColor Green
Write-Host "Site: $url" -ForegroundColor Cyan
Write-Host ""

# Abre o navegador somente quando pedido explicitamente por parametro.
if ($AbrirNavegador) {
    Start-Process $url
}

if ($UsarNode) {
    # Servidor Node de testes (opt-in): mesmo comportamento de `npm run serve:test`.
    node (Join-Path $raiz 'scripts/serve-static.mjs') --root $raiz --host 127.0.0.1 --port $Porta
} else {
    # Fallback de runtime local sem Node: servidor estatico do proprio Python.
    # Usa scripts/serve-static.py (e nao `python -m http.server`) porque o
    # modulo padrao herda o MIME do registro do Windows, onde `.mjs` aparece
    # como text/plain — o navegador entao recusa os module scripts vendorizados.
    python (Join-Path $raiz 'scripts/serve-static.py') --host 127.0.0.1 --port $Porta --directory $raiz
}
