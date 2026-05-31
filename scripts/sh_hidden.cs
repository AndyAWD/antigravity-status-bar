using System;
using System.Diagnostics;
using System.IO;

class Program {
    static void Main(string[] args) {
        if (args.Length >= 2 && args[0] == "-c") {
            ProcessStartInfo psi = new ProcessStartInfo {
                FileName = "cmd.exe",
                Arguments = "/c " + args[1],
                CreateNoWindow = true,
                UseShellExecute = false,
                RedirectStandardOutput = true
            };
            using (Process p = Process.Start(psi)) {
                using (Stream stream = p.StandardOutput.BaseStream)
                using (Stream stdout = Console.OpenStandardOutput()) {
                    stream.CopyTo(stdout);
                }
                p.WaitForExit();
            }
        }
    }
}
