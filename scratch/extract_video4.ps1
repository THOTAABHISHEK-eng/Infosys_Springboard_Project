Add-Type -AssemblyName PresentationCore, WindowsBase, PresentationFramework

$videoPath = "C:\Users\ABHI\.gemini\antigravity\brain\7937eded-b2ef-4b0e-8a33-46f1bfd894a9\.user_uploaded\media_1794929673004_bfe1dd9c.mp4"
$outDir = "C:\Users\ABHI\.gemini\antigravity\brain\7937eded-b2ef-4b0e-8a33-46f1bfd894a9\scratch\frames4"
if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Force -Path $outDir | Out-Null
}

$player = New-Object System.Windows.Media.MediaPlayer
$player.ScrubbingEnabled = $true
$uri = New-Object System.Uri($videoPath)
$player.Open($uri)

$waited = 0
while (-not $player.NaturalDuration.HasTimeSpan -and $waited -lt 100) {
    Start-Sleep -Milliseconds 100
    $waited++
}

$width = $player.NaturalVideoWidth
$height = $player.NaturalVideoHeight
$dur = [int]$player.NaturalDuration.TimeSpan.TotalSeconds
Write-Host "Extracting from: ${width}x${height}, Duration: ${dur}s"

if ($dur -le 0) { $dur = 60 }
$step = [Math]::Max(1, [int]($dur / 12))
$times = @()
for ($t = 2; $t -lt $dur; $t += $step) {
    $times += $t
}
$times += ($dur - 2)

foreach ($sec in $times) {
    if ($sec -ge $dur -or $sec -lt 0) { continue }
    $player.Position = [TimeSpan]::FromSeconds($sec)
    Start-Sleep -Milliseconds 400

    $visual = New-Object System.Windows.Media.DrawingVisual
    $dc = $visual.RenderOpen()
    $rect = New-Object System.Windows.Rect(0, 0, $width, $height)
    $dc.DrawVideo($player, $rect)
    $dc.Close()

    $rtb = New-Object System.Windows.Media.Imaging.RenderTargetBitmap($width, $height, 96, 96, [System.Windows.Media.PixelFormats]::Pbgra32)
    $rtb.Render($visual)

    $encoder = New-Object System.Windows.Media.Imaging.JpegBitmapEncoder
    $frame = [System.Windows.Media.Imaging.BitmapFrame]::Create($rtb)
    $encoder.Frames.Add($frame)

    $outFile = Join-Path $outDir ("frame_{0:D3}s.jpg" -f $sec)
    $fs = [System.IO.File]::OpenWrite($outFile)
    $encoder.Save($fs)
    $fs.Close()

    Write-Host "Extracted ${sec}s -> $outFile ($((Get-Item $outFile).Length) bytes)"
}

$player.Close()
Write-Host "ALL FRAMES EXTRACTED"
