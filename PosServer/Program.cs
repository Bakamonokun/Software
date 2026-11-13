using System;

namespace KanhaPosServer
{
    internal static class Program
    {
        public static void Main(string[] args)
        {
            int port = 3000;
            for (int i = 0; i < args.Length - 1; i++)
            {
                if (string.Equals(args[i], "--port", StringComparison.OrdinalIgnoreCase) &&
                    int.TryParse(args[i + 1], out int parsedPort))
                {
                    port = parsedPort;
                }
            }

            Console.Title = $"Kanha Software Solution — Enterprise POS Server (Port {port})";
            Console.WriteLine("==================================================================");
            Console.WriteLine("  KANHA SOFTWARE SOLUTION - MULTI-PLATFORM POS SERVER (v2.5.1d)   ");
            Console.WriteLine("==================================================================");
            Console.WriteLine($"  Vault File : {AppStore.VaultFilePath}");
            Console.WriteLine($"  Host URL   : http://localhost:{port}");
            Console.WriteLine("------------------------------------------------------------------");

            AppStore.LoadOrInitialize();
            Console.WriteLine($"  Active FY  : {AppStore.Data.ActiveFinancialYear}");
            Console.WriteLine($"  Devices    : {AppStore.Data.PairedDevices.Count} registered");
            Console.WriteLine("  Server is online and listening for POS & Android clients...");
            Console.WriteLine("==================================================================");

            AppStore.RunBlockingHost(port);
        }
    }
}
