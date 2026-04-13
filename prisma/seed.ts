import {
  FamilyRole,
  HealthRecordKind,
  ManagedRelationRole,
  PrismaClient,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.healthRecord.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.family.deleteMany();

  const family = await prisma.family.create({
    data: { name: "Demo үй-бүлө" },
  });

  const admin = await prisma.profile.create({
    data: {
      familyId: family.id,
      displayName: "Айгүл (админ)",
      telegramUserId: "demo-admin-telegram",
      familyRole: FamilyRole.ADMIN,
      isManaged: false,
      avatarUrl: null,
    },
  });

  const child = await prisma.profile.create({
    data: {
      familyId: family.id,
      displayName: "Нурлан (бала)",
      telegramUserId: null,
      familyRole: FamilyRole.MEMBER,
      isManaged: true,
      managedRole: ManagedRelationRole.CHILD,
      dateOfBirth: new Date("2020-05-15"),
    },
  });

  await prisma.healthRecord.create({
    data: {
      profileId: child.id,
      kind: HealthRecordKind.LAB_ANALYSIS,
      isPrivate: false,
      title: "Общий анализ крови",
      data: {
        panel: "CBC",
        collectedAt: "2026-04-01",
        results: { hemoglobin: 140, wbc: 6.2 },
      },
    },
  });

  console.log("Seed OK. familyId=%s adminId=%s childId=%s", family.id, admin.id, child.id);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    void prisma.$disconnect();
    process.exit(1);
  });
