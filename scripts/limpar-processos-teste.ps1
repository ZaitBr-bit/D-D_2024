# ============================================================
# Encerra processos de teste esquecidos em segundo plano.
#
# Alvos (só o que um teste ou um agente deixa para trás):
#  - python.exe / python3.exe lendo o script da entrada padrão ("python -"),
#    que ficam bloqueados para sempre quando ninguém fecha o stdin;
#  - navegadores headless do Playwright (pasta ms-playwright);
#  - servidores http de teste (python -m http.server, node + playwright
#    webServer) nas portas de teste 8800-8899.
#
# Nunca toca: Chrome/Edge do usuário, o servidor do Playwright que a
# extensão do VS Code mantém (pai = Code) nem processos com menos de
# -MinutosMinimos (rodada em andamento).
#
# Uso:
#   powershell -File scripts\limpar-processos-teste.ps1            # só lista
#   powershell -File scripts\limpar-processos-teste.ps1 -Matar     # encerra
# ============================================================
param(
  [switch]$Matar,
  [int]$MinutosMinimos = 5
)

$limite = (Get-Date).AddMinutes(-$MinutosMinimos)
$alvos = @{}

# Ids de processos de ancestrais protegidos (VS Code e o próprio shell).
function Test-PaiEhCode($processo) {
  $pai = Get-CimInstance Win32_Process -Filter "ProcessId=$($processo.ParentProcessId)" -ErrorAction SilentlyContinue
  return ($pai -and $pai.Name -match '^Code(\.exe)?$')
}

foreach ($p in Get-CimInstance Win32_Process) {
  if ($p.ProcessId -eq $PID) { continue }
  if (-not $p.CreationDate -or $p.CreationDate -gt $limite) { continue }
  $cmd = [string]$p.CommandLine
  $motivo = $null

  if ($p.Name -match '^python3?(\.exe)?$' -and $cmd -match '\s-\s*$') {
    # Texto sem acento: o PowerShell 5.1 lê .ps1 sem BOM como ANSI e imprimiria lixo.
    $motivo = 'python lendo o script da entrada padrao (bloqueado)'
  } elseif ($cmd -match 'ms-playwright' -and $p.Name -match 'chrom|headless') {
    $motivo = 'navegador headless do Playwright'
  } elseif ($p.Name -match '^python3?(\.exe)?$' -and $cmd -match 'http\.server\s+88\d\d') {
    $motivo = 'servidor http de teste (python)'
  } elseif ($p.Name -match '^node(\.exe)?$' -and $cmd -match 'playwright' -and $cmd -notmatch 'test-server' -and -not (Test-PaiEhCode $p)) {
    $motivo = 'processo node do Playwright'
  }

  if ($motivo) { $alvos[$p.ProcessId] = [pscustomobject]@{ Pid = $p.ProcessId; Nome = $p.Name; Motivo = $motivo; Criado = $p.CreationDate } }
}

# Escutas nas portas de teste cujo dono é node/python antigo.
Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Where-Object { $_.LocalPort -ge 8800 -and $_.LocalPort -le 8899 } |
  ForEach-Object {
    $p = Get-CimInstance Win32_Process -Filter "ProcessId=$($_.OwningProcess)" -ErrorAction SilentlyContinue
    if ($p -and $p.Name -match '^(node|python3?)(\.exe)?$' -and $p.CreationDate -lt $limite -and -not (Test-PaiEhCode $p)) {
      $alvos[$p.ProcessId] = [pscustomobject]@{ Pid = $p.ProcessId; Nome = $p.Name; Motivo = "escuta na porta de teste $($_.LocalPort)"; Criado = $p.CreationDate }
    }
  }

if ($alvos.Count -eq 0) { Write-Host 'Nenhum processo de teste esquecido.'; return }

$alvos.Values | Sort-Object Pid | Format-Table -AutoSize | Out-String | Write-Host
if (-not $Matar) { Write-Host 'Somente listagem. Use -Matar para encerrar.'; return }

foreach ($a in $alvos.Values) {
  Stop-Process -Id $a.Pid -Force -ErrorAction SilentlyContinue
  Write-Host "Encerrado: $($a.Pid) $($a.Nome) ($($a.Motivo))"
}
