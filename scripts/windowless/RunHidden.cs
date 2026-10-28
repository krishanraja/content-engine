// run-hidden.exe: a Windows program with no window of its own that runs one console program with no window either,
// waits for it and returns its exit code. Every scheduled task on a home computer that would otherwise start
// powershell.exe, node.exe, python.exe or cmd.exe in Krish's session runs through it (scripts/windowless.ps1).
// Krish, 2026-10-28: "HIDE ALL CONSOLE POP UPS FOREVER FROM EVERY REPO AND LOCAL TASK".
//
//   run-hidden.exe "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -File "C:\x\y.ps1" -Loop
//
// Everything after this program's own name is the command, passed on exactly as written. The command is started with
// CREATE_NO_WINDOW, so it gets a console that has no window, and every console program it starts shares that hidden
// console. It runs inside a job that ends with this program, so stopping the task ends the whole command, as stopping
// the program itself did. Built on each machine by the C# compiler Windows carries; C# 5, no packages.
using System;
using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;

public static class RunHidden
{
    [StructLayout(LayoutKind.Sequential)]
    struct IoCounters
    {
        public ulong ReadOperationCount, WriteOperationCount, OtherOperationCount;
        public ulong ReadTransferCount, WriteTransferCount, OtherTransferCount;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct BasicLimits
    {
        public long PerProcessUserTimeLimit;
        public long PerJobUserTimeLimit;
        public uint LimitFlags;
        public UIntPtr MinimumWorkingSetSize;
        public UIntPtr MaximumWorkingSetSize;
        public uint ActiveProcessLimit;
        public UIntPtr Affinity;
        public uint PriorityClass;
        public uint SchedulingClass;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct ExtendedLimits
    {
        public BasicLimits Basic;
        public IoCounters Io;
        public UIntPtr ProcessMemoryLimit;
        public UIntPtr JobMemoryLimit;
        public UIntPtr PeakProcessMemoryUsed;
        public UIntPtr PeakJobMemoryUsed;
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern IntPtr CreateJobObject(IntPtr attributes, string name);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool SetInformationJobObject(IntPtr job, int infoClass, ref ExtendedLimits info, uint length);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);

    const int JobObjectExtendedLimitInformation = 9;
    const uint KillOnJobClose = 0x2000;

    [STAThread]
    public static int Main()
    {
        string program, arguments;
        Split(AfterFirst(Environment.CommandLine), out program, out arguments);
        if (program.Length == 0) return 2;

        IntPtr job = CreateJobObject(IntPtr.Zero, null);
        if (job != IntPtr.Zero)
        {
            ExtendedLimits limits = new ExtendedLimits();
            limits.Basic.LimitFlags = KillOnJobClose;
            SetInformationJobObject(job, JobObjectExtendedLimitInformation, ref limits, (uint)Marshal.SizeOf(typeof(ExtendedLimits)));
        }

        ProcessStartInfo start = new ProcessStartInfo(program, arguments);
        start.UseShellExecute = false;
        start.CreateNoWindow = true;
        try
        {
            using (Process child = Process.Start(start))
            {
                if (job != IntPtr.Zero) AssignProcessToJobObject(job, child.Handle);
                child.WaitForExit();
                return child.ExitCode;
            }
        }
        catch (Win32Exception)
        {
            return 127;
        }
    }

    // The command line after its first word, the way Windows reads a program's name: up to the closing quote when it
    // starts with one, otherwise up to the first space or tab.
    public static string AfterFirst(string line)
    {
        int i = 0;
        if (line.Length > 0 && line[0] == '"')
        {
            int close = line.IndexOf('"', 1);
            i = close < 0 ? line.Length : close + 1;
        }
        else
        {
            while (i < line.Length && line[i] != ' ' && line[i] != '\t') i++;
        }
        return line.Substring(i).TrimStart(' ', '\t');
    }

    public static void Split(string command, out string program, out string arguments)
    {
        string rest = AfterFirst(command);
        string first = command.Substring(0, command.Length - rest.Length).Trim(' ', '\t');
        program = first.Trim('"');
        arguments = rest;
    }
}
