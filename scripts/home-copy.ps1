<#
The one way a home computer brings a machine-owned copy of this repository up to date from main, and heals it when
main's history was rewritten. Dot-sourced by scripts\recordings-upload.ps1, scripts\library-sync.ps1 and
scripts\install-recordings-upload.ps1; it runs nothing on load.

From 18 to 20 November 2026 main's history was rewritten on GitHub (a history scrub). Every machine-owned copy on
both home computers then had a local main both ahead (the old history, about 2,292 commits) and behind (2,494), so
`git pull --ff-only` failed on every pass for more than a day, the lanes kept running old code, and the only sign was a
problem code in the lane report. Krish fixed each copy by hand (fetch, keep HEAD on a backup branch, reset --hard
origin/main), then: "We need to ensure this can never happen again in the future."

Update-HomeCopy pulls fast-forward only, as before. When that fails it fetches origin main and, only when the copy has
no tracked changes and no merge, rebase, cherry-pick, revert or bisect in progress, it:
  1. keeps HEAD on a local backup branch, backup/auto-<yyyyMMdd-HHmmss> (and local main too, as
     backup/auto-<stamp>-main, when the copy is on another branch), never deleted and never pushed;
  2. checks out main when the copy is on another branch or a detached HEAD;
  3. resets main to origin/main (reset --hard), and checks that HEAD is origin/main.
Untracked files stay. It hands back one result: ok, pulled, healed, the backup branch, a reason when it could not, and
one plain line for the caller's log. The caller reports engine_pull_failed or library_source_pull_failed only when the
pull and the heal both failed.

Only a machine-owned copy, by its folder name (Test-HomeCopyOwned): recordings-source and library-source. Never the
runner's pinned checkout (runner-source: scripts\verify-runner-source.ps1 guards it, and only its own installer
re-pins it) and never a person's own working copy (his dev folder): Update-HomeCopy refuses any other folder
before it runs git at all. A person's copy gets the printed realign from scripts\checkout_tidy.mjs instead.
#>

# The folders a home computer owns outright: nobody works in them, so a reset loses nothing a backup branch does not keep.
$HomeCopyFolders = @('recordings-source', 'library-source')

function Test-HomeCopyOwned([string]$Repo) {
  if ([string]::IsNullOrWhiteSpace($Repo)) { return $false }
  $full = [System.IO.Path]::GetFullPath($Repo).TrimEnd([char[]]@('\', '/'))
  return ($HomeCopyFolders -contains (Split-Path -Leaf $full))
}

function Invoke-HomeCopyGit([string]$Git, [string]$Repo, [string[]]$Arguments) {
  # git writes progress and notes to stderr; Windows PowerShell would treat that as an error under Stop, so each call
  # runs under Continue and hands back its exit code and its lines.
  $previous = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $output = @(& $Git -C $Repo @Arguments 2>&1 | ForEach-Object { "$_" })
    $code = $LASTEXITCODE
  } finally { $ErrorActionPreference = $previous }
  return [pscustomobject]@{ code = $code; output = $output; text = (($output | Where-Object { $_ }) -join ' ').Trim() }
}

function Get-HomeCopyHealStep([bool]$Owned, [bool]$Fetched, [bool]$OperationInProgress, [bool]$TrackedChanges) {
  # What a failed pull leads to, in order: a copy that is not machine-owned is never touched; without a fetch there is
  # no origin/main to trust; a git operation in progress or a tracked change is someone's state, never reset.
  if (-not $Owned) { return 'not_owned' }
  if (-not $Fetched) { return 'fetch_failed' }
  if ($OperationInProgress) { return 'operation_in_progress' }
  if ($TrackedChanges) { return 'tracked_changes' }
  return 'heal'
}

function Get-HomeCopyOperation([string]$Git, [string]$Repo) {
  # The git operation in progress in this copy, or $null.
  $dir = Invoke-HomeCopyGit $Git $Repo @('rev-parse', '--absolute-git-dir')
  if ($dir.code -ne 0 -or -not $dir.text) { return 'unknown' }
  foreach ($name in @('MERGE_HEAD', 'rebase-merge', 'rebase-apply', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'BISECT_LOG')) {
    if (Test-Path -LiteralPath (Join-Path $dir.text $name)) { return $name }
  }
  return $null
}

function Update-HomeCopy([string]$Git, [string]$Repo) {
  $leaf = Split-Path -Leaf $Repo
  $result = [ordered]@{ ok = $false; pulled = $false; healed = $false; backup = $null; reason = $null; line = $null }
  if (-not (Test-HomeCopyOwned $Repo)) {
    $result.reason = 'not_owned'
    $result.line = "$leaf is not a machine-owned copy (recordings-source or library-source); it was not pulled or healed"
    return [pscustomobject]$result
  }

  $pull = Invoke-HomeCopyGit $Git $Repo @('pull', '--ff-only', '--quiet')
  if ($pull.code -eq 0) {
    $result.ok = $true
    $result.pulled = $true
    return [pscustomobject]$result
  }

  # The pull failed: most often main's history was rewritten, so this copy is both ahead and behind.
  $fetch = Invoke-HomeCopyGit $Git $Repo @('fetch', '--quiet', 'origin', 'main')
  $operation = Get-HomeCopyOperation $Git $Repo
  $status = Invoke-HomeCopyGit $Git $Repo @('status', '--porcelain', '--untracked-files=no')
  $tracked = ($status.code -ne 0) -or ($status.text -ne '')
  $step = Get-HomeCopyHealStep $true ($fetch.code -eq 0) ($null -ne $operation) $tracked
  if ($step -ne 'heal') {
    $result.reason = $step
    $why = switch ($step) {
      'fetch_failed' { "origin main could not be fetched ($($fetch.text))" }
      'operation_in_progress' { "a git operation is in progress ($operation)" }
      default { 'it has tracked changes' }
    }
    $result.line = "git pull of $leaf did not finish ($($pull.text)), and it was not healed because $why; this copy runs as it is"
    return [pscustomobject]$result
  }

  $stamp = (Get-Date).ToString('yyyyMMdd-HHmmss', [System.Globalization.CultureInfo]::InvariantCulture)
  $backup = "backup/auto-$stamp"
  $n = 1
  while ((Invoke-HomeCopyGit $Git $Repo @('show-ref', '--verify', '--quiet', "refs/heads/$backup")).code -eq 0) {
    $n++
    $backup = "backup/auto-$stamp-$n"
  }
  $made = Invoke-HomeCopyGit $Git $Repo @('branch', $backup, 'HEAD')
  if ($made.code -ne 0) {
    $result.reason = 'backup_failed'
    $result.line = "git pull of $leaf did not finish, and it was not healed: the backup branch $backup could not be made ($($made.text)); this copy runs as it is"
    return [pscustomobject]$result
  }
  $result.backup = $backup

  $branch = Invoke-HomeCopyGit $Git $Repo @('symbolic-ref', '--quiet', '--short', 'HEAD')
  if ($branch.code -ne 0 -or $branch.text -ne 'main') {
    $hasMain = (Invoke-HomeCopyGit $Git $Repo @('show-ref', '--verify', '--quiet', 'refs/heads/main')).code -eq 0
    if ($hasMain) {
      # Local main is about to move too: keep it, unless it is the commit just kept.
      $mainAt = Invoke-HomeCopyGit $Git $Repo @('rev-parse', 'refs/heads/main')
      $headAt = Invoke-HomeCopyGit $Git $Repo @('rev-parse', 'HEAD')
      if ($mainAt.text -ne $headAt.text) { [void](Invoke-HomeCopyGit $Git $Repo @('branch', "$backup-main", 'refs/heads/main')) }
      $switch = Invoke-HomeCopyGit $Git $Repo @('checkout', '--quiet', 'main')
    } else {
      $switch = Invoke-HomeCopyGit $Git $Repo @('checkout', '--quiet', '-b', 'main', 'origin/main')
    }
    if ($switch.code -ne 0) {
      $result.reason = 'checkout_failed'
      $result.line = "git pull of $leaf did not finish, and it was not healed: main could not be checked out ($($switch.text)); its old HEAD is kept on $backup"
      return [pscustomobject]$result
    }
  }

  $reset = Invoke-HomeCopyGit $Git $Repo @('reset', '--hard', '--quiet', 'origin/main')
  $now = Invoke-HomeCopyGit $Git $Repo @('rev-parse', 'HEAD')
  $target = Invoke-HomeCopyGit $Git $Repo @('rev-parse', 'origin/main')
  if ($reset.code -ne 0 -or $now.code -ne 0 -or $now.text -ne $target.text) {
    $result.reason = 'reset_failed'
    $result.line = "git pull of $leaf did not finish, and it was not healed: main could not be reset to origin/main ($($reset.text)); its old HEAD is kept on $backup"
    return [pscustomobject]$result
  }
  $result.ok = $true
  $result.healed = $true
  $short = if ($now.text.Length -ge 7) { $now.text.Substring(0, 7) } else { $now.text }
  $result.line = "$leaf could not fast-forward from main (main's history was rewritten, or it held commits main does not), so it healed itself: its old HEAD is kept on the local branch $backup and main now matches origin/main ($short)"
  return [pscustomobject]$result
}
