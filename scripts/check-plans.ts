import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const plans = await db.pricingPlan.findMany({
    where: { slug: { startsWith: "sub_" } },
    select: { slug: true, whopPlanId: true, whopCheckoutUrl: true, enabled: true }
  });
  console.log(JSON.stringify(plans, null, 2));
}
main().finally(() => db.$disconnect());
