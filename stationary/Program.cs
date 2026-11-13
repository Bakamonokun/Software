using System;
using System.Drawing;
using System.IO;
using System.Windows.Forms;
using KanhaPosServer;

namespace POSApp
{
    internal static class Program
    {
        [STAThread]
        static void Main(string[] args)
        {
            try
            {
                try { Application.SetHighDpiMode(HighDpiMode.SystemAware); } catch { }
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);

                // Initialize shared persistent store (GST + Non-GST profiles)
                AppStore.LoadOrInitialize();

                // Automatically start embedded network host on port 3000 if not already running
                AppStore.StartEmbeddedHostIfPortFree(3000);

                // Block terminal immediately if revoked or suspended from Developer Panel
                if (AppStore.IsCurrentDeviceRevokedOrSuspended(out string status, out string reason))
                {
                    MessageBox.Show(
                        reason + "\n\nPlease contact the System Administrator or reactivate this device from the Developer / Server Control Panel.",
                        $"Terminal Access {status} — Kanha Software Solution",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Stop);
                    return;
                }

                // Launch secure authentication dialog before opening POS shell
                using (var login = new SecureLoginForm())
                {
                    if (login.ShowDialog() != DialogResult.OK)
                        return;
                }

                Application.Run(new MainForm());
            }
            catch (Exception ex)
            {
                string logPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "pos_crash.log");
                try { File.WriteAllText(logPath, DateTime.Now + Environment.NewLine + ex); } catch { }
                MessageBox.Show(
                    "Fatal Startup Error:\n" + ex.Message + "\n\nDetails saved to: " + logPath,
                    "Kanha Software Solution — Startup Error",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
            }
        }
    }
}
