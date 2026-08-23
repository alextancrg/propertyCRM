import { PrismaClient, PropertyStatus, LeaseStatus, BillStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Default login for the seeded property manager (change after first login).
const MANAGER_PASSWORD = "Assethub@2026";


async function main() {
  // Clear existing data (idempotent reseed)
  await prisma.chatMessage.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.document.deleteMany();
  await prisma.annualIncome.deleteMany();
  await prisma.rentReminder.deleteMany();
  await prisma.rentPayment.deleteMany();
  await prisma.billPayment.deleteMany();
  await prisma.bill.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.lease.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.propertyOwner.deleteMany();
  await prisma.property.deleteMany();
  await prisma.owner.deleteMany();
  await prisma.user.deleteMany();
  await prisma.aiAgentConfig.deleteMany();

  // ── Users (Property Managers) ────────────────────────────────────────────
  const manager = await prisma.user.create({
    data: {
      name: "John Doe",
      email: "admin@assethub.my",
      role: "Property Manager",
      passwordHash: await bcrypt.hash(MANAGER_PASSWORD, 10),
    },
  });

  // ── Owners ───────────────────────────────────────────────────────────────
  const fazil = await prisma.owner.create({
    data: { name: "Dato' Fazil", icNumber: "820101-14-XXXX", phone: "012-555-0101", email: "fazil@example.my" },
  });
  const lim = await prisma.owner.create({
    data: { name: "Lim Wei Chong", icNumber: "750412-10-XXXX", phone: "019-222-7711", email: "lim@example.my" },
  });
  const zaki = await prisma.owner.create({
    data: { name: "Ahmad Zaki", icNumber: "790805-01-XXXX", phone: "013-444-1122" },
  });

  // ── Tenants ──────────────────────────────────────────────────────────────
  const sarah = await prisma.tenant.create({
    data: { name: "Sarah Ahmad", phone: "017-333-8899", email: "sarah@example.my" },
  });
  const rajesh = await prisma.tenant.create({
    data: { name: "Rajesh Kumar", phone: "016-888-9944", email: "rajesh@example.my" },
  });

  // ── Properties ───────────────────────────────────────────────────────────
  const apt = await prisma.property.create({
    data: {
      name: "Apt 4B, TTDI",
      type: "Apartment",
      address: "Block B, Jalan Tun Mohd Fuad",
      location: "TTDI, KL",
      status: PropertyStatus.LEASED,
      rent: 1500,
      rentStartDate: new Date("2025-11-01"),
      owners: { create: { ownerId: fazil.id, sharePercent: 100 } },
    },
  });

  const villa = await prisma.property.create({
    data: {
      name: "Villa 12, Bangsar South",
      type: "Villa",
      address: "12, Jalan Kerinchi Kiri",
      location: "Bangsar South, KL",
      status: PropertyStatus.ARREARS,
      rent: 3200,
      rentStartDate: new Date("2025-08-01"),
      owners: { create: { ownerId: lim.id, sharePercent: 100 } },
    },
  });

  const mk = await prisma.property.create({
    data: {
      name: "Unit 2A, MK Pines",
      type: "Condominium",
      address: "MK Pines, Jalan Kiara",
      location: "Mont Kiara, KL",
      status: PropertyStatus.VACANT,
      rent: 2800,
      owners: {
        create: [
          { ownerId: fazil.id, sharePercent: 50 },
          { ownerId: zaki.id, sharePercent: 50 },
        ],
      },
    },
  });

  // ── Leases ───────────────────────────────────────────────────────────────
  await prisma.lease.create({
    data: {
      propertyId: apt.id,
      tenantId: sarah.id,
      startDate: new Date("2025-11-01"),
      endDate: new Date("2026-10-31"),
      monthlyRent: 1500,
      deposit: 3000,
      status: LeaseStatus.ACTIVE,
      stampedAt: new Date("2025-11-05"),
      stampingRef: "LHDN-2025-88321",
      rentPayments: {
        create: [
          { month: "2026-08", amount: 1500, status: BillStatus.UNPAID },
          { month: "2026-07", amount: 1500, status: BillStatus.PAID, paidAt: new Date("2026-07-03") },
        ],
      },
    },
  });

  await prisma.lease.create({
    data: {
      propertyId: villa.id,
      tenantId: rajesh.id,
      startDate: new Date("2025-08-01"),
      endDate: new Date("2026-07-31"),
      monthlyRent: 3200,
      deposit: 6400,
      status: LeaseStatus.ACTIVE,
      stampedAt: new Date("2025-08-04"),
      stampingRef: "LHDN-2025-66214",
      rentPayments: {
        create: [
          { month: "2026-08", amount: 3200, status: BillStatus.UNPAID },
          { month: "2026-07", amount: 3200, status: BillStatus.PAID, paidAt: new Date("2026-07-06") },
        ],
      },
    },
  });

  // ── Bills + payments ─────────────────────────────────────────────────────
  // Each bill stores the billing year, the due-date pattern for that year
  // (as JSON), free-text remarks, and its per-cycle payments (with due dates).
  const cycle = "Aug 2026";

  // Apt 4B
  const aptElectricity = await prisma.bill.create({
    data: {
      propertyId: apt.id,
      type: "Electricity",
      provider: "TNB",
      schedule: "Monthly",
      amountType: "Variable",
      year: 2026,
      dueDates: JSON.stringify(["2026-08-15"]),
      remarks: "TNB meter reading taken on the 14th each month.",
      payments: { create: { cycle, dueDate: new Date("2026-08-15"), amount: 0, status: BillStatus.UNPAID } },
    },
  });
  await prisma.bill.create({
    data: {
      propertyId: apt.id,
      type: "Water",
      provider: "Air Selangor",
      schedule: "Monthly",
      amountType: "Variable",
      year: 2026,
      dueDates: JSON.stringify(["2026-08-20"]),
      payments: { create: { cycle, dueDate: new Date("2026-08-20"), amount: 45.5, status: BillStatus.PAID, paidAt: new Date("2026-08-10") } },
    },
  });
  await prisma.bill.create({
    data: {
      propertyId: apt.id,
      type: "Sewerage",
      provider: "Indah Water",
      schedule: "Monthly",
      amountType: "Variable",
      year: 2026,
      dueDates: JSON.stringify(["2026-08-25"]),
      payments: { create: { cycle, dueDate: new Date("2026-08-25"), amount: 32, status: BillStatus.PAID, paidAt: new Date("2026-08-11") } },
    },
  });

  // Villa 12
  await prisma.bill.create({
    data: {
      propertyId: villa.id,
      type: "Management Fee",
      provider: "JMB",
      schedule: "Quarterly",
      amountType: "Fixed",
      fixedAmount: 650,
      year: 2026,
      dueDates: JSON.stringify(["2026-01-10", "2026-04-10", "2026-07-10", "2026-10-10"]),
      remarks: "JMB management fee — payable at the start of each quarter.",
      payments: { create: { cycle: "Q3 2026", dueDate: new Date("2026-07-10"), amount: 650, status: BillStatus.UNPAID } },
    },
  });
  await prisma.bill.create({
    data: {
      propertyId: villa.id,
      type: "Electricity",
      provider: "TNB",
      schedule: "Monthly",
      amountType: "Variable",
      year: 2026,
      dueDates: JSON.stringify(["2026-08-15"]),
      payments: { create: { cycle, dueDate: new Date("2026-08-15"), amount: 0, status: BillStatus.UNPAID } },
    },
  });

  // MK Pines
  await prisma.bill.create({
    data: {
      propertyId: mk.id,
      type: "Electricity",
      provider: "TNB",
      schedule: "Monthly",
      amountType: "Variable",
      year: 2026,
      dueDates: JSON.stringify(["2026-08-15"]),
      payments: { create: { cycle, dueDate: new Date("2026-08-15"), amount: 115, status: BillStatus.PAID, paidAt: new Date("2026-08-09") } },
    },
  });
  await prisma.bill.create({
    data: {
      propertyId: mk.id,
      type: "Management Fee",
      provider: "JMB",
      schedule: "Monthly",
      amountType: "Fixed",
      fixedAmount: 450,
      year: 2026,
      dueDates: JSON.stringify(["2026-08-10"]),
      payments: { create: { cycle, dueDate: new Date("2026-08-10"), amount: 450, status: BillStatus.PAID, paidAt: new Date("2026-08-08") } },
    },
  });

  // ── Expenses (Tax 2023) ──────────────────────────────────────────────────
  await prisma.expense.createMany({
    data: [
      { propertyId: apt.id, category: "Maintenance", description: "Annual maintenance & management fees", amount: 1200, incurredAt: new Date("2023-06-15") },
      { propertyId: apt.id, category: "Repairs", description: "Bathroom retiling & repaint", amount: 3500, incurredAt: new Date("2023-03-20") },
      { propertyId: apt.id, category: "Sewerage", description: "Indah Water (2023)", amount: 96, incurredAt: new Date("2023-12-01") },
      { propertyId: mk.id, category: "Maintenance", description: "Maintenance & management fees", amount: 2000, incurredAt: new Date("2023-09-10") },
      { propertyId: mk.id, category: "Sewerage", description: "Indah Water (2023)", amount: 96, incurredAt: new Date("2023-12-01") },
      { propertyId: villa.id, category: "Maintenance", description: "Annual maintenance & management fees", amount: 4000, incurredAt: new Date("2023-05-10") },
      { propertyId: villa.id, category: "Sewerage", description: "Indah Water (2023)", amount: 96, incurredAt: new Date("2023-12-01") },
      // Current-year (2026) expenses for the dashboard snapshot
      { propertyId: villa.id, category: "Repairs", description: "Emergency plumbing repair", amount: 850, incurredAt: new Date("2026-08-02") },
      { propertyId: apt.id, category: "Maintenance", description: "Air-conditioner servicing", amount: 300, incurredAt: new Date("2026-08-05") },
    ],
  });

  // ── Annual income (Tax year 2023) ──────────────────────────────────────
  await prisma.annualIncome.createMany({
    data: [
      { propertyId: apt.id, year: 2023, grossAmount: 18000 },
      { propertyId: mk.id, year: 2023, grossAmount: 20000 },
      { propertyId: villa.id, year: 2023, grossAmount: 38400 },
    ],
  });

  // ── Documents ────────────────────────────────────────────────────────────
  await prisma.document.createMany({
    data: [
      { propertyId: apt.id, tenantId: sarah.id, category: "Lease Agreement", title: "Tenancy Agreement — Apt 4B (Sarah Ahmad)", isStamped: true, year: 2025 },
      { propertyId: villa.id, tenantId: rajesh.id, category: "Lease Agreement", title: "Tenancy Agreement — Villa 12 (Rajesh Kumar)", isStamped: true, year: 2025 },
      { propertyId: apt.id, category: "Insurance", title: "Fire Insurance Policy — Apt 4B", year: 2026 },
      { propertyId: mk.id, category: "Title", title: "Strata Title — Unit 2A, MK Pines", year: 2026 },
      { propertyId: apt.id, category: "Receipt", title: "TNB Receipt — Jul 2026", year: 2026 },
    ],
  });

  // ── Audit log ────────────────────────────────────────────────────────────
  await prisma.auditLog.createMany({
    data: [
      { entityType: "Lease", entityId: apt.id, action: "STAMPED", description: "Tenancy agreement stamped with LHDN (ref LHDN-2025-88321)." },
      { entityType: "Bill", entityId: aptElectricity.id, action: "CREATED", description: "Recurring Electricity (TNB) bill configured for Apt 4B." },
      { entityType: "RentPayment", action: "COLLECTED", description: "Jul 2026 rent of RM 1,500 collected for Apt 4B." },
      { entityType: "RentPayment", action: "ARREARS", description: "Aug 2026 rent of RM 3,200 overdue for Villa 12." },
    ],
  });

  // ── WhatsApp AI agent config ─────────────────────────────────────────────
  await prisma.aiAgentConfig.create({
    data: {
      id: "default",
      enabled: true,
      provider: "mock",
      model: "gpt-4o-mini",
      systemPrompt:
        "You are the AI assistant for a property management office. You handle rent reminders, maintenance triage, and viewing scheduling on WhatsApp. Be polite, concise, and factual. Never promise anything you cannot verify in the CRM ledger. Escalate legal matters to the property manager.",
      greeting: "Hi, this is the property management office. How can I help you today?",
      escalationEmail: "john@propai.my",
      autonomyLevel: "semi",
      autoRentReminder: true,
      autoMaintenanceTriage: true,
      autoViewingSchedule: true,
      tenantNames: "Sarah Ahmad,Rajesh Kumar",
    },
  });

  console.log("Seed complete. Manager:", manager.name, "| Properties:", 3, "| AI agent enabled.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
