import {
  BiologicalSex,
  FamilyRole,
  ManagedRelationRole,
  PrismaClient,
} from "@prisma/client";
import {
  getPinAnchorPepper,
  pinAnchorFromNormalizedPin,
} from "../lib/pin-subject-anchor";

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

  const adminPin = pinAnchorFromNormalizedPin("100000000100001", getPinAnchorPepper());
  const childPin = pinAnchorFromNormalizedPin("100000000100002", getPinAnchorPepper());

  const admin = await prisma.profile.create({
    data: {
      familyId: family.id,
      displayName: "Айгүл (админ)",
      telegramUserId: "1000000001",
      familyRole: FamilyRole.ADMIN,
      isManaged: false,
      avatarUrl: null,
      biologicalSex: BiologicalSex.FEMALE,
      pinAnchor: adminPin,
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
      pinAnchor: childPin,
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
