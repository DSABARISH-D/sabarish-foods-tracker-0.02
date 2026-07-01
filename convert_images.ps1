Add-Type -AssemblyName System.Drawing

$files = @("adaptive-icon.png", "splash-icon.png", "icon.png")

foreach ($file in $files) {
    $path = "c:\Users\Admin\Downloads\SAB FOODS  TRACKER 0.02\assets\$file"
    $newPath = "c:\Users\Admin\Downloads\SAB FOODS  TRACKER 0.02\assets\temp_$file"
    
    if (Test-Path $path) {
        Write-Host "Converting $file..."
        $img = [System.Drawing.Image]::FromFile($path)
        $img.Save($newPath, [System.Drawing.Imaging.ImageFormat]::Png)
        $img.Dispose()
        
        Remove-Item $path -Force
        Rename-Item $newPath $file
        Write-Host "Done converting $file"
    } else {
        Write-Host "Not found: $path"
    }
}
