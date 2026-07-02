# Ativa ambiente virtual
& .\.venv\Scripts\Activate.ps1

# Inicia servidor HTTP em background
Write-Host "Iniciando servidor D&D na porta 8000..." -ForegroundColor Green
Write-Host "Site: http://localhost:8000" -ForegroundColor Cyan
Write-Host ""

# Abre navegador
Start-Process "http://localhost:8000"

# Inicia servidor
python -m http.server 8000
