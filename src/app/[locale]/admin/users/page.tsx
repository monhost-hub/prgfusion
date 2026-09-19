import { setRequestLocale, getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { AdminUsersClient } from "@/components/admin/admin-users-client";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Admin" });

  const users = await db.user.findMany({
    select: { id: true, email: true, name: true, role: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <AdminUsersClient
      users={users}
      labels={{
        title: t("usersTitle"),
        colEmail: t("usersColEmail"),
        colName: t("usersColName"),
        colRole: t("usersColRole"),
        colCreated: t("usersColCreated"),
        colActions: t("usersColActions"),
        makeAdmin: t("usersMakeAdmin"),
        makeUser: t("usersMakeUser"),
        delete: t("usersDelete"),
        confirmDelete: t("usersConfirmDelete"),
      }}
    />
  );
}
