import type { CapacitorConfig } from "@capacitor/cli";

const serverUrl =
  process.env.CAPACITOR_SERVER_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://retail-shop-management-software.vercel.app";

const config: CapacitorConfig = {
  appId: "in.webcos.retailo",
  appName: "Retailo",
  webDir: "public",
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith("http://"),
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
