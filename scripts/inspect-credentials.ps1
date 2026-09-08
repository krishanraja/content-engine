param(
  [string]$Filter = 'MindmakeVideoStudio/*'
)

# Reads every Mindmake credential and reports the four fields that identify what
# wrote it, without ever printing a secret. On 2026-09-08 two of these reverted to
# their previous values several hours after being set, and none of the usual
# questions could be answered: when did it change, what wrote it, and is the value
# the one the cloud expects. Persist, Comment, LastWritten and a one-way
# fingerprint answer all four.
#
# The fingerprint is the first 12 hex of SHA-256 over the UTF-16-decoded value. It
# is comparable across machines and runs and reveals nothing.

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;

public static class MindmakeCredentialInspector {
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

  [DllImport("Advapi32.dll", EntryPoint = "CredEnumerateW", CharSet = CharSet.Unicode, SetLastError = true)]
  private static extern bool CredEnumerate(string filter, UInt32 flags, out UInt32 count, out IntPtr credentials);

  [DllImport("Advapi32.dll", EntryPoint = "CredFree")]
  private static extern void CredFree(IntPtr buffer);

  public class Entry {
    public string Target;
    public uint Type;
    public uint Persist;
    public long LastWrittenUtc;
    public string Comment;
    public string UserName;
    public int Chars;
    public string Fingerprint;
  }

  public static Entry[] Enumerate(string filter) {
    UInt32 count;
    IntPtr block;
    if (!CredEnumerate(filter, 0, out count, out block)) {
      int err = Marshal.GetLastWin32Error();
      if (err == 1168) return new Entry[0];
      throw new System.ComponentModel.Win32Exception(err);
    }
    try {
      Entry[] entries = new Entry[count];
      for (int i = 0; i < count; i++) {
        IntPtr item = Marshal.ReadIntPtr(block, i * IntPtr.Size);
        CREDENTIAL credential = (CREDENTIAL)Marshal.PtrToStructure(item, typeof(CREDENTIAL));

        string value = "";
        if (credential.CredentialBlob != IntPtr.Zero && credential.CredentialBlobSize > 0) {
          value = Marshal.PtrToStringUni(credential.CredentialBlob, (int)credential.CredentialBlobSize / 2);
        }

        string fingerprint = "";
        if (value.Length > 0) {
          using (SHA256 sha = SHA256.Create()) {
            byte[] digest = sha.ComputeHash(Encoding.UTF8.GetBytes(value));
            fingerprint = BitConverter.ToString(digest).Replace("-", "").Substring(0, 12).ToLowerInvariant();
          }
        }

        long written = ((long)(uint)credential.LastWritten.dwHighDateTime << 32)
          | (uint)credential.LastWritten.dwLowDateTime;

        entries[i] = new Entry {
          Target = credential.TargetName,
          Type = credential.Type,
          Persist = credential.Persist,
          LastWrittenUtc = written,
          Comment = credential.Comment,
          UserName = credential.UserName,
          Chars = value.Length,
          Fingerprint = fingerprint
        };
      }
      return entries;
    } finally {
      CredFree(block);
    }
  }
}
"@

$persistNames = @{ 1 = 'Session'; 2 = 'LocalMachine'; 3 = 'Enterprise (roams)' }
$typeNames = @{ 1 = 'Generic'; 2 = 'DomainPassword' }

$entries = [MindmakeCredentialInspector]::Enumerate($Filter)
if ($entries.Count -eq 0) {
  Write-Output "No credentials match $Filter"
  return
}

$report = foreach ($entry in $entries) {
  $written = if ($entry.LastWrittenUtc -gt 0) {
    [DateTime]::FromFileTimeUtc($entry.LastWrittenUtc).ToString('yyyy-MM-dd HH:mm:ss') + 'Z'
  } else { 'unknown' }

  [PSCustomObject]@{
    Target      = $entry.Target
    Chars       = $entry.Chars
    Fingerprint = $entry.Fingerprint
    Persist     = if ($persistNames.ContainsKey([int]$entry.Persist)) { $persistNames[[int]$entry.Persist] } else { "unknown ($($entry.Persist))" }
    Type        = if ($typeNames.ContainsKey([int]$entry.Type)) { $typeNames[[int]$entry.Type] } else { "unknown ($($entry.Type))" }
    LastWritten = $written
    Comment     = $entry.Comment
    UserName    = $entry.UserName
  }
}

$report | Sort-Object Target | Format-List

# Persist 3 is the one that can be overwritten by something other than a local
# write, so it is called out rather than left for the reader to notice.
$roaming = @($report | Where-Object { $_.Persist -like 'Enterprise*' })
if ($roaming.Count -gt 0) {
  Write-Output "WARNING: $($roaming.Count) credential(s) are Enterprise-persisted and may be restored from outside this machine:"
  foreach ($item in $roaming) { Write-Output "  $($item.Target)" }
}

# set-credential.ps1 stamps this comment. Anything else was written by a tool that
# is not in this repository, which is the first thing worth knowing.
$foreign = @($report | Where-Object { $_.Comment -ne 'Mindmake Video Studio' })
if ($foreign.Count -gt 0) {
  Write-Output "WARNING: $($foreign.Count) credential(s) were not written by scripts/set-credential.ps1:"
  foreach ($item in $foreign) { Write-Output "  $($item.Target) [comment: '$($item.Comment)']" }
}
