import { HomePage } from "@/components/home/home-page";
import type { Locale } from "@/i18n/routing";

export default function Page() {
  return <HomePage locale={"en" as Locale} strings={{
    heroBadge: "test", heroTitle: "test", heroSubtitle: "test",
    heroCtaPrimary: "test", heroCtaSecondary: "test", heroNoCreditCard: "test",
    trustTitle: "test", trustSubtitle: "test",
    trust1Title: "test", trust1Desc: "test",
    trust2Title: "test", trust2Desc: "test",
    trust3Title: "test", trust3Desc: "test",
    trust4Title: "test", trust4Desc: "test",
    howTitle: "test", howSubtitle: "test",
    step1Title: "test", step1Desc: "test",
    step2Title: "test", step2Desc: "test",
    step3Title: "test", step3Desc: "test",
    modelsTitle: "test", modelsSubtitle: "test",
    modelLiteName: "test", modelLiteDesc: "test",
    model2Name: "test", model2Desc: "test",
    modelProName: "test", modelProDesc: "test",
    ctaTitle: "test", ctaSubtitle: "test", ctaButton: "test",
  }} />;
}
