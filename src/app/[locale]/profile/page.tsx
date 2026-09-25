import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/server";
import { ProfileClient } from "@/components/auth/profile-client";

/**
 * /profile — User profile page.
 *
 * Server component that:
 *   1. Checks auth (redirects to /login if not authenticated)
 *   2. Fetches user email + emailVerified from DB
 *   3. Renders ProfileClient with the user's data
 */
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // 1. Auth — redirect to login if not authenticated
  const session = await getSession();
  if (!session?.user?.id) {
    redirect(`/${locale}/login?callbackUrl=/${locale}/profile`);
  }

  // 2. Fetch user data from DB
  const user = await db.user
    .findUnique({
      where: { id: session.user.id },
      select: { email: true, emailVerified: true, name: true },
    })
    .catch(() => null);

  if (!user) {
    redirect(`/${locale}/login`);
  }

  return (
    <div className="container mx-auto px-4 py-12 md:py-20">
      <ProfileClient
        userEmail={user.email}
        userName={user.name || ""}
        emailVerified={user.emailVerified}
      />
    </div>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Auth" });
  return { title: t("profileTitle") };
}
