import type { MetadataRoute } from "next";

// Lets phones install WorkNest to the home screen and open it without browser chrome.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WorkNest",
    short_name: "WorkNest",
    description: "จัดการลูกค้า ใบเสนอราคา และการเก็บเงินสำหรับฟรีแลนซ์",
    lang: "th",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#f7f7f5",
    theme_color: "#24735a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "สร้างใบเสนอราคา", url: "/quotations/new" },
      { name: "ใบแจ้งหนี้", url: "/invoices" },
      { name: "ลูกค้า", url: "/clients" },
    ],
  };
}
