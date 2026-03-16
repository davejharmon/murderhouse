$port = New-Object System.IO.Ports.SerialPort('COM5', 115200)
$port.ReadTimeout = 10000
$port.Open()
for ($i = 0; $i -lt 300; $i++) {
    try {
        $line = $port.ReadLine()
        if ($line -match '\[HR\]') {
            Write-Output $line
        }
    } catch {
        break
    }
}
$port.Close()
