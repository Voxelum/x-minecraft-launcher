$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$proc = Get-Process | Where-Object { $_.MainWindowTitle -like '*XMCL*' } | Select-Object -First 1
if (-not $proc) { Write-Output 'NO_WINDOW'; exit 1 }

# Use the screen bounds (we don't have the per-window rect without Add-Type cs)
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
$out = 'C:\Users\ci010-4090\AppData\Local\Temp\xmcl-window.png'
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Output ('SAVED ' + $out + ' ' + $bmp.Width + 'x' + $bmp.Height)
