param(
    [string]$Distribution = 'Ubuntu',
    [string]$LinuxUser = 'cherie',
    [string]$ProjectPath = '/home/cherie/cml-private-research/products/CML_LOCAL_ALPHA_20261010'
)
$ErrorActionPreference = 'Stop'
try {
    & "$env:SystemRoot\System32\wsl.exe" --distribution $Distribution --user $LinuxUser --exec bash "$ProjectPath/desktop/ensure-server.sh"
    if ($LASTEXITCODE -ne 0) { throw 'The local server could not become ready. See the launcher output above.' }
    # Confirm that Windows can reach the WSL loopback server before opening it.
    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        try {
            $response = Invoke-WebRequest -Uri 'http://127.0.0.1:4180/' -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -eq 200 -and $response.Content.Contains('<title>CML Local Alpha')) {
                $ready = $true
                break
            }
        } catch { }
        Start-Sleep -Milliseconds 500
    }
    if (-not $ready) { throw 'Windows cannot reach CML Local Alpha at 127.0.0.1:4180. Check WSL localhost forwarding.' }
    Start-Process 'http://127.0.0.1:4180'
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    Read-Host 'Press Enter to close'
    exit 1
}
