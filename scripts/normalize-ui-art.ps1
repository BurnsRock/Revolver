Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = "Stop"

$assets = @(
  @{ Source = "src/assets/images/initial/PLAYER.PNG"; Target = "src/assets/images/player-gunslinger-64.png" },
  @{ Source = "src/assets/images/initial/CYLINDER.PNG"; Target = "src/assets/images/cylinder-64.png" },
  @{ Source = "src/assets/images/initial/RAT SWARM.PNG"; Target = "src/assets/images/rat-swarm-64.png" },
  @{ Source = "src/assets/images/initial/RIOT DROID.PNG"; Target = "src/assets/images/riot-droid-64.png" },
  @{ Source = "src/assets/images/initial/SNIPER.PNG"; Target = "src/assets/images/sniper-64.png" },
  @{ Source = "src/assets/images/initial/DRONE.PNG"; Target = "src/assets/images/drone-64.png" },
  @{ Source = "src/assets/images/initial/RAT STORM.PNG"; Target = "src/assets/images/rat-storm-64.png" },
  @{ Source = "src/assets/images/initial/TANK.PNG"; Target = "src/assets/images/tank-64.png" },
  @{ Source = "src/assets/images/initial/PHANTOM GUNMAN.PNG"; Target = "src/assets/images/phantom-gunman-64.png" },
  @{ Source = "src/assets/images/initial/Basic.PNG"; Target = "src/assets/images/basic-64.png" },
  @{ Source = "src/assets/images/initial/Birdshot.PNG"; Target = "src/assets/images/birdshot-64.png" },
  @{ Source = "src/assets/images/initial/Buckshot.PNG"; Target = "src/assets/images/buckshot-64.png" },
  @{ Source = "src/assets/images/initial/Slug.PNG"; Target = "src/assets/images/slug-64.png" },
  @{ Source = "src/assets/images/initial/AP.PNG"; Target = "src/assets/images/ap-64.png" },
  @{ Source = "src/assets/images/initial/Flechette.PNG"; Target = "src/assets/images/flechette-64.png" },
  @{ Source = "src/assets/images/initial/Blank.PNG"; Target = "src/assets/images/blank-64.png" },
  @{ Source = "src/assets/images/initial/Dart.PNG"; Target = "src/assets/images/dart-64.png" },
  @{ Source = "src/assets/images/initial/Mark.PNG"; Target = "src/assets/images/mark-64.png" },
  @{ Source = "src/assets/images/initial/Seed.PNG"; Target = "src/assets/images/seed-64.png" },
  @{ Source = "src/assets/images/initial/Pork.PNG"; Target = "src/assets/images/pork-64.png" },
  @{ Source = "src/assets/images/initial/Flare.PNG"; Target = "src/assets/images/flare-64.png" },
  @{ Source = "src/assets/images/initial/Explosive.PNG"; Target = "src/assets/images/explosive-64.png" }
)

function Get-ColorDistanceSq($a, $b) {
  $dr = [int]$a.R - [int]$b.R
  $dg = [int]$a.G - [int]$b.G
  $db = [int]$a.B - [int]$b.B
  return ($dr * $dr) + ($dg * $dg) + ($db * $db)
}

function Convert-ToNormalizedSprite {
  param(
    [string]$SourcePath,
    [string]$TargetPath
  )

  $src = [System.Drawing.Bitmap]::FromFile($SourcePath)
  try {
    $bgSamples = @(
      $src.GetPixel(0, 0),
      $src.GetPixel($src.Width - 1, 0),
      $src.GetPixel(0, $src.Height - 1),
      $src.GetPixel($src.Width - 1, $src.Height - 1)
    )
    $bgR = [int](($bgSamples | Measure-Object -Property R -Average).Average)
    $bgG = [int](($bgSamples | Measure-Object -Property G -Average).Average)
    $bgB = [int](($bgSamples | Measure-Object -Property B -Average).Average)
    $bg = [System.Drawing.Color]::FromArgb(255, $bgR, $bgG, $bgB)
    $threshold = 420

    $mask = New-Object 'bool[,]' $src.Width, $src.Height
    $visited = New-Object 'bool[,]' $src.Width, $src.Height
    $queue = [System.Collections.Generic.Queue[System.Drawing.Point]]::new()

    foreach ($pt in @(
      [System.Drawing.Point]::new(0, 0),
      [System.Drawing.Point]::new($src.Width - 1, 0),
      [System.Drawing.Point]::new(0, $src.Height - 1),
      [System.Drawing.Point]::new($src.Width - 1, $src.Height - 1)
    )) {
      $queue.Enqueue($pt)
    }

    while ($queue.Count -gt 0) {
      $pt = $queue.Dequeue()
      $x = $pt.X
      $y = $pt.Y
      if ($x -lt 0 -or $y -lt 0 -or $x -ge $src.Width -or $y -ge $src.Height) { continue }
      if ($visited[$x, $y]) { continue }

      $visited[$x, $y] = $true
      $pixel = $src.GetPixel($x, $y)
      if ((Get-ColorDistanceSq $pixel $bg) -gt $threshold) { continue }

      $mask[$x, $y] = $true
      $queue.Enqueue([System.Drawing.Point]::new($x + 1, $y))
      $queue.Enqueue([System.Drawing.Point]::new($x - 1, $y))
      $queue.Enqueue([System.Drawing.Point]::new($x, $y + 1))
      $queue.Enqueue([System.Drawing.Point]::new($x, $y - 1))
    }

    $processed = New-Object System.Drawing.Bitmap $src.Width, $src.Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
      $minX = $src.Width
      $minY = $src.Height
      $maxX = -1
      $maxY = -1

      for ($y = 0; $y -lt $src.Height; $y++) {
        for ($x = 0; $x -lt $src.Width; $x++) {
          $pixel = $src.GetPixel($x, $y)
          if ($mask[$x, $y]) {
            $processed.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
            continue
          }

          $processed.SetPixel($x, $y, $pixel)
          if ($x -lt $minX) { $minX = $x }
          if ($y -lt $minY) { $minY = $y }
          if ($x -gt $maxX) { $maxX = $x }
          if ($y -gt $maxY) { $maxY = $y }
        }
      }

      $pad = 4
      $minX = [Math]::Max(0, $minX - $pad)
      $minY = [Math]::Max(0, $minY - $pad)
      $maxX = [Math]::Min($processed.Width - 1, $maxX + $pad)
      $maxY = [Math]::Min($processed.Height - 1, $maxY + $pad)
      $cropW = $maxX - $minX + 1
      $cropH = $maxY - $minY + 1

      $target = New-Object System.Drawing.Bitmap 64, 64, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
      try {
        $graphics = [System.Drawing.Graphics]::FromImage($target)
        try {
          $graphics.Clear([System.Drawing.Color]::Transparent)
          $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
          $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
          $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None

          $scale = [Math]::Min(56.0 / $cropW, 56.0 / $cropH)
          $destW = [int][Math]::Round($cropW * $scale)
          $destH = [int][Math]::Round($cropH * $scale)
          $destX = [int][Math]::Floor((64 - $destW) / 2)
          $destY = [int][Math]::Floor((64 - $destH) / 2)

          $srcRect = [System.Drawing.Rectangle]::new($minX, $minY, $cropW, $cropH)
          $destRect = [System.Drawing.Rectangle]::new($destX, $destY, $destW, $destH)
          $graphics.DrawImage($processed, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
        }
        finally {
          $graphics.Dispose()
        }

        $target.Save($TargetPath, [System.Drawing.Imaging.ImageFormat]::Png)
      }
      finally {
        $target.Dispose()
      }
    }
    finally {
      $processed.Dispose()
    }
  }
  finally {
    $src.Dispose()
  }
}

foreach ($asset in $assets) {
  if (Test-Path $asset.Target) {
    Write-Output ("Skipped {0}" -f $asset.Target)
    continue
  }

  Convert-ToNormalizedSprite -SourcePath $asset.Source -TargetPath $asset.Target
  Write-Output ("Converted {0} -> {1}" -f $asset.Source, $asset.Target)
}
