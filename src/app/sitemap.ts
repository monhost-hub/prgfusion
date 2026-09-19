import { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.allcombiner.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/fusion", "/pricing", "/faq", "/contact", "/legal", "/privacy"];
  const now = new Date();

  const entries: MetadataRoute.Sitemap = [];
  for (const locale of routing.locales) {
    for (const route of routes) {
      entries.push({
        url: `${BASE_URL}/${locale}${route}`,
        lastModified: now,
        changeFrequency: route === "" ? "weekly" : "monthly",
        priority: route === "" ? 1.0 : route === "/fusion" ? 0.9 : 0.6,
      });
    }
  }
  return entries;
}
