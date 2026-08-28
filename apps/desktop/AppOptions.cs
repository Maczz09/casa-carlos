namespace HospedajeCarlos.Desktop;

internal sealed record AppOptions(bool Kiosk, Uri ServerBaseUri, int? TestExitAfterSeconds)
{
    public static AppOptions Parse(string[] args)
    {
        var kiosk = args.Any(argument => argument.Equals("--kiosk", StringComparison.OrdinalIgnoreCase));
        var configuredUrl = Environment.GetEnvironmentVariable("HOSPEDAJE_CARLOS_URL");
        int? testExitAfterSeconds = null;

        foreach (var argument in args)
        {
            if (argument.StartsWith("--url=", StringComparison.OrdinalIgnoreCase))
                configuredUrl = argument[6..];

            if (argument.StartsWith("--test-exit-after=", StringComparison.OrdinalIgnoreCase)
                && int.TryParse(argument[18..], out var seconds)
                && seconds > 0)
                testExitAfterSeconds = seconds;
        }

        if (!Uri.TryCreate(configuredUrl ?? "http://127.0.0.1:4000/", UriKind.Absolute, out var serverUri)
            || !IsLocalServer(serverUri))
            throw new ArgumentException("La dirección del servidor debe apuntar a localhost o 127.0.0.1.");

        return new AppOptions(kiosk, EnsureTrailingSlash(serverUri), testExitAfterSeconds);
    }

    public Uri StartUri => new(ServerBaseUri, Kiosk ? "kiosk/" : "");

    public bool IsInternal(Uri uri)
    {
        if (uri.Scheme is "about" or "data" or "blob") return true;
        return IsLocalServer(uri) && uri.Port == ServerBaseUri.Port;
    }

    private static bool IsLocalServer(Uri uri) =>
        uri.IsLoopback || uri.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase);

    private static Uri EnsureTrailingSlash(Uri uri) =>
        uri.AbsolutePath.EndsWith('/') ? uri : new Uri(uri.ToString() + "/");
}
