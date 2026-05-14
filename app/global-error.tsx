'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body className="flex min-h-screen items-center justify-center bg-gray-950 p-8">
        <div className="max-w-md text-center space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 text-red-500">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-white">Terjadi Kesalahan</h2>
            <p className="text-sm text-gray-400 leading-6">
              Aplikasi mengalami masalah yang tidak terduga. Silakan muat ulang halaman.
            </p>
            {error.digest && (
              <p className="text-xs text-gray-500 font-mono">
                Digest: {error.digest}
              </p>
            )}
          </div>
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-full border border-gray-700 bg-gray-800 px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-700"
          >
            Muat Ulang Halaman
          </button>
        </div>
      </body>
    </html>
  );
}
