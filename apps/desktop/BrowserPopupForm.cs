using System.Diagnostics;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace HospedajeCarlos.Desktop;

internal sealed class BrowserPopupForm : Form
{
    private readonly AppOptions options;
    private readonly WebView2 browser = new() { Dock = DockStyle.Fill };

    public BrowserPopupForm(AppOptions options)
    {
        this.options = options;
        Text = "Hospedaje Carlos — Comprobante";
        StartPosition = FormStartPosition.CenterParent;
        Size = new Size(470, 760);
        MinimumSize = new Size(380, 560);
        Controls.Add(browser);
    }

    public CoreWebView2 CoreWebView2 => browser.CoreWebView2;

    public async Task InitializeAsync(CoreWebView2Environment environment)
    {
        await browser.EnsureCoreWebView2Async(environment);
        browser.CoreWebView2.Settings.AreDevToolsEnabled = false;
        browser.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
        browser.CoreWebView2.Settings.IsStatusBarEnabled = false;
        browser.CoreWebView2.NavigationStarting += (_, eventArgs) =>
        {
            if (!Uri.TryCreate(eventArgs.Uri, UriKind.Absolute, out var uri) || options.IsInternal(uri)) return;
            eventArgs.Cancel = true;
            try
            {
                Process.Start(new ProcessStartInfo(uri.ToString()) { UseShellExecute = true });
            }
            catch (Exception exception)
            {
                DesktopLog.Write($"No se pudo abrir el enlace externo {uri}.", exception);
            }
        };
    }
}
