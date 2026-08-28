using System.Diagnostics;
using System.Net;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace HospedajeCarlos.Desktop;

internal sealed class MainForm : Form
{
    private readonly AppOptions options;
    private readonly CancellationTokenSource lifetime = new();
    private readonly HttpClient httpClient = new() { Timeout = TimeSpan.FromSeconds(2) };
    private readonly WebView2 browser = new() { Dock = DockStyle.Fill, Visible = false };
    private readonly Panel loadingPanel = new() { Dock = DockStyle.Fill, BackColor = Color.FromArgb(245, 247, 250) };
    private readonly Label statusLabel = new()
    {
        AutoSize = false,
        Dock = DockStyle.Fill,
        TextAlign = ContentAlignment.TopCenter,
        ForeColor = Color.FromArgb(71, 85, 105),
        Font = new Font("Segoe UI", 11F),
        Padding = new Padding(24, 8, 24, 0)
    };
    private readonly Button retryButton = new()
    {
        Text = "Reintentar",
        AutoSize = true,
        Visible = false,
        BackColor = Color.FromArgb(15, 45, 75),
        ForeColor = Color.White,
        FlatStyle = FlatStyle.Flat,
        Padding = new Padding(22, 8, 22, 8),
        Cursor = Cursors.Hand
    };
    private bool initializing;

    public MainForm(AppOptions options)
    {
        this.options = options;
        Text = options.Kiosk ? "Hospedaje Carlos — Kiosco" : "Hospedaje Carlos — Recepción";
        BackColor = Color.FromArgb(245, 247, 250);
        MinimumSize = new Size(1050, 700);
        StartPosition = FormStartPosition.CenterScreen;
        WindowState = FormWindowState.Maximized;

        if (options.Kiosk)
        {
            FormBorderStyle = FormBorderStyle.None;
            MinimumSize = Size.Empty;
        }

        BuildLoadingPanel();
        Controls.Add(browser);
        Controls.Add(loadingPanel);

        retryButton.Click += async (_, _) => await InitializeApplicationAsync();
        Shown += async (_, _) =>
        {
            if (options.TestExitAfterSeconds is int seconds)
            {
                var timer = new System.Windows.Forms.Timer { Interval = seconds * 1000 };
                timer.Tick += (_, _) => Close();
                timer.Start();
            }

            await InitializeApplicationAsync();
        };
        FormClosing += (_, _) => lifetime.Cancel();
    }

    private void BuildLoadingPanel()
    {
        var layout = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 3,
            RowCount = 7,
            BackColor = loadingPanel.BackColor
        };
        layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50));
        layout.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 520));
        layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50));
        layout.RowStyles.Add(new RowStyle(SizeType.Percent, 50));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 84));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 58));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 34));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 92));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 54));
        layout.RowStyles.Add(new RowStyle(SizeType.Percent, 50));

        var mark = new Label
        {
            Text = "HC",
            Dock = DockStyle.Fill,
            TextAlign = ContentAlignment.MiddleCenter,
            Font = new Font("Segoe UI", 28F, FontStyle.Bold),
            ForeColor = Color.White,
            BackColor = Color.FromArgb(15, 45, 75),
            Margin = new Padding(218, 0, 218, 0)
        };
        var title = new Label
        {
            Text = "Hospedaje Carlos",
            Dock = DockStyle.Fill,
            TextAlign = ContentAlignment.MiddleCenter,
            Font = new Font("Segoe UI", 24F, FontStyle.Bold),
            ForeColor = Color.FromArgb(15, 45, 75)
        };
        var mode = new Label
        {
            Text = options.Kiosk ? "PANTALLA DEL CLIENTE" : "SISTEMA DE RECEPCIÓN",
            Dock = DockStyle.Fill,
            TextAlign = ContentAlignment.MiddleCenter,
            Font = new Font("Segoe UI", 9F, FontStyle.Bold),
            ForeColor = Color.FromArgb(14, 116, 144)
        };
        var buttonHost = new FlowLayoutPanel
        {
            Dock = DockStyle.Fill,
            FlowDirection = FlowDirection.LeftToRight,
            WrapContents = false
        };
        retryButton.FlatAppearance.BorderSize = 0;
        buttonHost.Controls.Add(retryButton);
        buttonHost.Resize += (_, _) => retryButton.Margin = new Padding(
            Math.Max(0, (buttonHost.ClientSize.Width - retryButton.PreferredSize.Width) / 2), 4, 0, 0);

        layout.Controls.Add(mark, 1, 1);
        layout.Controls.Add(title, 1, 2);
        layout.Controls.Add(mode, 1, 3);
        layout.Controls.Add(statusLabel, 1, 4);
        layout.Controls.Add(buttonHost, 1, 5);
        loadingPanel.Controls.Add(layout);
    }

    private async Task InitializeApplicationAsync()
    {
        if (initializing || lifetime.IsCancellationRequested) return;
        initializing = true;
        retryButton.Visible = false;
        loadingPanel.Visible = true;
        loadingPanel.BringToFront();
        browser.Visible = false;

        try
        {
            statusLabel.Text = "Iniciando los servicios del hotel…";
            if (!await WaitForServerAsync(lifetime.Token))
            {
                statusLabel.Text = "No se pudo iniciar el servidor. Verificá que el servicio “CasaCarlos” esté instalado o reiniciá la computadora.";
                retryButton.Visible = true;
                return;
            }

            statusLabel.Text = "Preparando la aplicación de escritorio…";
            await InitializeBrowserAsync();
            browser.Source = options.StartUri;
            browser.Visible = true;
            browser.BringToFront();
            loadingPanel.Visible = false;
        }
        catch (OperationCanceledException) when (lifetime.IsCancellationRequested)
        {
        }
        catch (Exception exception)
        {
            DesktopLog.Write("No se pudo inicializar la aplicación.", exception);
            statusLabel.Text = "No se pudo abrir la aplicación. Presioná Reintentar. Si continúa, revisá el registro de diagnóstico.";
            retryButton.Visible = true;
        }
        finally
        {
            initializing = false;
        }
    }

    private async Task<bool> WaitForServerAsync(CancellationToken cancellationToken)
    {
        var healthUri = new Uri(options.ServerBaseUri, "api/health");
        for (var attempt = 1; attempt <= 45; attempt++)
        {
            cancellationToken.ThrowIfCancellationRequested();
            try
            {
                using var response = await httpClient.GetAsync(healthUri, cancellationToken);
                if (response.StatusCode == HttpStatusCode.OK)
                {
                    DesktopLog.Write($"Servidor disponible después de {attempt} intento(s).");
                    return true;
                }
            }
            catch (HttpRequestException)
            {
            }
            catch (TaskCanceledException) when (!cancellationToken.IsCancellationRequested)
            {
            }

            if (attempt == 1) TryStartWindowsService();
            statusLabel.Text = $"Esperando al servicio del hotel… ({attempt}/45)";
            await Task.Delay(1000, cancellationToken);
        }

        DesktopLog.Write("El servidor no respondió dentro del tiempo de espera.");
        return false;
    }

    private static void TryStartWindowsService()
    {
        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = "sc.exe",
                Arguments = "start casacarlos.exe",
                UseShellExecute = false,
                CreateNoWindow = true,
                WindowStyle = ProcessWindowStyle.Hidden
            });
        }
        catch (Exception exception)
        {
            DesktopLog.Write("No se pudo solicitar el arranque del servicio.", exception);
        }
    }

    private async Task InitializeBrowserAsync()
    {
        if (browser.CoreWebView2 is not null) return;

        var profileName = options.Kiosk ? "Kiosk" : "Reception";
        var userDataFolder = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "HospedajeCarlos",
            "WebView2",
            profileName);
        Directory.CreateDirectory(userDataFolder);

        var environment = await CoreWebView2Environment.CreateAsync(userDataFolder: userDataFolder);
        await browser.EnsureCoreWebView2Async(environment);

        var core = browser.CoreWebView2
            ?? throw new InvalidOperationException("WebView2 no terminó de inicializarse.");
        var settings = core.Settings;
        settings.AreDevToolsEnabled = false;
        settings.AreDefaultContextMenusEnabled = false;
        settings.IsStatusBarEnabled = false;
        settings.IsPasswordAutosaveEnabled = false;
        settings.IsGeneralAutofillEnabled = false;
        settings.AreBrowserAcceleratorKeysEnabled = !options.Kiosk;

        core.NavigationStarting += (_, eventArgs) =>
        {
            if (!Uri.TryCreate(eventArgs.Uri, UriKind.Absolute, out var uri) || options.IsInternal(uri)) return;
            eventArgs.Cancel = true;
            OpenExternal(uri);
        };
        core.NewWindowRequested += HandleNewWindowRequested;
        core.ProcessFailed += (_, eventArgs) =>
        {
            DesktopLog.Write($"WebView2 terminó inesperadamente: {eventArgs.ProcessFailedKind}");
            BeginInvoke(async () =>
            {
                loadingPanel.Visible = true;
                loadingPanel.BringToFront();
                statusLabel.Text = "La pantalla se reinició inesperadamente. Recuperando…";
                browser.Visible = false;
                await Task.Delay(700);
                browser.Reload();
                browser.Visible = true;
                browser.BringToFront();
                loadingPanel.Visible = false;
            });
        };
    }

    private async void HandleNewWindowRequested(object? sender, CoreWebView2NewWindowRequestedEventArgs eventArgs)
    {
        if (Uri.TryCreate(eventArgs.Uri, UriKind.Absolute, out var uri) && !options.IsInternal(uri))
        {
            eventArgs.Handled = true;
            OpenExternal(uri);
            return;
        }

        var deferral = eventArgs.GetDeferral();
        try
        {
            var popup = new BrowserPopupForm(options);
            var environment = browser.CoreWebView2?.Environment
                ?? throw new InvalidOperationException("WebView2 no está disponible.");
            await popup.InitializeAsync(environment);
            eventArgs.NewWindow = popup.CoreWebView2;
            eventArgs.Handled = true;
            popup.Show(this);
        }
        catch (Exception exception)
        {
            eventArgs.Handled = true;
            DesktopLog.Write("No se pudo abrir la ventana de comprobante.", exception);
            MessageBox.Show(
                "No se pudo abrir la ventana de impresión. Intentá nuevamente.",
                "Hospedaje Carlos",
                MessageBoxButtons.OK,
                MessageBoxIcon.Warning);
        }
        finally
        {
            deferral.Complete();
        }
    }

    private static void OpenExternal(Uri uri)
    {
        try
        {
            Process.Start(new ProcessStartInfo(uri.ToString()) { UseShellExecute = true });
        }
        catch (Exception exception)
        {
            DesktopLog.Write($"No se pudo abrir el enlace externo {uri}.", exception);
        }
    }
}
