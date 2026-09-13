param(
  [Parameter(Mandatory = $true)][string]$Target,
  [switch]$Generate,
  [switch]$FromStdin,
  [switch]$Roaming
)

# Writes one Mindmake credential and then proves the store actually holds what was
# written. The three original control-center target names are quarantined because
# Windows credential roaming restored stale Enterprise values over verified writes.
# Active v2 and Studio MCP targets are new LocalMachine names and may never roam.
#
# Two consequences are baked in here. Any pre-existing entry is deleted before the
# write, so a roaming-persisted entry cannot survive underneath. And the value is
# read straight back out of the store and checked, including its persistence class,
# because CredWrite returning true only means the call was accepted.
#
# -Roaming remains available only for credentials whose explicit contract requires
# Enterprise persistence. It is never a recovery technique for an active runtime
# credential: those names are guarded as LocalMachine-only instead.

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if (-not $Target.StartsWith('MindmakeVideoStudio/', [System.StringComparison]::Ordinal)) {
  throw 'Credential target must begin with MindmakeVideoStudio/'
}
$quarantinedTargets = @(
  'MindmakeVideoStudio/control-center-runner-token',
  'MindmakeVideoStudio/control-center-runner-signing-key',
  'MindmakeVideoStudio/control-center-radar-token'
)
$localOnlyTargets = @(
  'MindmakeVideoStudio/studio-mcp-token'
)
$isVersionedRuntimeTarget = $Target -match '^MindmakeVideoStudio/control-center-(?:runner-token|runner-signing-key|radar-token)-v(?:[2-9]|[1-9][0-9]+)$'
if ($quarantinedTargets -contains $Target) {
  throw "Credential target $Target is quarantined after a confirmed roaming rollback. Use the active v2 target documented in docs/DEPLOYMENT.md."
}
if ($Roaming -and (($localOnlyTargets -contains $Target) -or $isVersionedRuntimeTarget)) {
  throw "Credential target $Target is LocalMachine-only and may not be written with -Roaming."
}
if ($Generate -and $FromStdin) {
  throw 'Choose one source: -Generate or -FromStdin.'
}

$secret = if ($Generate) {
  $bytes = New-Object byte[] 48
  $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $generator.GetBytes($bytes)
    ConvertTo-SecureString -String ([Convert]::ToBase64String($bytes)) -AsPlainText -Force
  } finally {
    $generator.Dispose()
    [Array]::Clear($bytes, 0, $bytes.Length)
  }
} elseif ($FromStdin) {
  # Read-Host -AsSecureString requires a console. An automated caller has none, and
  # the alternative it reaches for is a -Value parameter, which puts the secret in
  # the command line and the shell history. One line on stdin, never echoed.
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { throw 'No value arrived on stdin.' }
  ConvertTo-SecureString -String $line.Trim() -AsPlainText -Force
} else {
  Read-Host -Prompt "Secret for $Target" -AsSecureString
}
if ($secret.Length -eq 0) { throw 'Credential cannot be empty' }

Add-Type @"
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Security;

public static class MindmakeCredentialWriter {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  private struct CREDENTIAL {
    public UInt32 Flags;
    public UInt32 Type;
    public string TargetName;
    public string Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public UInt32 CredentialBlobSize;
    public IntPtr CredentialBlob;
    public UInt32 Persist;
    public UInt32 AttributeCount;
    public IntPtr Attributes;
    public string TargetAlias;
    public string UserName;
  }

  [DllImport("Advapi32.dll", EntryPoint = "CredWriteW", CharSet = CharSet.Unicode, SetLastError = true)]
  private static extern bool CredWrite(ref CREDENTIAL credential, UInt32 flags);

  [DllImport("Advapi32.dll", EntryPoint = "CredReadW", CharSet = CharSet.Unicode, SetLastError = true)]
  private static extern bool CredRead(string target, UInt32 type, UInt32 flags, out IntPtr credentialPtr);

  [DllImport("Advapi32.dll", EntryPoint = "CredDeleteW", CharSet = CharSet.Unicode, SetLastError = true)]
  private static extern bool CredDelete(string target, UInt32 type, UInt32 flags);

  [DllImport("Advapi32.dll", SetLastError = true)]
  private static extern void CredFree(IntPtr credentialPtr);

  // A roaming-persisted entry under the same name is the thing that came back and
  // overwrote a good value. Removing it first means the write lands on nothing.
  public static bool DeleteExisting(string target) {
    if (CredDelete(target, 1, 0)) return true;
    int err = Marshal.GetLastWin32Error();
    if (err == 1168) return false;
    throw new Win32Exception(err);
  }

  public static void Write(string target, SecureString secret, uint persist) {
    IntPtr blob = Marshal.SecureStringToCoTaskMemUnicode(secret);
    try {
      CREDENTIAL credential = new CREDENTIAL {
        Type = 1,
        TargetName = target,
        Comment = "Mindmake Video Studio",
        CredentialBlobSize = checked((UInt32)(secret.Length * 2)),
        CredentialBlob = blob,
        Persist = persist,
        UserName = "MindmakeVideoStudio"
      };
      if (!CredWrite(ref credential, 0)) throw new Win32Exception(Marshal.GetLastWin32Error());
    } finally {
      Marshal.ZeroFreeCoTaskMemUnicode(blob);
    }
  }

  // Returns "<persist>:<length>:<fingerprint>". The value itself never leaves.
  public static string Readback(string target) {
    IntPtr pointer;
    if (!CredRead(target, 1, 0, out pointer)) throw new Win32Exception(Marshal.GetLastWin32Error());
    try {
      CREDENTIAL credential = (CREDENTIAL)Marshal.PtrToStructure(pointer, typeof(CREDENTIAL));
      string value = "";
      if (credential.CredentialBlob != IntPtr.Zero && credential.CredentialBlobSize > 0) {
        value = Marshal.PtrToStringUni(credential.CredentialBlob, (int)credential.CredentialBlobSize / 2);
      }
      string fingerprint = "";
      if (value.Length > 0) {
        using (System.Security.Cryptography.SHA256 sha = System.Security.Cryptography.SHA256.Create()) {
          byte[] digest = sha.ComputeHash(System.Text.Encoding.UTF8.GetBytes(value));
          fingerprint = BitConverter.ToString(digest).Replace("-", "").Substring(0, 12).ToLowerInvariant();
        }
      }
      return credential.Persist + ":" + value.Length + ":" + fingerprint;
    } finally {
      CredFree(pointer);
    }
  }
}
"@

$expectedPersist = if ($Roaming) { 3 } else { 2 }
$removed = [MindmakeCredentialWriter]::DeleteExisting($Target)
[MindmakeCredentialWriter]::Write($Target, $secret, $expectedPersist)

$parts = ([MindmakeCredentialWriter]::Readback($Target)).Split(':')
$persist = [int]$parts[0]
$length = [int]$parts[1]
$fingerprint = $parts[2]

if ($length -ne $secret.Length) {
  throw "Readback length $length does not match the $($secret.Length) characters written. The store did not accept this value."
}
if ($persist -ne $expectedPersist) {
  throw "Credential persisted as $persist, not the requested $expectedPersist. The store did not honour the persistence class, so nothing here can be relied on."
}
if (-not $Roaming -and $persist -eq 3) {
  throw "Credential is Enterprise-persisted without -Roaming. It can be replaced from outside this machine."
}

if ($removed) { Write-Output "Replaced existing credential: $Target" }
$class = if ($Roaming) { "Enterprise, syncs to the tenant" } else { "LocalMachine" }
Write-Output "Stored credential: $Target (chars $length, fingerprint $fingerprint, $class)"
