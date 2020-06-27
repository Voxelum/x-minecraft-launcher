using System;
using System.Runtime.InteropServices;
using System.Diagnostics;

using Windows;

namespace Acrylic
{
    public static class Acrylic
    {
        private static void EnableBlur(IntPtr handle)
        {
            var accent = new AccentPolicy
            {
                AccentState = AccentState.ACCENT_ENABLE_ACRYLICBLURBEHIND,
                GradientColor = 0x00FFFFFF,
                AccentFlags = 2
            };

            var currentVersion = SystemInfo.GetVersionInfo();
            if (currentVersion.CompareTo(SystemInfo.Windows10_1903) >= 0)
            {
                accent.AccentState = AccentState.ACCENT_ENABLE_BLURBEHIND;
            }
            else if (currentVersion.CompareTo(SystemInfo.Windows10_1809) >= 0)
            {
                accent.AccentState = AccentState.ACCENT_ENABLE_ACRYLICBLURBEHIND;
            }
            else if (currentVersion.CompareTo(SystemInfo.Windows10) >= 0)
            {
                accent.AccentState = AccentState.ACCENT_ENABLE_BLURBEHIND;
            }
            else
            {
                accent.AccentState = AccentState.ACCENT_ENABLE_TRANSPARENTGRADIENT;
            }

            var accentStructSize = Marshal.SizeOf(accent);

            var accentPtr = Marshal.AllocHGlobal(accentStructSize);
            Marshal.StructureToPtr(accent, accentPtr, false);

            var data = new WindowCompositionAttributeData
            {
                Attribute = WindowCompositionAttribute.WCA_ACCENT_POLICY,
                SizeOfData = accentStructSize,
                Data = accentPtr
            };

            try {
                User32.SetWindowCompositionAttribute(handle, ref data);
            } catch {
                accent.AccentState = AccentState.ACCENT_ENABLE_BLURBEHIND;
                User32.SetWindowCompositionAttribute(handle, ref data);
            }

            Marshal.FreeHGlobal(accentPtr);
        }

        public static bool EnableAcrylic(int pid)
        {
            Process mainproc = Process.GetProcessById(pid);
            foreach (Process proc in Process.GetProcessesByName(mainproc.ProcessName))
            {
                if (proc.StartInfo.FileName != mainproc.StartInfo.FileName)
                {
                    continue;
                }

                IntPtr hMainWnd = proc.MainWindowHandle;
                if (hMainWnd == IntPtr.Zero)
                {
                    continue;
                }

                EnableBlur(hMainWnd);
            }

            return true;
        }
    }
}

namespace Windows
{
    internal struct VersionInfo
    {
        public int Major;
        public int Minor;
        public int Build;

        public VersionInfo(int major, int minor, int build)
        {
            this.Major = major;
            this.Minor = minor;
            this.Build = build;
        }

        public int CompareTo(VersionInfo other)
        {
            if (this.Major != other.Major)
            {
                return this.Major.CompareTo(other.Major);
            }
            else if (this.Minor != other.Minor)
            {
                return this.Minor.CompareTo(other.Minor);
            }
            else if (this.Build != other.Build)
            {
                return this.Build.CompareTo(other.Build);
            }
            else
            {
                return 0;
            }
        }
    }

    internal static class SystemInfo
    {
        public static VersionInfo Windows10 = new VersionInfo(10, 0, 10240);
        public static VersionInfo Windows10_1809 = new VersionInfo(10, 0, 17763);
        public static VersionInfo Windows10_1903 = new VersionInfo(10, 0, 18362);

        internal static VersionInfo GetVersionInfo()
        {
            var regkey = Microsoft.Win32.Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows NT\CurrentVersion\", false);
            if (regkey == null) {
                return new VersionInfo(0, 0, 0);
            }

            var majorValue = regkey.GetValue("CurrentMajorVersionNumber");
            var minorValue = regkey.GetValue("CurrentMinorVersionNumber");
            var buildValue = (string) regkey.GetValue("CurrentBuild", 7600);
            var build = 0;
            var canReadBuild = int.TryParse(buildValue, out build);

            var defaultVersion = System.Environment.OSVersion.Version;

            if (majorValue is int && minorValue is int && canReadBuild)
            {
                return new VersionInfo((int) majorValue, (int) minorValue, build);
            }
            else
            {
                return new VersionInfo(defaultVersion.Major, defaultVersion.Minor, defaultVersion.Revision);
            }
        }
    }

    internal enum AccentState
    {
        ACCENT_DISABLED = 0,
        ACCENT_ENABLE_GRADIENT = 1,
        ACCENT_ENABLE_TRANSPARENTGRADIENT = 2,
        ACCENT_ENABLE_BLURBEHIND = 3,
        ACCENT_ENABLE_ACRYLICBLURBEHIND = 4,
        ACCENT_INVALID_STATE = 5,
    }

    [StructLayout(LayoutKind.Sequential)]
    internal struct AccentPolicy
    {
        public AccentState AccentState;
        public int AccentFlags;
        public int GradientColor;
        public int AnimationId;
    }

    internal enum WindowCompositionAttribute
    {
        WCA_ACCENT_POLICY = 19,
    }

    [StructLayout(LayoutKind.Sequential)]
    internal struct WindowCompositionAttributeData
    {
        public WindowCompositionAttribute Attribute;
        public IntPtr Data;
        public int SizeOfData;
    }

    internal static class User32
    {
        // internal static extern int DwmSetWindowAttribute(IntPtr hwnd, WindowCompositionAttribute attr, ref int flags, ref int color);
        [DllImport("user32.dll")]
        internal static extern int SetWindowCompositionAttribute(IntPtr hwnd, ref WindowCompositionAttributeData data);

        [DllImport("user32.dll")]
        public static extern bool IsWindowVisible(IntPtr hWnd);
    }
}