namespace HospedajeCarlos.Desktop;

internal static class Program
{
    [STAThread]
    private static void Main(string[] args)
    {
        AppOptions options;
        try
        {
            options = AppOptions.Parse(args);
        }
        catch (Exception exception)
        {
            MessageBox.Show(exception.Message, "Hospedaje Carlos", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return;
        }

        var mutexName = $"Local\\HospedajeCarlos.Desktop.{(options.Kiosk ? "Kiosk" : "Reception")}";
        using var instanceMutex = new Mutex(true, mutexName, out var isFirstInstance);
        if (!isFirstInstance)
        {
            MessageBox.Show(
                options.Kiosk ? "El kiosco ya está abierto." : "La recepción ya está abierta.",
                "Hospedaje Carlos",
                MessageBoxButtons.OK,
                MessageBoxIcon.Information);
            return;
        }

        Application.SetUnhandledExceptionMode(UnhandledExceptionMode.CatchException);
        Application.ThreadException += (_, eventArgs) =>
        {
            DesktopLog.Write("Error no controlado en la interfaz.", eventArgs.Exception);
            MessageBox.Show(
                "La aplicación encontró un error inesperado. Podés cerrarla y abrirla nuevamente.\n\n" +
                $"Detalle guardado en: {DesktopLog.FilePath}",
                "Hospedaje Carlos",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
        };
        AppDomain.CurrentDomain.UnhandledException += (_, eventArgs) =>
            DesktopLog.Write("Error no controlado en el proceso.", eventArgs.ExceptionObject as Exception);

        ApplicationConfiguration.Initialize();
        DesktopLog.Write($"Inicio de aplicación. Modo={(options.Kiosk ? "kiosco" : "recepción")}; URL={options.StartUri}");
        Application.Run(new MainForm(options));
    }
}
