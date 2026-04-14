import './globals.css';
import { Inter, JetBrains_Mono, Outfit } from 'next/font/google';
import { ThemeProvider } from './components/ThemeProvider';
import { SpeedInsights } from "@vercel/speed-insights/next";


const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-display',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata = {
  title: 'Trainers SuperApp - Kontak OJK 157',
  description: 'Platform Manajemen Pelatihan Profesional untuk Kontak OJK 157',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="id" className={`${inter.variable} ${outfit.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <body className="antialiased selection:bg-primary/20" suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <SpeedInsights />
        </ThemeProvider>
      </body>
    </html>
  );
}
