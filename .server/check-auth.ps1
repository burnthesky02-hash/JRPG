$tests = @(
  @{ Label = 'admin-pass'; User = 'admin'; Pass = 'pass' },
  @{ Label = 'jrpg-default'; User = 'jrpg'; Pass = 'ChangeThisNow-123!' }
)

foreach ($test in $tests) {
  $pair = "$($test.User):$($test.Pass)"
  $bytes = [System.Text.Encoding]::ASCII.GetBytes($pair)
  $basic = [Convert]::ToBase64String($bytes)

  try {
    $response = Invoke-WebRequest -Uri 'http://127.0.0.1:8080/' -Headers @{ Authorization = "Basic $basic" } -UseBasicParsing -TimeoutSec 8
    Write-Output "$($test.Label)=HTTP_$([int]$response.StatusCode)"
  }
  catch {
    if ($_.Exception.Response) {
      Write-Output "$($test.Label)=HTTP_$([int]$_.Exception.Response.StatusCode.value__)"
    }
    else {
      Write-Output "$($test.Label)=ERROR_$($_.Exception.Message)"
    }
  }
}
