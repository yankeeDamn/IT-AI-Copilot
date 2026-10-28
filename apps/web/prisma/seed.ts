/**
 * Explicit post-login organization bootstrap. Invoked by a trusted operator only.
 * Example (PowerShell): $env:BOOTSTRAP_ADMIN_EMAIL="verified@company.com"
 * npm run db:seed
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const roleMatrix: Record<string, string[]> = {
  admin: ["tickets.read", "tickets.create", "tickets.assign", "tickets.close", "assets.read", "assets.manage", "knowledge.read", "knowledge.manage", "reports.view", "users.manage", "ai.use", "settings.manage"],
  it_manager: ["tickets.read", "tickets.create", "tickets.assign", "tickets.close", "assets.read", "assets.manage", "knowledge.read", "knowledge.manage", "reports.view", "ai.use"],
  technician: ["tickets.read", "tickets.create", "tickets.close", "assets.read", "knowledge.read", "ai.use"],
  employee: ["tickets.read", "tickets.create", "knowledge.read"],
  auditor: ["tickets.read", "assets.read", "knowledge.read", "reports.view"]
};

async function main() {
  const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const slug = process.env.BOOTSTRAP_ORG_SLUG?.trim();
  const name = process.env.BOOTSTRAP_ORG_NAME?.trim();
  if (!adminEmail || !slug || !name || !/^[a-z0-9-]{3,50}$/.test(slug)) {
    throw new Error("Set BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ORG_SLUG and BOOTSTRAP_ORG_NAME");
  }
  const user = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!user || user.deletedAt) {
    throw new Error("Admin must first sign in using configured OAuth provider; account not found");
  }
  await prisma.$transaction(async tx => {
    const org = await tx.organization.upsert({
      where: { slug },
      create: { slug, name },
      update: { name }
    });
    for (const [key, permissions] of Object.entries(roleMatrix)) {
      const role = await tx.role.upsert({
        where: { organizationId_key: { organizationId: org.id, key } },
        create: { organizationId: org.id, key, name: key.replaceAll("_", " ") },
        update: {}
      });
      for (const permissionKey of permissions) {
        const permission = await tx.permission.upsert({
          where: { key: permissionKey },
          create: { key: permissionKey }, update: {}
        });
        await tx.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
          create: { roleId: role.id, permissionId: permission.id },
          update: {}
        });
      }
    }
    const admin = await tx.role.findUniqueOrThrow({
      where: { organizationId_key: { organizationId: org.id, key: "admin" } }
    });
    await tx.membership.upsert({
      where: { organizationId_userId: { organizationId: org.id, userId: user.id } },
      create: { organizationId: org.id, userId: user.id, roleId: admin.id, active: true },
      update: { roleId: admin.id, active: true }
    });
    console.log("Provisioned organization", org.slug, "for verified account", adminEmail);
  });
}
main().finally(() => prisma.$disconnect());
