import {
  BiologicalSex,
  FamilyRole,
  HealthRecordKind,
  ManagedRelationRole,
  PrismaClient,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.shareToken.deleteMany();
  await prisma.healthRecordMetrics.deleteMany();
  await prisma.healthRecord.deleteMany();
  await prisma.medication.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.family.deleteMany();

  const family = await prisma.family.create({
    data: { name: "Demo үй-бүлө" },
  });

  const admin = await prisma.profile.create({
    data: {
      familyId: family.id,
      displayName: "Айгүл (админ)",
      telegramUserId: "1000000001",
      familyRole: FamilyRole.ADMIN,
      isManaged: false,
      avatarUrl: null,
      biologicalSex: BiologicalSex.FEMALE,
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
      biologicalSex: BiologicalSex.MALE,
    },
  });

  await prisma.healthRecord.create({
    data: {
      profileId: child.id,
      kind: HealthRecordKind.LAB_ANALYSIS,
      isPrivate: false,
      title: "Общий анализ крови (seed)",
      data: {
        sourceFileId: "seed",
        mimeType: "application/x-seed",
        anonymizedAt: new Date().toISOString(),
        parsedAt: new Date().toISOString(),
        parser: "seed",
      },
      metrics: {
        create: {
          payload: {
            biomarkers: [
              {
                biomarker: "Гемоглобин",
                value: 128,
                unit: "г/л",
                reference: "110–145",
              },
              {
                biomarker: "Глюкоза",
                value: 4.9,
                unit: "ммоль/л",
                reference: "3.3–5.6",
              },
            ],
          },
        },
      },
    },
  });

  console.log("Seed OK. familyId=%s adminId=%s childId=%s", family.id, admin.id, child.id);
  console.log("Admin telegramUserId=1000000001 (замените на реальный chat_id для теста напоминаний).");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    void prisma.$disconnect();
    process.exit(1);
  });
