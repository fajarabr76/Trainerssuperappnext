import './globals.css';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { ThemeProvider } from './components/ThemeProvider';


const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
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
    <html lang="id" className={`${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <body className="antialiased selection:bg-primary/20" suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
