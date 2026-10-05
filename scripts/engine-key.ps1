<#
Engine key for Codex and Claude sessions on this Windows machine, in one run.

The engine key lets an agent session (Codex or Claude Code) read and save
articles in the content engine. On this machine it lives in Windows Credential
Manager under Mindmake/engine-operator-token, LocalMachine only, and
scripts/engine.py reads it from there. The value is never shown, logged,
written to a file or put on a command line.

Keep this file outside the runner checkout. Downloads is fine. An extra file
inside runner-source makes the checkout unclean, and the runner refuses work
from an unclean checkout. Codex should also work in its own copy of the
content-engine repository, never inside runner-source.

FIRST MACHINE (makes a fresh key):

  powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\Downloads\engine-key.ps1" -New

  It stores a new key on this machine, then puts it on the clipboard once.
  Paste it into three places, then press Enter and the clipboard is cleared:
    1. KeePass, beside the video runner's other keys, as a new entry named
       "Mindmake engine key (ENGINE_OPERATOR_TOKEN)".
    2. Vercel: project content-engine, Settings, Environment Variables,
       ENGINE_OPERATOR_TOKEN, Edit, paste, Save (Production). The engine uses
       the new key from its next deployment.
    3. Claude Code: the cloud environment's settings (the environment menu in a
       session's title bar, then Edit), environment variable
       ENGINE_OPERATOR_TOKEN. New Claude sessions pick it up.

SECOND MACHINE (stores the same key):

  powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\Downloads\engine-key.ps1"

  Copy the key from the KeePass entry and paste it at the hidden prompt.

CHECK, on either machine, once the engine has redeployed:

  powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\Downloads\engine-key.ps1" -Check

  Prints the key's 12-character fingerprint and whether the engine accepts it.
  Both machines must show the same fingerprint.
#>
param(
  [switch]$New,
  [switch]$Check
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$target = 'Mindmake/engine-operator-token'
$engine = 'https://content-engine-flame-nu.vercel.app'
# A read the engine key is allowed to make: article 1, which is approved and stays put.
$probe = '/api/content-ideas?id=6cb0d213-1aa6-44d3-8dc2-0b91d8dde4df'

if ($New -and $Check) { throw 'Choose one: -New, -Check, or neither. Nothing was changed.' }

Add-Type @"
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Security;

public static class MindmakeEngineKey {
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
        Comment = "Mindmake content engine key for agent sessions",
        CredentialBlobSize = checked((UInt32)(secret.Length * 2)),
        CredentialBlob = blob,
        Persist = 2,
        UserName = "MindmakeEngine"
      };
      if (!CredWrite(ref credential, 0)) throw new Win32Exception(Marshal.GetLastWin32Error());
    } finally {
      Marshal.ZeroFreeCoTaskMemUnicode(blob);
    }
  }

  // The value, for this process only. Callers never print it.
  public static string Read(string target) {
    IntPtr pointer;
    if (!CredRead(target, 1, 0, out pointer)) {
      int err = Marshal.GetLastWin32Error();
      if (err == 1168) return null;
      throw new Win32Exception(err);
    }
    try {
      CREDENTIAL credential = (CREDENTIAL)Marshal.PtrToStructure(pointer, typeof(CREDENTIAL));
      if (credential.Persist != 2) throw new InvalidOperationException("The stored key is not LocalMachine. Run this script again to store it properly.");
      if (credential.CredentialBlob == IntPtr.Zero || credential.CredentialBlobSize == 0) return "";
      return Marshal.PtrToStringUni(credential.CredentialBlob, (int)credential.CredentialBlobSize / 2);
    } finally {
      CredFree(pointer);
    }
  }

  public static string Fingerprint(string value) {
    using (System.Security.Cryptography.SHA256 sha = System.Security.Cryptography.SHA256.Create()) {
      byte[] digest = sha.ComputeHash(System.Text.Encoding.UTF8.GetBytes(value));
      return BitConverter.ToString(digest).Replace("-", "").Substring(0, 12).ToLowerInvariant();
    }
  }
}
"@

function Test-EngineKey([string]$value) {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri ($engine + $probe) -Headers @{ Authorization = ('Bearer ' + $value) } -TimeoutSec 60
    return [int]$response.StatusCode
  } catch {
    $r = $_.Exception.Response
    if ($null -ne $r) { return [int]$r.StatusCode }
    return 0
  }
}

if ($Check) {
  $value = [MindmakeEngineKey]::Read($target)
  if ([string]::IsNullOrEmpty($value)) { throw "No engine key is stored on this machine. Run this script without -Check first." }
  $fingerprint = [MindmakeEngineKey]::Fingerprint($value)
  $status = Test-EngineKey $value
  $value = $null
  Write-Host "Engine key on this machine: fingerprint $fingerprint"
  if ($status -eq 200) {
    Write-Host 'The engine accepts it. Done.'
  } elseif ($status -eq 401 -or $status -eq 403) {
    Write-Host "The engine refuses it (HTTP $status). If you just changed it in Vercel, the engine needs a redeploy first."
  } else {
    Write-Host "Could not reach the engine (HTTP $status). Check the internet connection and try again."
  }
  exit 0
}

if ($New) {
  # 48 random bytes from the cryptographic generator, as 96 lowercase hex.
  $bytes = New-Object byte[] 48
  $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $generator.GetBytes($bytes)
    $plain = 'mm_engine_' + (-join ($bytes | ForEach-Object { $_.ToString('x2') }))
  } finally {
    $generator.Dispose()
    [Array]::Clear($bytes, 0, $bytes.Length)
  }
  $secret = ConvertTo-SecureString -String $plain -AsPlainText -Force
} else {
  $secret = Read-Host -Prompt 'Paste the engine key from KeePass (nothing you paste is shown)' -AsSecureString
  if ($secret.Length -lt 32) { throw 'That is too short to be the engine key. Nothing was changed.' }
}

$replaced = [MindmakeEngineKey]::DeleteExisting($target)
[MindmakeEngineKey]::Write($target, $secret)
$stored = [MindmakeEngineKey]::Read($target)
if ($null -eq $stored -or $stored.Length -ne $secret.Length) { throw 'Windows did not keep the key exactly as written. Run this script again.' }
$fingerprint = [MindmakeEngineKey]::Fingerprint($stored)
$stored = $null
if ($replaced) { Write-Host 'Replaced the engine key that was stored here before.' }
Write-Host "Stored the engine key on this machine: fingerprint $fingerprint"

if ($New) {
  Set-Clipboard -Value $plain
  $plain = $null
  Write-Host ''
  Write-Host 'The new key is on your clipboard. Paste it into these three places now:'
  Write-Host '  1. KeePass: a new entry "Mindmake engine key (ENGINE_OPERATOR_TOKEN)", beside the runner keys.'
  Write-Host '  2. Vercel: content-engine, Settings, Environment Variables, ENGINE_OPERATOR_TOKEN, Edit, paste, Save.'
  Write-Host '  3. Claude Code: the cloud environment settings, variable ENGINE_OPERATOR_TOKEN.'
  [void](Read-Host -Prompt 'Press Enter when all three are done, and the clipboard will be cleared')
  Set-Clipboard -Value ' '
  Write-Host 'Clipboard cleared. Tell Claude or Codex "key done": the engine is redeployed so it uses the new key.'
  Write-Host 'Then run this script with -Check to confirm the engine accepts it.'
}
