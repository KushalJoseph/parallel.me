import type { Metadata } from "next";
import { Playfair_Display, DM_Sans, DM_Mono } from "next/font/google";
import "./globals.css";
import { TransitionLayout } from "@/components/TransitionLayout";
import { AuthProvider } from "@/lib/auth-context";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Parallel",
  description: "Find the one person who feels exactly what you feel, right now.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${dmSans.variable} ${dmMono.variable} antialiased h-full`}
    >
      <body className="min-h-[100dvh] flex flex-col bg-background text-text-primary overflow-x-hidden">
        {/* Global Background Atmospheric Blurs */}
        <div className="fixed inset-0 pointer-events-none flex justify-center items-center z-[-1]">
          <div className="absolute top-[20%] left-[20%] w-[500px] h-[500px] bg-accent/30 rounded-full blur-[120px] mix-blend-screen animate-pulse" />
          <div className="absolute bottom-[20%] right-[20%] w-[600px] h-[600px] bg-accent-warm/30 rounded-full blur-[120px] mix-blend-screen animate-pulse" style={{ animationDelay: '2s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-white/5 rounded-full blur-[150px] mix-blend-screen" />
        </div>

        <AuthProvider>
          <TransitionLayout>
            {children}
          </TransitionLayout>
        </AuthProvider>
      </body>
    </html>
  );
}
