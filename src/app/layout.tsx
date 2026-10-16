import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/pwa";
import "./globals.css";

const thai = IBM_Plex_Sans_Thai({
  variable: "--font-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: { default: "WorkNest", template: "%s · WorkNest" },
  description: "จัดการลูกค้า ใบเสนอราคา และการเก็บเงินสำหรับฟรีแลนซ์",
  applicationName: "WorkNest",
  // iPhone: opens full screen when launched from the home screen.
  appleWebApp: { capable: true, title: "WorkNest", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#24735a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${thai.variable} h-full antialiased`}>
      {/* Browser extensions (e.g. ColorZilla) add attributes to <body> before hydration. */}
      <body className="min-h-full font-sans" suppressHydrationWarning>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
