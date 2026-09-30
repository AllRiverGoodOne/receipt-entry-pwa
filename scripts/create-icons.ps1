param(
  [string]$OutputDirectory = (Join-Path $PSScriptRoot "..\icons")
)

Add-Type -AssemblyName System.Drawing
[System.IO.Directory]::CreateDirectory($OutputDirectory) | Out-Null

foreach ($size in 192, 512) {
  $bitmap = New-Object System.Drawing.Bitmap($size, $size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml("#176b87"))

  $margin = [int]($size * 0.22)
  $paperWidth = $size - (2 * $margin)
  $paperHeight = [int]($size * 0.64)
  $paperTop = [int]($size * 0.16)
  $paper = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
  $graphics.FillRectangle($paper, $margin, $paperTop, $paperWidth, $paperHeight)

  $linePen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml("#9db8c2"), [Math]::Max(3, $size * 0.018))
  foreach ($offset in 0.34, 0.46, 0.58) {
    $y = [int]($size * $offset)
    $graphics.DrawLine($linePen, [int]($size * 0.31), $y, [int]($size * 0.69), $y)
  }

  $accentPen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml("#e7a72d"), [Math]::Max(5, $size * 0.035))
  $graphics.DrawLine($accentPen, [int]($size * 0.31), [int]($size * 0.7), [int]($size * 0.69), [int]($size * 0.7))

  $path = Join-Path $OutputDirectory ("icon-{0}.png" -f $size)
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $accentPen.Dispose()
  $linePen.Dispose()
  $paper.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}
