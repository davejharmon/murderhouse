$port = New-Object System.IO.Ports.SerialPort('COM5', 115200)
$port.ReadTimeout = 10000
$port.Open()
for ($i = 0; $i -lt 60; $i++) {
    try {
        $line = $port.ReadLine()
        Write-Output $line
    } catch {
        break
    }
}
$port.Close()
