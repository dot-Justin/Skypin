import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AudioProvider } from "@/components/AudioProvider";
import ThemeToggle from "@/components/ThemeToggle";
import FilmGrain from "@/components/FilmGrain";

const gambarino = localFont({
  src: "../public/fonts/Gambarino-Regular.woff2",
  variable: "--font-gambarino",
  weight: "400",
});

const articulat = localFont({
  src: [
    {
      path: "../public/fonts/Articulat_CF_Thin.otf",
      weight: "100",
      style: "normal",
    },
    {
      path: "../public/fonts/Articulat_CF_Extra_Light.otf",
      weight: "200",
      style: "normal",
    },
    {
      path: "../public/fonts/Articulat_CF_Light.otf",
      weight: "300",
      style: "normal",
    },
    {
      path: "../public/fonts/Articulat_CF_Regular.otf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/Articulat_CF_Normal.otf",
      weight: "450",
      style: "normal",
    },
    {
      path: "../public/fonts/Articulat_CF_Medium.otf",
      weight: "500",
      style: "normal",
    },
    {
      path: "../public/fonts/Articulat_CF_Demi_Bold.otf",
      weight: "600",
      style: "normal",
    },
    {
      path: "../public/fonts/Articulat_CF_Bold.otf",
      weight: "700",
      style: "normal",
    },
    {
      path: "../public/fonts/Articulat_CF_Extra_Bold.otf",
      weight: "800",
      style: "normal",
    },
    {
      path: "../public/fonts/Articulat_CF_Heavy.otf",
      weight: "900",
      style: "normal",
    },
  ],
  variable: "--font-articulat",
});

export const metadata: Metadata = {
  title: "Skypin",
  description: "Listen anywhere",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                function getCookie(name) {
                  const value = \`; \${document.cookie}\`;
                  const parts = value.split(\`; \${name}=\`);
                  if (parts.length === 2) return parts.pop().split(';').shift();
                }

                const theme = getCookie('skypin-theme');
                // Default to dark mode if no cookie exists
                if (theme === 'dark' || !theme) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body className={`${gambarino.variable} ${articulat.variable} antialiased`} suppressHydrationWarning>
        <FilmGrain />
        <ThemeProvider>
          <AudioProvider>
            <ThemeToggle />
            {children}
          </AudioProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}