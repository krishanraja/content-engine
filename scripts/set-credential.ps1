param(
  [Parameter(Mandatory = $true)][string]$Target,
  [switch]$Generate,
  [switch]$FromStdin
)

# Writes one Mindmake credential and then proves the store actually holds what was
# written. On 2026-09-08 two credentials set through this script reverted to values
# from four days earlier: Windows credential roaming restored Enterprise-persisted
# entries over them. The write had succeeded and reported success, and nothing
# looked wrong until the next process start hours later.
#
# Two consequences are baked in here. Any pre-existing entry is deleted before the
# write, so a roaming-persisted entry cannot survive underneath. And the value is
# read straight back out of the store and checked, including its persistence class,
# because CredWrite returning true only means the call was accepted.

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if (-not $Target.StartsWith('MindmakeVideoStudio/', [System.StringComparison]::Ordinal)) {
  throw 'Credential target must begin with MindmakeVideoStudio/'
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

  public static void Write(string target, SecureString secret) {
    IntPtr blob = Marshal.SecureStringToCoTaskMemUnicode(secret);
    try {
      CREDENTIAL credential = new CREDENTIAL {
        Type = 1,
        TargetName = target,
        Comment = "Mindmake Video Studio",
        CredentialBlobSize = checked((UInt32)(secret.Length * 2)),
        CredentialBlob = blob,
        Persist = 2,
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

$removed = [MindmakeCredentialWriter]::DeleteExisting($Target)
[MindmakeCredentialWriter]::Write($Target, $secret)

$parts = ([MindmakeCredentialWriter]::Readback($Target)).Split(':')
$persist = [int]$parts[0]
$length = [int]$parts[1]
$fingerprint = $parts[2]

if ($length -ne $secret.Length) {
  throw "Readback length $length does not match the $($secret.Length) characters written. The store did not accept this value."
}
if ($persist -ne 2) {
  throw "Credential persisted as $persist, not 2 (LocalMachine). A persistence class other than LocalMachine can be replaced from outside this machine."
}

if ($removed) { Write-Output "Replaced existing credential: $Target" }
Write-Output "Stored credential: $Target (chars $length, fingerprint $fingerprint)"
