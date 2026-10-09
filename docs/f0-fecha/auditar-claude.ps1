param([Parameter(Mandatory=$true)][string]$Pedido,
  [Parameter(Mandatory=$true)][string]$Saida)
$ErrorActionPreference = 'Stop'
$repoAuditF0 = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$wrapperAuditF0 = (Get-Command claude).Source
$binarioAuditF0 = Join-Path (Split-Path $wrapperAuditF0 -Parent) 'node_modules/@anthropic-ai/claude-code/bin/claude.exe'
if (-not (Test-Path -LiteralPath $binarioAuditF0)) { throw 'CLAUDE_NATIVO_NAO_LOCALIZADO' }
$startAuditF0 = [System.Diagnostics.ProcessStartInfo]::new()
$startAuditF0.FileName = $binarioAuditF0
$startAuditF0.WorkingDirectory = $repoAuditF0
$startAuditF0.UseShellExecute = $false
$startAuditF0.CreateNoWindow = $true
$startAuditF0.RedirectStandardInput = $true
$startAuditF0.RedirectStandardOutput = $true
$startAuditF0.RedirectStandardError = $true
# Apenas o filho perde os overrides de outros providers. Nenhum arquivo/configuração global é alterado.
foreach ($chaveAuditF0 in @($startAuditF0.Environment.Keys)) {
  if ($chaveAuditF0 -match '^ANTHROPIC_' -or $chaveAuditF0 -match '^CLAUDE_CODE_(USE_|SUBAGENT_MODEL|SIMPLE)') {
    [void]$startAuditF0.Environment.Remove($chaveAuditF0)
  }
}
$startAuditF0.Environment['ANTHROPIC_BASE_URL'] = 'https://api.anthropic.com'
# Restricted ignora settings de user/project/local; safe-mode desliga hooks/customizações.
# Sem --bare: essa opção impede o OAuth existente. Nenhuma credencial é lida ou impressa por este script.
foreach ($argumentoAuditF0 in @('--restricted','--safe-mode','--print','--output-format','json',
  '--tools','Read,Glob,Grep','--permission-mode','plan','--permission-prompts','none',
  '--strict-mcp-config','--no-session-persistence')) {
  $startAuditF0.ArgumentList.Add($argumentoAuditF0)
}
$processoAuditF0 = [System.Diagnostics.Process]::new()
$processoAuditF0.StartInfo = $startAuditF0
[void]$processoAuditF0.Start()
Write-Output "CLAUDE_AUDIT_PID=$($processoAuditF0.Id) ENDPOINT=api.anthropic.com MODE=READ_ONLY"
$stdoutAuditF0 = $processoAuditF0.StandardOutput.ReadToEndAsync()
$stderrAuditF0 = $processoAuditF0.StandardError.ReadToEndAsync()
$processoAuditF0.StandardInput.WriteLine((Get-Content -LiteralPath $Pedido -Raw))
$processoAuditF0.StandardInput.Close()
$processoAuditF0.WaitForExit()
$stdoutAuditF0.GetAwaiter().GetResult() | Set-Content -LiteralPath $Saida -Encoding utf8
$stderrAuditF0.GetAwaiter().GetResult() | Set-Content -LiteralPath ($Saida + '.stderr.log') -Encoding utf8
$codigoAuditF0 = $processoAuditF0.ExitCode
Write-Output "CLAUDE_AUDIT_EXIT=$codigoAuditF0"
$processoAuditF0.Dispose()
exit $codigoAuditF0
