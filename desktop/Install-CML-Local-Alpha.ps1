$ErrorActionPreference = 'Stop'
$launcher = Join-Path $PSScriptRoot 'Launch-CML-Local-Alpha.ps1'
if (-not (Test-Path -LiteralPath $launcher)) { throw "Launcher missing: $launcher" }
# Install from the extracted project's WSL UNC directory; no machine-specific paths.
if ($PSScriptRoot -notmatch '^\\\\(?:wsl\.localhost|wsl\$)\\([^\\]+)\\(.+)\\desktop$') {
    throw 'Run this installer from the extracted project under \\wsl.localhost\DISTRO\home\USER\...\desktop.'
}
$distribution = $Matches[1]
$projectPath = '/' + $Matches[2].Replace('\', '/')
$linuxUser = (& "$env:SystemRoot\System32\wsl.exe" --distribution $distribution --exec id -un | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or -not $linuxUser) { throw 'Could not determine the WSL default user.' }
$desktop = [Environment]::GetFolderPath('Desktop')
if (-not $desktop) { throw 'Windows Desktop folder could not be located.' }
$path = Join-Path $desktop 'CML Local Alpha.lnk'
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($path)
$shortcut.TargetPath = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$shortcut.Arguments = '-NoProfile -ExecutionPolicy Bypass -File "' + $launcher + '" -Distribution "' + $distribution + '" -LinuxUser "' + $linuxUser + '" -ProjectPath "' + $projectPath + '"'
$shortcut.WorkingDirectory = $env:USERPROFILE
$shortcut.Description = 'Start or reuse the local CML server and open http://127.0.0.1:4180'
$shortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll,13"
$shortcut.Save()
if (-not (Test-Path -LiteralPath $path)) { throw 'Shortcut was not created.' }
Write-Host "Installed: $path"
