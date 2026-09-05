import type { Metadata } from "next";
import HealthGuard from "@/components/BackendGuard";
import { SettingsProvider } from "@/contexts/SettingsContext";
import Providers from "@/components/Providers";
import "./globals.css";
import NavBar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "YouTube History Viewer",
  description: "Browse, filter, and explore your YouTube watch history locally.",
};

export default function RootLayout({ children }: { children: React.ReactNode; }) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      {/* The window itself never scrolls; each route owns its own scroll region. */}
      <body className="h-full overflow-hidden">
        <Providers>
          <HealthGuard>
            <SettingsProvider>
              <div className="flex h-full flex-col bg-canvas text-fg">
                <NavBar />
                <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
              </div>
            </SettingsProvider>
          </HealthGuard>
        </Providers>
      </body>
    </html>
  );
}
