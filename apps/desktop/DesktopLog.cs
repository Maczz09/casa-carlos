namespace HospedajeCarlos.Desktop;

internal static class DesktopLog
{
    private static readonly object Sync = new();
    private static readonly string DirectoryPath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "HospedajeCarlos");

    public static string FilePath => Path.Combine(DirectoryPath, "desktop.log");

    public static void Write(string message, Exception? exception = null)
    {
        try
        {
            Directory.CreateDirectory(DirectoryPath);
            var line = $"{DateTimeOffset.Now:yyyy-MM-dd HH:mm:ss zzz} {message}";
            if (exception is not null) line += Environment.NewLine + exception;
            lock (Sync) File.AppendAllText(FilePath, line + Environment.NewLine);
        }
        catch
        {
            // El log nunca debe impedir que la aplicación arranque.
        }
    }
}
