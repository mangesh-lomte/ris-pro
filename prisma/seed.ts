import { PrismaClient, UserRole, Gender, AppointmentStatus, OrderStatus, StudyStatus, PacsStatus, ReportStatus, Priority, ModalityType, InvoiceStatus, PaymentStatus, PaymentMethod, EquipmentStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting RIS Database Seed...');

  // 1. Clean existing records (in reverse relation order)
  await prisma.auditLog.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.report.deleteMany();
  await prisma.study.deleteMany();
  await prisma.imagingOrder.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.equipment.deleteMany();
  await prisma.user.deleteMany();

  console.log('🧹 Cleaned existing database records.');

  // 2. Seed Users across all 4 required roles
  const passwordHash = await bcrypt.hash('Demo@123', 10);

  const adminUser = await prisma.user.create({
    data: {
      firstName: 'Arthur',
      lastName: 'Evans',
      email: 'admin@ris.local',
      passwordHash,
      role: UserRole.ADMIN,
      isActive: true,
    },
  });

  const receptionUser = await prisma.user.create({
    data: {
      firstName: 'Sarah',
      lastName: 'Jenkins',
      email: 'reception@ris.local',
      passwordHash,
      role: UserRole.RECEPTION,
      isActive: true,
    },
  });

  const techUser = await prisma.user.create({
    data: {
      firstName: 'Marcus',
      lastName: 'Vance',
      email: 'tech@ris.local',
      passwordHash,
      role: UserRole.TECHNOLOGIST,
      isActive: true,
    },
  });

  const radUser = await prisma.user.create({
    data: {
      firstName: 'Elena',
      lastName: 'Rostova',
      email: 'rad@ris.local',
      passwordHash,
      role: UserRole.RADIOLOGIST,
      isActive: true,
    },
  });

  console.log('✅ Created 4 Seed Users (ADMIN, RECEPTION, TECHNOLOGIST, RADIOLOGIST)');

  // 3. Seed Equipment
  const ctScanner = await prisma.equipment.create({
    data: {
      name: 'GE Revolution CT 128-Slice',
      modality: ModalityType.CT,
      manufacturer: 'GE Healthcare',
      model: 'Revolution EVO',
      serialNumber: 'CT-EVO-89211',
      status: EquipmentStatus.OPERATIONAL,
      location: 'Ground Floor, Suite CT-01',
      lastMaintenanceDate: new Date('2026-10-01'),
      nextMaintenanceDate: new Date('2027-04-01'),
    },
  });

  await prisma.equipment.create({
    data: {
      name: 'Siemens Magnetom 1.5T Aera',
      modality: ModalityType.MRI,
      manufacturer: 'Siemens Healthineers',
      model: 'Magnetom Aera 1.5T',
      serialNumber: 'MR-AERA-44219',
      status: EquipmentStatus.OPERATIONAL,
      location: 'Ground Floor, Suite MRI-01',
      lastMaintenanceDate: new Date('2026-09-15'),
      nextMaintenanceDate: new Date('2027-03-15'),
    },
  });

  await prisma.equipment.create({
    data: {
      name: 'Canon CXDI Digital Radiography Suite',
      modality: ModalityType.XRAY,
      manufacturer: 'Canon Medical Systems',
      model: 'CXDI-Elite',
      serialNumber: 'XR-ELITE-10822',
      status: EquipmentStatus.OPERATIONAL,
      location: 'First Floor, Room XRAY-01',
      lastMaintenanceDate: new Date('2026-10-10'),
      nextMaintenanceDate: new Date('2027-01-10'),
    },
  });

  console.log('✅ Created 3 Equipment Scanners (CT, MRI, X-Ray)');

  // 4. Seed Inventory Items
  await prisma.inventoryItem.createMany({
    data: [
      {
        name: 'Omnipaque 350 mg I/mL (100 mL)',
        category: 'Contrast Media',
        sku: 'INV-CONTRAST-OMNI350',
        quantity: 45,
        reorderLevel: 15,
        batchNumber: 'OMN-2026-44B',
        lotNumber: 'LOT-9921',
        expiryDate: new Date('2028-06-30'),
        unitPrice: 42.50,
      },
      {
        name: 'Gadovist 1.0 mmol/mL (15 mL prefilled syringe)',
        category: 'MRI Contrast',
        sku: 'INV-CONTRAST-GADO15',
        quantity: 30,
        reorderLevel: 10,
        batchNumber: 'GAD-2026-12A',
        lotNumber: 'LOT-3381',
        expiryDate: new Date('2027-12-31'),
        unitPrice: 65.00,
      },
      {
        name: 'BD Nexiva Closed IV Catheter System 20G',
        category: 'Consumables',
        sku: 'INV-CATH-20G',
        quantity: 180,
        reorderLevel: 50,
        batchNumber: 'BD-2026-90',
        lotNumber: 'LOT-4412',
        expiryDate: new Date('2029-01-01'),
        unitPrice: 3.20,
      },
    ],
  });

  console.log('✅ Created 3 Inventory Items');

  // 5. Seed Patients (Persistent Patient IDs!)
  const patient1 = await prisma.patient.create({
    data: {
      patientId: 'PAT-2026-10001',
      firstName: 'Jonathan',
      lastName: 'Miller',
      dateOfBirth: new Date('1978-04-12'),
      gender: Gender.MALE,
      phone: '+1-555-019-2831',
      email: 'j.miller@example.com',
      address: '742 Evergreen Terrace, Springfield, IL',
      emergencyContact: 'Karen Miller (Spouse) - +1-555-019-2832',
    },
  });

  const patient2 = await prisma.patient.create({
    data: {
      patientId: 'PAT-2026-10002',
      firstName: 'Margaret',
      lastName: 'Chen',
      dateOfBirth: new Date('1985-09-24'),
      gender: Gender.FEMALE,
      phone: '+1-555-014-9920',
      email: 'm.chen@example.com',
      address: '1204 Pine Hollow Road, Oakville, IL',
      emergencyContact: 'David Chen (Brother) - +1-555-014-9921',
    },
  });

  const patient3 = await prisma.patient.create({
    data: {
      patientId: 'PAT-2026-10003',
      firstName: 'Robert',
      lastName: 'Davis',
      dateOfBirth: new Date('1962-11-03'),
      gender: Gender.MALE,
      phone: '+1-555-017-4412',
      email: 'robert.davis@example.com',
      address: '45 Lake Shore Blvd, Chicago, IL',
      emergencyContact: 'Susan Davis (Daughter) - +1-555-017-4413',
    },
  });

  console.log('✅ Created 3 Patients with Persistent Patient IDs (PAT-2026-XXXXX)');

  // 6. Seed Appointments & Imaging Orders (Persistent Accession Numbers!)
  // Order 1: CT Chest for Patient 1
  const appointment1 = await prisma.appointment.create({
    data: {
      appointmentNumber: 'APT-2026-1001',
      patientId: patient1.id,
      examination: 'CT Chest with IV Contrast (Rule out PE)',
      modality: ModalityType.CT,
      scheduledStartTime: new Date(Date.now() - 3600 * 1000 * 2), // 2 hours ago
      scheduledEndTime: new Date(Date.now() - 3600 * 1000 * 1.5),
      status: AppointmentStatus.COMPLETED,
      priority: Priority.URGENT,
      location: ctScanner.location,
      notes: 'Patient fasts 4 hours prior. Verify eGFR.',
    },
  });

  const order1 = await prisma.imagingOrder.create({
    data: {
      accessionNumber: 'ACC-20261105-CT01',
      patientId: patient1.id,
      appointmentId: appointment1.id,
      modality: ModalityType.CT,
      bodyPart: 'Chest',
      clinicalIndication: 'Acute shortness of breath, pleuritic chest pain; rule out pulmonary embolism.',
      referringDoctor: 'Dr. Gregory House, MD (Pulmonology)',
      contrastRequirement: true,
      priority: Priority.URGENT,
      orderStatus: OrderStatus.COMPLETED,
    },
  });

  // Study 1 (Sent to PACS and Reported)
  const study1 = await prisma.study.create({
    data: {
      studyInstanceUid: '2.25.10928374910293847192837410293847',
      accessionNumber: order1.accessionNumber,
      orderId: order1.id,
      patientId: patient1.id,
      modality: ModalityType.CT,
      studyStatus: StudyStatus.REPORTED,
      pacsStatus: PacsStatus.SENT,
      seriesCount: 4,
      instanceCount: 382,
      startedAt: new Date(Date.now() - 3600 * 1000 * 1.8),
      completedAt: new Date(Date.now() - 3600 * 1000 * 1.5),
    },
  });

  // Report 1 (Finalized by Radiologist)
  await prisma.report.create({
    data: {
      studyId: study1.id,
      orderId: order1.id,
      radiologistId: radUser.id,
      status: ReportStatus.FINAL,
      draftContent: 'Diagnostic evaluation of pulmonary vascular tree.',
      findings: 'CT ANGIOGRAPHY OF THE CHEST WITH IV CONTRAST:\n\n1. Pulmonary Arteries: Adequate contrast opacification throughout the main pulmonary trunk and main pulmonary branches. No filling defect detected in the main, lobar, segmental, or subsegmental pulmonary arteries.\n2. Lungs & Pleura: Lungs are clear without focal consolidation, pneumothorax, or pleural effusion.\n3. Mediastinum & Heart: Normal heart size. No mediastinal or hilar lymphadenopathy.',
      impression: '1. Negative for acute pulmonary embolism.\n2. Clear lungs bilaterally with no active parenchymal disease.',
      finalizedAt: new Date(Date.now() - 3600 * 1000 * 0.5),
      version: 1,
    },
  });

  // Invoice 1 for Order 1
  const invoice1 = await prisma.invoice.create({
    data: {
      invoiceNumber: 'INV-2026-1001',
      patientId: patient1.id,
      orderId: order1.id,
      total: 650.00,
      discount: 50.00,
      paidAmount: 600.00,
      outstandingAmount: 0.00,
      status: InvoiceStatus.PAID,
    },
  });

  await prisma.payment.create({
    data: {
      invoiceId: invoice1.id,
      amount: 600.00,
      paymentMethod: PaymentMethod.CREDIT_CARD,
      reference: 'TXN-VISA-98214',
      paymentStatus: PaymentStatus.COMPLETED,
    },
  });

  // Order 2: MRI Brain for Patient 2 (In Progress / Ready for Reporting)
  const appointment2 = await prisma.appointment.create({
    data: {
      appointmentNumber: 'APT-2026-1002',
      patientId: patient2.id,
      examination: 'MRI Brain with and without Contrast',
      modality: ModalityType.MRI,
      scheduledStartTime: new Date(Date.now() - 3600 * 1000 * 1),
      scheduledEndTime: new Date(Date.now() + 3600 * 1000 * 0.5),
      status: AppointmentStatus.ARRIVED,
      priority: Priority.ROUTINE,
      location: 'Ground Floor, Suite MRI-01',
      notes: 'Patient verified MRI compatible. Metal screening negative.',
    },
  });

  const order2 = await prisma.imagingOrder.create({
    data: {
      accessionNumber: 'ACC-20261105-MR02',
      patientId: patient2.id,
      appointmentId: appointment2.id,
      modality: ModalityType.MRI,
      bodyPart: 'Brain',
      clinicalIndication: 'Chronic refractory migraine headaches, visual aura, rule out intracranial lesion.',
      referringDoctor: 'Dr. James Wilson, MD (Neurology)',
      contrastRequirement: true,
      priority: Priority.ROUTINE,
      orderStatus: OrderStatus.IN_PROGRESS,
    },
  });

  const study2 = await prisma.study.create({
    data: {
      studyInstanceUid: '2.25.99182374619283746192837418273641',
      accessionNumber: order2.accessionNumber,
      orderId: order2.id,
      patientId: patient2.id,
      modality: ModalityType.MRI,
      studyStatus: StudyStatus.READY_FOR_REPORTING,
      pacsStatus: PacsStatus.SENT,
      seriesCount: 6,
      instanceCount: 520,
      startedAt: new Date(Date.now() - 3600 * 1000 * 0.8),
      completedAt: new Date(Date.now() - 3600 * 1000 * 0.2),
    },
  });

  await prisma.report.create({
    data: {
      studyId: study2.id,
      orderId: order2.id,
      radiologistId: radUser.id,
      status: ReportStatus.DRAFT,
      draftContent: 'Axial T1, T2, FLAIR, DWI, and Post-contrast T1 sequences acquired. Initial review demonstrates symmetric ventricles.',
      findings: null,
      impression: null,
      version: 1,
    },
  });

  // Order 3: STAT X-Ray for Patient 3 (Arrived / Scheduled)
  const appointment3 = await prisma.appointment.create({
    data: {
      appointmentNumber: 'APT-2026-1003',
      patientId: patient3.id,
      examination: 'X-Ray Chest PA & Lateral',
      modality: ModalityType.XRAY,
      scheduledStartTime: new Date(Date.now() + 3600 * 1000 * 0.5),
      scheduledEndTime: new Date(Date.now() + 3600 * 1000 * 1),
      status: AppointmentStatus.SCHEDULED,
      priority: Priority.STAT,
      location: 'First Floor, Room XRAY-01',
      notes: 'Emergency Room referral. Wheelchair transport required.',
    },
  });

  await prisma.imagingOrder.create({
    data: {
      accessionNumber: 'ACC-20261105-XR03',
      patientId: patient3.id,
      appointmentId: appointment3.id,
      modality: ModalityType.XRAY,
      bodyPart: 'Chest',
      clinicalIndication: 'STAT: Post-fall evaluation, left lower rib pain, rule out pneumothorax.',
      referringDoctor: 'Dr. Lisa Cuddy, MD (Emergency Medicine)',
      contrastRequirement: false,
      priority: Priority.STAT,
      orderStatus: OrderStatus.SCHEDULED,
    },
  });

  console.log('✅ Created 3 Orders with Accession Numbers (ACC-20261105-XXXX)');

  // 7. Seed Initial Audit Logs
  await prisma.auditLog.createMany({
    data: [
      {
        userId: adminUser.id,
        action: 'SYSTEM_INITIALIZATION',
        entityType: 'System',
        entityId: 'RIS-CORE-V1',
        details: { phase: 'PHASE_1', env: 'development', message: 'System database successfully initialized' },
        ipAddress: '127.0.0.1',
        userAgent: 'RIS-System-Seeder/1.0',
      },
      {
        userId: receptionUser.id,
        action: 'PATIENT_REGISTERED',
        entityType: 'Patient',
        entityId: patient1.patientId,
        details: { name: `${patient1.firstName} ${patient1.lastName}`, mrn: patient1.patientId },
        ipAddress: '192.168.1.101',
      },
      {
        userId: receptionUser.id,
        action: 'ORDER_CREATED',
        entityType: 'ImagingOrder',
        entityId: order1.accessionNumber,
        details: { modality: order1.modality, priority: order1.priority, accessionNumber: order1.accessionNumber },
        ipAddress: '192.168.1.101',
      },
      {
        userId: techUser.id,
        action: 'STUDY_ACQUIRED',
        entityType: 'Study',
        entityId: study1.id,
        details: { accessionNumber: study1.accessionNumber, instances: study1.instanceCount },
        ipAddress: '192.168.1.102',
      },
      {
        userId: radUser.id,
        action: 'REPORT_FINALIZED',
        entityType: 'Report',
        entityId: order1.accessionNumber,
        details: { accessionNumber: order1.accessionNumber, status: 'FINAL' },
        ipAddress: '192.168.1.103',
      },
    ],
  });

  console.log('✅ Created Initial Audit Log Entries');
  console.log('✨ Database Seeding Completed Successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
