param([Parameter(Mandatory = $true)][string]$Target)

if (-not $Target.StartsWith('MindmakeVideoStudio/', [System.StringComparison]::Ordinal)) {
  throw 'Credential target must begin with MindmakeVideoStudio/'
}

$secret = Read-Host -Prompt "Secret for $Target" -AsSecureString
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
}
"@

[MindmakeCredentialWriter]::Write($Target, $secret)
Write-Output "Stored credential: $Target"
