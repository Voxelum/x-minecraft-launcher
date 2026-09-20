param(
  [Parameter(Mandatory = $true)]
  [string] $Path
)

$ErrorActionPreference = 'Stop'
$expectedPublisher = 'CN=SignPath Foundation, O=SignPath Foundation, L=Lewes, S=Delaware, C=US'
$signature = Get-AuthenticodeSignature -LiteralPath $Path
if ($signature.Status -ne 'Valid' -or $null -eq $signature.SignerCertificate -or $signature.SignerCertificate.Subject -cne $expectedPublisher) {
  throw 'DeskGap EXE must have a valid Authenticode signature from the expected SignPath publisher'
}
