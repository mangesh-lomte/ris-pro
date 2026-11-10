import {
  PrismaClient,
  UserRole,
  Gender,
  AppointmentStatus,
  OrderStatus,
  StudyStatus,
  PacsStatus,
  ReportStatus,
  Priority,
  ModalityType,
  InvoiceStatus,
  PaymentStatus,
  PaymentMethod,
  EquipmentStatus,
  AuthorizationStatus,
  PayerType,
  SafetyStatus,
  PreparationStatus,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting RIS Phase 2 Comprehensive Database Seed...');

  // 1. Clean existing records in reverse relation order
  await prisma.auditLog.deleteMany();
  await prisma.pacsStudyLink.deleteMany();
  await prisma.pacsHandoffAttempt.deleteMany();
  await prisma.pacsHandoff.deleteMany();
  await prisma.imageQualityReview.deleteMany();
  await prisma.technologistIncident.deleteMany();
  await prisma.contrastAdministration.deleteMany();
  await prisma.scanLifecycleEvent.deleteMany();
  await prisma.scanLifecycle.deleteMany();
  await prisma.technologistPreparation.deleteMany();
  await prisma.technologistSafetyScreening.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.report.deleteMany();
  await prisma.study.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.imagingOrder.deleteMany();
  await prisma.imagingProtocol.deleteMany();
  await prisma.examDefinition.deleteMany();
  await prisma.referringDoctor.deleteMany();
  await prisma.equipment.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.patient.deleteMany();
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

  const radUser2 = await prisma.user.create({
    data: {
      firstName: 'Marcus',
      lastName: 'Sterling',
      email: 'rad2@ris.local',
      passwordHash,
      role: UserRole.RADIOLOGIST,
      isActive: true,
    },
  });

  // Additional realistic clinical enterprise staff
  await prisma.user.create({
    data: {
      firstName: 'Robert',
      lastName: 'Thorne',
      email: 'robert.thorne@ris.local',
      passwordHash,
      role: UserRole.ADMIN,
      isActive: true,
    },
  });

  await prisma.user.create({
    data: {
      firstName: 'Michael',
      lastName: 'Chang',
      email: 'michael.chang@ris.local',
      role: UserRole.RECEPTION,
      passwordHash,
      isActive: true,
    },
  });

  await prisma.user.create({
    data: {
      firstName: 'Anita',
      lastName: 'Rao',
      email: 'anita.rao@ris.local',
      role: UserRole.RECEPTION,
      passwordHash,
      isActive: true,
    },
  });

  await prisma.user.create({
    data: {
      firstName: 'Priya',
      lastName: 'Shah',
      email: 'priya.shah@ris.local',
      role: UserRole.TECHNOLOGIST,
      passwordHash,
      isActive: true,
    },
  });

  await prisma.user.create({
    data: {
      firstName: 'David',
      lastName: 'Kim',
      email: 'david.kim@ris.local',
      role: UserRole.TECHNOLOGIST,
      passwordHash,
      isActive: true,
    },
  });

  await prisma.user.create({
    data: {
      firstName: 'Daniel',
      lastName: 'Brooks',
      email: 'daniel.brooks@ris.local',
      role: UserRole.RADIOLOGIST,
      passwordHash,
      isActive: true,
    },
  });

  await prisma.user.create({
    data: {
      firstName: 'James',
      lastName: 'Patel',
      email: 'james.patel@ris.local',
      role: UserRole.RADIOLOGIST,
      passwordHash,
      isActive: true,
    },
  });

  await prisma.user.create({
    data: {
      firstName: 'Sarah',
      lastName: 'Mitchell',
      email: 'clinician@ris.local',
      role: UserRole.RADIOLOGIST,
      passwordHash,
      isActive: true,
    },
  });

  console.log('✅ Created Curated Enterprise Staff (2 Admins, 3 Reception, 3 Technologists, 5 Radiologists)');

  // 3. Seed Referring Doctors
  const docMitchell = await prisma.referringDoctor.create({
    data: {
      name: 'Dr. Sarah Mitchell, MD',
      organization: 'Department of Internal Medicine, Metro Health',
      phone: '+1-555-234-5678',
      email: 's.mitchell@metrohealth.org',
      registrationNumber: 'MED-REG-88219',
      isActive: true,
    },
  });

  const docHouse = await prisma.referringDoctor.create({
    data: {
      name: 'Dr. Gregory House, MD',
      organization: 'Diagnostic Medicine, Princeton Hospital',
      phone: '+1-555-876-5432',
      email: 'g.house@princeton.edu',
      registrationNumber: 'MED-REG-99014',
      isActive: true,
    },
  });

  const docWilson = await prisma.referringDoctor.create({
    data: {
      name: 'Dr. James Wilson, MD',
      organization: 'Department of Oncology, Princeton Hospital',
      phone: '+1-555-345-6789',
      email: 'j.wilson@princeton.edu',
      registrationNumber: 'MED-REG-44120',
      isActive: true,
    },
  });

  const docCuddy = await prisma.referringDoctor.create({
    data: {
      name: 'Dr. Lisa Cuddy, MD',
      organization: 'Endocrinology & Emergency Clinic',
      phone: '+1-555-456-7890',
      email: 'l.cuddy@princeton.edu',
      registrationNumber: 'MED-REG-10294',
      isActive: true,
    },
  });

  const docChase = await prisma.referringDoctor.create({
    data: {
      name: 'Dr. Robert Chase, MD',
      organization: 'Cardiothoracic Surgery, Metro Health',
      phone: '+1-555-567-8901',
      email: 'r.chase@metrohealth.org',
      registrationNumber: 'MED-REG-55192',
      isActive: true,
    },
  });

  console.log('✅ Created 5 Referring Doctors');

  // 4. Seed Exam Definitions (duration rules & preparation requirements)
  const examCtHead = await prisma.examDefinition.create({
    data: {
      code: 'CT-HEAD',
      name: 'CT Head / Brain without IV Contrast',
      modality: ModalityType.CT,
      bodyPart: 'Head/Brain',
      defaultDurationMinutes: 20,
      bufferMinutes: 5,
      contrastSupported: false,
      fastingRequired: false,
      ivRequired: false,
      consentRequired: false,
      contrastPreparationRequired: false,
      isActive: true,
    },
  });

  const examCtChest = await prisma.examDefinition.create({
    data: {
      code: 'CT-CHEST',
      name: 'CT Chest Angiography with IV Contrast (PE Protocol)',
      modality: ModalityType.CT,
      bodyPart: 'Chest',
      defaultDurationMinutes: 30,
      bufferMinutes: 10,
      contrastSupported: true,
      fastingRequired: false,
      ivRequired: true,
      consentRequired: true,
      contrastPreparationRequired: true,
      additionalPreparationInstructions: 'Peripheral 18-20 gauge IV access in antecubital fossa required for high-flow power injection.',
      isActive: true,
    },
  });

  const examMriBrain = await prisma.examDefinition.create({
    data: {
      code: 'MRI-BRAIN',
      name: 'MRI Brain with and without IV Contrast',
      modality: ModalityType.MRI,
      bodyPart: 'Brain',
      defaultDurationMinutes: 45,
      bufferMinutes: 10,
      contrastSupported: true,
      fastingRequired: false,
      ivRequired: true,
      consentRequired: true,
      contrastPreparationRequired: true,
      additionalPreparationInstructions: 'Remove all metallic jewelry, piercings, hairpins, and removable dental appliances before entering Zone IV.',
      isActive: true,
    },
  });

  const examMriKnee = await prisma.examDefinition.create({
    data: {
      code: 'MRI-KNEE',
      name: 'MRI Right Knee Non-Contrast Multi-Planar',
      modality: ModalityType.MRI,
      bodyPart: 'Knee',
      defaultDurationMinutes: 30,
      bufferMinutes: 5,
      contrastSupported: false,
      fastingRequired: false,
      ivRequired: false,
      consentRequired: false,
      contrastPreparationRequired: false,
      additionalPreparationInstructions: 'Patient changed into hospital gown with zero ferromagnetic components.',
      isActive: true,
    },
  });

  const examXrChest = await prisma.examDefinition.create({
    data: {
      code: 'XR-CHEST',
      name: 'X-Ray Chest Posteroanterior (PA) & Lateral',
      modality: ModalityType.XRAY,
      bodyPart: 'Chest',
      defaultDurationMinutes: 15,
      bufferMinutes: 5,
      contrastSupported: false,
      fastingRequired: false,
      ivRequired: false,
      consentRequired: false,
      contrastPreparationRequired: false,
      isActive: true,
    },
  });

  const examXrKnee = await prisma.examDefinition.create({
    data: {
      code: 'XR-KNEE',
      name: 'X-Ray Right Knee 3-Views Standing',
      modality: ModalityType.XRAY,
      bodyPart: 'Knee',
      defaultDurationMinutes: 15,
      bufferMinutes: 5,
      contrastSupported: false,
      fastingRequired: false,
      ivRequired: false,
      consentRequired: false,
      contrastPreparationRequired: false,
      isActive: true,
    },
  });

  console.log('✅ Created 6 Exam Definitions with standard duration and preparation rules');

  // 4b. Seed Approved Workflow Protocols
  const protocolMriBrain = await prisma.imagingProtocol.create({
    data: {
      code: 'MRI-BRAIN-ROUTINE',
      name: 'MRI Brain Routine Multi-Planar',
      modality: ModalityType.MRI,
      bodyPart: 'Brain',
      examDefinitionId: examMriBrain.id,
      description: 'Standard multi-planar brain diagnostic protocol (T1, T2, FLAIR, DWI/ADC) with post-gadolinium sequences.',
      isActive: true,
    },
  });

  await prisma.imagingProtocol.create({
    data: {
      code: 'MRI-KNEE-ROUTINE',
      name: 'MRI Knee Routine Non-Contrast',
      modality: ModalityType.MRI,
      bodyPart: 'Knee',
      examDefinitionId: examMriKnee.id,
      description: 'Standard 3-plane knee joint evaluation (Sagittal PD/T2, Coronal PD/T2, Axial PD) without contrast.',
      isActive: true,
    },
  });

  await prisma.imagingProtocol.create({
    data: {
      code: 'CT-HEAD-NONCONTRAST',
      name: 'CT Head Routine Non-Contrast',
      modality: ModalityType.CT,
      bodyPart: 'Head/Brain',
      examDefinitionId: examCtHead.id,
      description: 'High-resolution non-contrast volumetric CT head for acute intracranial pathology.',
      isActive: true,
    },
  });

  const protocolCtChest = await prisma.imagingProtocol.create({
    data: {
      code: 'CT-CHEST-CONTRAST',
      name: 'CT Chest PE Protocol with Contrast',
      modality: ModalityType.CT,
      bodyPart: 'Chest',
      examDefinitionId: examCtChest.id,
      description: 'Bolus-triggered pulmonary arterial angiogram for thromboembolic disease evaluation.',
      isActive: true,
    },
  });

  const protocolXrChest = await prisma.imagingProtocol.create({
    data: {
      code: 'XR-CHEST-PA',
      name: 'X-Ray Chest PA & Lateral',
      modality: ModalityType.XRAY,
      bodyPart: 'Chest',
      examDefinitionId: examXrChest.id,
      description: 'Standard upright PA and lateral diagnostic chest views.',
      isActive: true,
    },
  });

  await prisma.imagingProtocol.create({
    data: {
      code: 'XR-KNEE-2VIEW',
      name: 'X-Ray Knee 2-View Standing',
      modality: ModalityType.XRAY,
      bodyPart: 'Knee',
      examDefinitionId: examXrKnee.id,
      description: 'Weight-bearing anteroposterior and horizontal lateral radiographs.',
      isActive: true,
    },
  });

  await prisma.imagingProtocol.create({
    data: {
      code: 'CT-HEAD-DEPRECATED',
      name: 'CT Head Historical Protocol (Deprecated)',
      modality: ModalityType.CT,
      bodyPart: 'Head/Brain',
      examDefinitionId: examCtHead.id,
      description: 'Archived legacy protocol for negative compatibility testing.',
      isActive: false, // Inactive
    },
  });

  console.log('✅ Created 7 Approved Imaging Protocols (Active + Inactive)');

  // 5. Seed Equipment (CT, MRI, X-Ray)
  const ctScanner = await prisma.equipment.create({
    data: {
      name: 'GE Revolution CT 128-Slice',
      modality: ModalityType.CT,
      manufacturer: 'GE Healthcare',
      model: 'Revolution EVO',
      serialNumber: 'CT-EVO-89211',
      status: EquipmentStatus.AVAILABLE,
      location: 'Ground Floor, Suite CT-01',
      lastMaintenanceDate: new Date('2026-10-01'),
      nextMaintenanceDate: new Date('2027-04-01'),
    },
  });

  const mriScanner = await prisma.equipment.create({
    data: {
      name: 'Siemens Magnetom 1.5T Aera',
      modality: ModalityType.MRI,
      manufacturer: 'Siemens Healthineers',
      model: 'Magnetom Aera 1.5T',
      serialNumber: 'MR-AERA-44219',
      status: EquipmentStatus.AVAILABLE,
      location: 'Ground Floor, Suite MRI-01',
      lastMaintenanceDate: new Date('2026-09-15'),
      nextMaintenanceDate: new Date('2027-03-15'),
    },
  });

  const xrayRoom = await prisma.equipment.create({
    data: {
      name: 'Canon CXDI Digital Radiography Suite',
      modality: ModalityType.XRAY,
      manufacturer: 'Canon Medical Systems',
      model: 'CXDI-Elite',
      serialNumber: 'XR-ELITE-10822',
      status: EquipmentStatus.AVAILABLE,
      location: 'First Floor, Room XRAY-01',
      lastMaintenanceDate: new Date('2026-10-10'),
      nextMaintenanceDate: new Date('2027-01-10'),
    },
  });

  console.log('✅ Created 3 Equipment Scanners (CT, MRI, X-Ray)');

  // 6. Seed Inventory Items
  await prisma.inventoryItem.createMany({
    data: [
      {
        itemCode: 'INV-CON-OMNI350',
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
        itemCode: 'INV-CON-GADO15',
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
        itemCode: 'INV-CSM-IV20G',
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

  // 7. Seed 18 Fictional Patients (Persistent Patient IDs!)
  const patientData = [
    {
      patientId: 'PAT-2026-10001',
      firstName: 'Jonathan',
      middleName: 'Edward',
      lastName: 'Miller',
      dateOfBirth: new Date('1978-04-12'),
      gender: Gender.MALE,
      phone: '+1-555-019-2831',
      alternatePhone: '+1-555-019-2839',
      email: 'j.miller@example.com',
      addressLine1: '742 Evergreen Terrace',
      city: 'Springfield',
      state: 'IL',
      postalCode: '62704',
      emergencyContactName: 'Karen Miller',
      emergencyContactPhone: '+1-555-019-2832',
      emergencyContactRelation: 'Spouse',
      address: '742 Evergreen Terrace, Springfield, IL',
      emergencyContact: 'Karen Miller (Spouse) - +1-555-019-2832',
    },
    {
      patientId: 'PAT-2026-10002',
      firstName: 'Margaret',
      middleName: 'Lin',
      lastName: 'Chen',
      dateOfBirth: new Date('1985-09-24'),
      gender: Gender.FEMALE,
      phone: '+1-555-014-9920',
      email: 'm.chen@example.com',
      addressLine1: '1204 Pine Hollow Road',
      city: 'Oakville',
      state: 'IL',
      postalCode: '60010',
      emergencyContactName: 'David Chen',
      emergencyContactPhone: '+1-555-014-9921',
      emergencyContactRelation: 'Brother',
      address: '1204 Pine Hollow Road, Oakville, IL',
      emergencyContact: 'David Chen (Brother) - +1-555-014-9921',
    },
    {
      patientId: 'PAT-2026-10003',
      firstName: 'Robert',
      middleName: 'Francis',
      lastName: 'Davis',
      dateOfBirth: new Date('1962-11-03'),
      gender: Gender.MALE,
      phone: '+1-555-017-4412',
      email: 'robert.davis@example.com',
      addressLine1: '45 Lake Shore Blvd',
      city: 'Chicago',
      state: 'IL',
      postalCode: '60611',
      emergencyContactName: 'Susan Davis',
      emergencyContactPhone: '+1-555-017-4413',
      emergencyContactRelation: 'Daughter',
      address: '45 Lake Shore Blvd, Chicago, IL',
      emergencyContact: 'Susan Davis (Daughter) - +1-555-017-4413',
    },
    {
      patientId: 'PAT-2026-10004',
      firstName: 'Aarav',
      middleName: 'Raj',
      lastName: 'Shah',
      dateOfBirth: new Date('1987-08-22'),
      gender: Gender.MALE,
      phone: '+1-555-018-7744',
      email: 'aarav.shah@example.com',
      addressLine1: '88 Michigan Avenue Apt 4B',
      city: 'Chicago',
      state: 'IL',
      postalCode: '60603',
      emergencyContactName: 'Pooja Shah',
      emergencyContactPhone: '+1-555-018-7745',
      emergencyContactRelation: 'Spouse',
      address: '88 Michigan Avenue Apt 4B, Chicago, IL',
      emergencyContact: 'Pooja Shah (Spouse) - +1-555-018-7745',
    },
    {
      patientId: 'PAT-2026-10005',
      firstName: 'Emily',
      middleName: 'Grace',
      lastName: 'Watson',
      dateOfBirth: new Date('1994-02-14'),
      gender: Gender.FEMALE,
      phone: '+1-555-013-6621',
      email: 'emily.w@example.com',
      addressLine1: '312 Elm Street',
      city: 'Naperville',
      state: 'IL',
      postalCode: '60540',
      emergencyContactName: 'James Watson',
      emergencyContactPhone: '+1-555-013-6622',
      emergencyContactRelation: 'Father',
      address: '312 Elm Street, Naperville, IL',
      emergencyContact: 'James Watson (Father) - +1-555-013-6622',
    },
    {
      patientId: 'PAT-2026-10006',
      firstName: 'Carlos',
      middleName: 'Mateo',
      lastName: 'Rodriguez',
      dateOfBirth: new Date('1973-07-30'),
      gender: Gender.MALE,
      phone: '+1-555-012-9988',
      email: 'carlos.r@example.com',
      addressLine1: '540 Prairie View Court',
      city: 'Aurora',
      state: 'IL',
      postalCode: '60505',
      emergencyContactName: 'Elena Rodriguez',
      emergencyContactPhone: '+1-555-012-9989',
      emergencyContactRelation: 'Spouse',
      address: '540 Prairie View Court, Aurora, IL',
      emergencyContact: 'Elena Rodriguez (Spouse) - +1-555-012-9989',
    },
    {
      patientId: 'PAT-2026-10007',
      firstName: 'Hannah',
      middleName: 'Marie',
      lastName: 'Schmidt',
      dateOfBirth: new Date('2001-12-05'),
      gender: Gender.FEMALE,
      phone: '+1-555-011-4433',
      email: 'hannah.schmidt@example.com',
      addressLine1: '1802 Maple Avenue',
      city: 'Evanston',
      state: 'IL',
      postalCode: '60201',
      emergencyContactName: 'Clara Schmidt',
      emergencyContactPhone: '+1-555-011-4434',
      emergencyContactRelation: 'Mother',
      address: '1802 Maple Avenue, Evanston, IL',
      emergencyContact: 'Clara Schmidt (Mother) - +1-555-011-4434',
    },
    {
      patientId: 'PAT-2026-10008',
      firstName: 'Marcus',
      middleName: 'Anthony',
      lastName: 'Johnson',
      dateOfBirth: new Date('1955-05-18'),
      gender: Gender.MALE,
      phone: '+1-555-016-8822',
      email: 'marcus.j@example.com',
      addressLine1: '900 South Wood Street',
      city: 'Chicago',
      state: 'IL',
      postalCode: '60612',
      emergencyContactName: 'Tyrone Johnson',
      emergencyContactPhone: '+1-555-016-8823',
      emergencyContactRelation: 'Son',
      address: '900 South Wood Street, Chicago, IL',
      emergencyContact: 'Tyrone Johnson (Son) - +1-555-016-8823',
    },
    {
      patientId: 'PAT-2026-10009',
      firstName: 'Priya',
      middleName: 'Lakshmi',
      lastName: 'Patel',
      dateOfBirth: new Date('1990-10-10'),
      gender: Gender.FEMALE,
      phone: '+1-555-015-3311',
      email: 'priya.patel@example.com',
      addressLine1: '77 Heritage Lane',
      city: 'Schaumburg',
      state: 'IL',
      postalCode: '60173',
      emergencyContactName: 'Anil Patel',
      emergencyContactPhone: '+1-555-015-3312',
      emergencyContactRelation: 'Spouse',
      address: '77 Heritage Lane, Schaumburg, IL',
      emergencyContact: 'Anil Patel (Spouse) - +1-555-015-3312',
    },
    {
      patientId: 'PAT-2026-10010',
      firstName: 'Arthur',
      middleName: 'Pendleton',
      lastName: 'Blackwood',
      dateOfBirth: new Date('1948-03-29'),
      gender: Gender.MALE,
      phone: '+1-555-018-2200',
      email: 'arthur.blackwood@example.com',
      addressLine1: '14 Oak Ridge Trail',
      city: 'Lake Forest',
      state: 'IL',
      postalCode: '60045',
      emergencyContactName: 'Eleanor Blackwood',
      emergencyContactPhone: '+1-555-018-2201',
      emergencyContactRelation: 'Spouse',
      address: '14 Oak Ridge Trail, Lake Forest, IL',
      emergencyContact: 'Eleanor Blackwood (Spouse) - +1-555-018-2201',
    },
    {
      patientId: 'PAT-2026-10011',
      firstName: 'Fatima',
      middleName: 'Zahra',
      lastName: 'Al-Mansoor',
      dateOfBirth: new Date('1982-06-15'),
      gender: Gender.FEMALE,
      phone: '+1-555-019-7755',
      email: 'fatima.m@example.com',
      addressLine1: '620 Central Park Ave',
      city: 'Skokie',
      state: 'IL',
      postalCode: '60076',
      emergencyContactName: 'Tariq Al-Mansoor',
      emergencyContactPhone: '+1-555-019-7756',
      emergencyContactRelation: 'Spouse',
      address: '620 Central Park Ave, Skokie, IL',
      emergencyContact: 'Tariq Al-Mansoor (Spouse) - +1-555-019-7756',
    },
    {
      patientId: 'PAT-2026-10012',
      firstName: 'Dmitri',
      middleName: 'Ivanovich',
      lastName: 'Volkov',
      dateOfBirth: new Date('1969-09-08'),
      gender: Gender.MALE,
      phone: '+1-555-014-1199',
      email: 'dmitri.v@example.com',
      addressLine1: '101 Devonshire Drive',
      city: 'Des Plaines',
      state: 'IL',
      postalCode: '60018',
      emergencyContactName: 'Olga Volkova',
      emergencyContactPhone: '+1-555-014-1198',
      emergencyContactRelation: 'Sister',
      address: '101 Devonshire Drive, Des Plaines, IL',
      emergencyContact: 'Olga Volkova (Sister) - +1-555-014-1198',
    },
    {
      patientId: 'PAT-2026-10013',
      firstName: 'Jessica',
      middleName: 'Ann',
      lastName: 'Taylor',
      dateOfBirth: new Date('1996-01-20'),
      gender: Gender.FEMALE,
      phone: '+1-555-017-9911',
      email: 'jessica.t@example.com',
      addressLine1: '404 Wicker Park Blvd',
      city: 'Chicago',
      state: 'IL',
      postalCode: '60622',
      emergencyContactName: 'Brian Taylor',
      emergencyContactPhone: '+1-555-017-9912',
      emergencyContactRelation: 'Brother',
      address: '404 Wicker Park Blvd, Chicago, IL',
      emergencyContact: 'Brian Taylor (Brother) - +1-555-017-9912',
    },
    {
      patientId: 'PAT-2026-10014',
      firstName: 'Wei',
      middleName: 'Jian',
      lastName: 'Zhang',
      dateOfBirth: new Date('1975-11-19'),
      gender: Gender.MALE,
      phone: '+1-555-016-4400',
      email: 'wei.zhang@example.com',
      addressLine1: '2300 S Wentworth Ave',
      city: 'Chicago',
      state: 'IL',
      postalCode: '60616',
      emergencyContactName: 'Mei Zhang',
      emergencyContactPhone: '+1-555-016-4401',
      emergencyContactRelation: 'Spouse',
      address: '2300 S Wentworth Ave, Chicago, IL',
      emergencyContact: 'Mei Zhang (Spouse) - +1-555-016-4401',
    },
    {
      patientId: 'PAT-2026-10015',
      firstName: 'Chloe',
      middleName: 'Rose',
      lastName: 'O\'Connor',
      dateOfBirth: new Date('1989-04-04'),
      gender: Gender.FEMALE,
      phone: '+1-555-012-3377',
      email: 'chloe.oc@example.com',
      addressLine1: '710 Belmont Avenue',
      city: 'Chicago',
      state: 'IL',
      postalCode: '60657',
      emergencyContactName: 'Liam O\'Connor',
      emergencyContactPhone: '+1-555-012-3378',
      emergencyContactRelation: 'Spouse',
      address: '710 Belmont Avenue, Chicago, IL',
      emergencyContact: 'Liam O\'Connor (Spouse) - +1-555-012-3378',
    },
    {
      patientId: 'PAT-2026-10016',
      firstName: 'Samuel',
      middleName: 'David',
      lastName: 'Kim',
      dateOfBirth: new Date('2003-08-11'),
      gender: Gender.MALE,
      phone: '+1-555-015-8866',
      email: 'sam.kim@example.com',
      addressLine1: '150 University Place',
      city: 'Evanston',
      state: 'IL',
      postalCode: '60208',
      emergencyContactName: 'Grace Kim',
      emergencyContactPhone: '+1-555-015-8867',
      emergencyContactRelation: 'Mother',
      address: '150 University Place, Evanston, IL',
      emergencyContact: 'Grace Kim (Mother) - +1-555-015-8867',
    },
    {
      patientId: 'PAT-2026-10017',
      firstName: 'Nadia',
      middleName: 'Elena',
      lastName: 'Popova',
      dateOfBirth: new Date('1966-02-28'),
      gender: Gender.FEMALE,
      phone: '+1-555-013-1122',
      email: 'nadia.popova@example.com',
      addressLine1: '320 Cumberland Road',
      city: 'Park Ridge',
      state: 'IL',
      postalCode: '60068',
      emergencyContactName: 'Alex Popova',
      emergencyContactPhone: '+1-555-013-1123',
      emergencyContactRelation: 'Son',
      address: '320 Cumberland Road, Park Ridge, IL',
      emergencyContact: 'Alex Popova (Son) - +1-555-013-1123',
    },
    {
      patientId: 'PAT-2026-10018',
      firstName: 'Benjamin',
      middleName: 'Thomas',
      lastName: 'Wright',
      dateOfBirth: new Date('1980-05-02'),
      gender: Gender.MALE,
      phone: '+1-555-018-9944',
      email: 'ben.wright@example.com',
      addressLine1: '512 Franklin Boulevard',
      city: 'River Forest',
      state: 'IL',
      postalCode: '60305',
      emergencyContactName: 'Laura Wright',
      emergencyContactPhone: '+1-555-018-9945',
      emergencyContactRelation: 'Spouse',
      address: '512 Franklin Boulevard, River Forest, IL',
      emergencyContact: 'Laura Wright (Spouse) - +1-555-018-9945',
    },
  ];

  const seededPatients = [];
  for (const p of patientData) {
    const created = await prisma.patient.create({ data: p });
    seededPatients.push(created);
  }
  console.log(`✅ Created ${seededPatients.length} Patients with Persistent Patient IDs (PAT-2026-XXXXX)`);

  // Today reference dates for appointments
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  function createTime(baseDate: Date, hours: number, minutes: number): Date {
    const d = new Date(baseDate);
    d.setHours(hours, minutes, 0, 0);
    return d;
  }

  // 8. Seed Imaging Orders & Appointments across clinical states:
  // Case 1: Checked-in STAT CT Chest (In Waiting Queue with Token CT-001)
  const order1 = await prisma.imagingOrder.create({
    data: {
      accessionNumber: 'ACC-20261105-CT01',
      patientId: seededPatients[0]!.id,
      modality: ModalityType.CT,
      bodyPart: 'Chest',
      examinationName: examCtChest.name,
      clinicalIndication: 'STAT: Severe pleuritic chest pain and hemoptysis, rule out pulmonary embolism.',
      referringDoctorId: docMitchell.id,
      contrastRequired: true,
      priority: Priority.STAT,
      orderStatus: OrderStatus.SAFETY_CLEARED,
      authorizationStatus: AuthorizationStatus.APPROVED,
      payerType: PayerType.INSURANCE,
      payerName: 'Blue Cross Blue Shield PPO',
      memberId: 'BCBS-889102-M',
      authorizationCode: 'AUTH-BCBS-9912',
      createdById: receptionUser.id,
    },
  });

  const apptStart1 = createTime(today, 9, 0);
  const apptEnd1 = createTime(today, 9, 30);
  await prisma.appointment.create({
    data: {
      appointmentNumber: 'APT-2026-0001',
      patientId: seededPatients[0]!.id,
      imagingOrderId: order1.id,
      modality: ModalityType.CT,
      equipmentId: ctScanner.id,
      examDefinitionId: examCtChest.id,
      examination: examCtChest.name,
      scheduledStart: apptStart1,
      scheduledEnd: apptEnd1,
      durationMinutes: 30,
      status: AppointmentStatus.CHECKED_IN,
      priority: Priority.STAT,
      location: ctScanner.location,
      notes: 'Patient verified fasting. Serum creatinine 0.9 mg/dL within normal limits.',
      tokenNumber: 'CT-001',
      checkedInAt: createTime(today, 8, 45),
      checkedInById: receptionUser.id,
      createdById: receptionUser.id,
    },
  });

  // Case 2: Checked-in URGENT MRI Brain (In Waiting Queue with Token MRI-001)
  const order2 = await prisma.imagingOrder.create({
    data: {
      accessionNumber: 'ACC-20261105-MR02',
      patientId: seededPatients[1]!.id,
      modality: ModalityType.MRI,
      bodyPart: 'Brain',
      examinationName: examMriBrain.name,
      clinicalIndication: 'Refractory migraines with progressive visual field deficit. Rule out acoustic neuroma or intracranial mass.',
      referringDoctorId: docHouse.id,
      contrastRequired: true,
      priority: Priority.URGENT,
      orderStatus: OrderStatus.SAFETY_CLEARED,
      authorizationStatus: AuthorizationStatus.APPROVED,
      payerType: PayerType.INSURANCE,
      payerName: 'Aetna Health HMO',
      memberId: 'AET-771239-C',
      authorizationCode: 'AUTH-AET-4431',
      createdById: receptionUser.id,
    },
  });

  const apptStart2 = createTime(today, 9, 30);
  const apptEnd2 = createTime(today, 10, 15);
  await prisma.appointment.create({
    data: {
      appointmentNumber: 'APT-2026-0002',
      patientId: seededPatients[1]!.id,
      imagingOrderId: order2.id,
      modality: ModalityType.MRI,
      equipmentId: mriScanner.id,
      examDefinitionId: examMriBrain.id,
      examination: examMriBrain.name,
      scheduledStart: apptStart2,
      scheduledEnd: apptEnd2,
      durationMinutes: 45,
      status: AppointmentStatus.CHECKED_IN,
      priority: Priority.URGENT,
      location: mriScanner.location,
      notes: 'Pre-scan metal screening completed. No pacemaker or ferromagnetic implants.',
      tokenNumber: 'MRI-001',
      checkedInAt: createTime(today, 9, 10),
      checkedInById: receptionUser.id,
      createdById: receptionUser.id,
    },
  });

  // Case 3: Checked-in ROUTINE X-Ray Chest (In Waiting Queue with Token XR-001)
  const order3 = await prisma.imagingOrder.create({
    data: {
      accessionNumber: 'ACC-20261105-XR03',
      patientId: seededPatients[2]!.id,
      modality: ModalityType.XRAY,
      bodyPart: 'Chest',
      examinationName: examXrChest.name,
      clinicalIndication: 'Pre-operative cardiac clearance for elective cholecystectomy.',
      referringDoctorId: docChase.id,
      contrastRequired: false,
      priority: Priority.ROUTINE,
      orderStatus: OrderStatus.SAFETY_CLEARED,
      authorizationStatus: AuthorizationStatus.NOT_REQUIRED,
      payerType: PayerType.SELF_PAY,
      createdById: receptionUser.id,
    },
  });

  const apptStart3 = createTime(today, 10, 0);
  const apptEnd3 = createTime(today, 10, 15);
  await prisma.appointment.create({
    data: {
      appointmentNumber: 'APT-2026-0003',
      patientId: seededPatients[2]!.id,
      imagingOrderId: order3.id,
      modality: ModalityType.XRAY,
      equipmentId: xrayRoom.id,
      examDefinitionId: examXrChest.id,
      examination: examXrChest.name,
      scheduledStart: apptStart3,
      scheduledEnd: apptEnd3,
      durationMinutes: 15,
      status: AppointmentStatus.CHECKED_IN,
      priority: Priority.ROUTINE,
      location: xrayRoom.location,
      tokenNumber: 'XR-001',
      checkedInAt: createTime(today, 9, 50),
      checkedInById: receptionUser.id,
      createdById: receptionUser.id,
    },
  });

  // Case 3b: Checked-in ROUTINE MRI Knee (In Waiting Queue with Token MRI-002)
  const order3b = await prisma.imagingOrder.create({
    data: {
      accessionNumber: 'ACC-20261105-MR03B',
      patientId: seededPatients[9]!.id,
      modality: ModalityType.MRI,
      bodyPart: 'Knee',
      examinationName: examMriKnee.name,
      clinicalIndication: 'Subacute meniscus tear evaluation post minor trail running injury.',
      referringDoctorId: docWilson.id,
      contrastRequired: false,
      priority: Priority.ROUTINE,
      orderStatus: OrderStatus.SAFETY_REVIEW,
      authorizationStatus: AuthorizationStatus.APPROVED,
      payerType: PayerType.INSURANCE,
      payerName: 'UnitedHealthcare',
      memberId: 'UHC-449102-K',
      createdById: receptionUser.id,
    },
  });

  const apptStart3b = createTime(today, 10, 30);
  const apptEnd3b = createTime(today, 11, 0);
  await prisma.appointment.create({
    data: {
      appointmentNumber: 'APT-2026-0003B',
      patientId: seededPatients[9]!.id,
      imagingOrderId: order3b.id,
      modality: ModalityType.MRI,
      equipmentId: mriScanner.id,
      examDefinitionId: examMriKnee.id,
      examination: examMriKnee.name,
      scheduledStart: apptStart3b,
      scheduledEnd: apptEnd3b,
      durationMinutes: 30,
      status: AppointmentStatus.CHECKED_IN,
      priority: Priority.ROUTINE,
      location: mriScanner.location,
      tokenNumber: 'MRI-002',
      checkedInAt: createTime(today, 10, 10),
      checkedInById: receptionUser.id,
      createdById: receptionUser.id,
    },
  });

  // Seed Safety Screenings meeting Phase 3.2 & 3.3 demonstration requirements:
  // 1. CT Chest (order1): SAFETY_CLEARED
  await prisma.technologistSafetyScreening.create({
    data: {
      imagingOrderId: order1.id,
      patientId: seededPatients[0]!.id,
      appointmentId: (await prisma.appointment.findUniqueOrThrow({ where: { appointmentNumber: 'APT-2026-0001' } })).id,
      completedByUserId: techUser.id,
      modality: ModalityType.CT,
      identityVerified: true,
      identityVerificationMethod: 'WRISTBAND_AND_VERBAL',
      identityVerifiedAt: createTime(today, 8, 50),
      safetyStatus: SafetyStatus.CLEARED,
      safetyNotes: 'Patient wristband and DOB verified. No contrast allergies reported. Normal renal function.',
      answers: {
        ct_pregnancy: 'NO',
        ct_contrast_allergy: 'NO',
        ct_renal_disease: 'NO',
        ct_metformin: 'NO',
        ct_asthma_allergies: 'NO',
      },
      reviewedAt: createTime(today, 8, 52),
    },
  });

  // 2. MRI Brain (order2): SAFETY_CLEARED
  await prisma.technologistSafetyScreening.create({
    data: {
      imagingOrderId: order2.id,
      patientId: seededPatients[1]!.id,
      appointmentId: (await prisma.appointment.findUniqueOrThrow({ where: { appointmentNumber: 'APT-2026-0002' } })).id,
      completedByUserId: techUser.id,
      modality: ModalityType.MRI,
      identityVerified: true,
      identityVerificationMethod: 'WRISTBAND_AND_VERBAL',
      identityVerifiedAt: createTime(today, 9, 15),
      safetyStatus: SafetyStatus.CLEARED,
      safetyNotes: 'Patient screened for ferromagnetic foreign bodies and implants. All cleared.',
      answers: {
        mri_pacemaker: 'NO',
        mri_aneurysm_clip: 'NO',
        mri_cochlear_implant: 'NO',
        mri_neurostimulator: 'NO',
        mri_infusion_pump: 'NO',
        mri_metal_in_eyes: 'NO',
        mri_implants_other: 'NO',
        mri_pregnancy: 'NO',
        mri_claustrophobia: 'NO',
        mri_contrast_allergy: 'NO',
        mri_renal_disease: 'NO',
      },
      reviewedAt: createTime(today, 9, 18),
    },
  });

  // 3. Routine X-Ray Chest (order3): SAFETY_CLEARED
  await prisma.technologistSafetyScreening.create({
    data: {
      imagingOrderId: order3.id,
      patientId: seededPatients[2]!.id,
      appointmentId: (await prisma.appointment.findUniqueOrThrow({ where: { appointmentNumber: 'APT-2026-0003' } })).id,
      completedByUserId: techUser.id,
      modality: ModalityType.XRAY,
      identityVerified: true,
      identityVerificationMethod: 'WRISTBAND_AND_VERBAL',
      identityVerifiedAt: createTime(today, 9, 52),
      safetyStatus: SafetyStatus.CLEARED,
      safetyNotes: 'Routine chest radiography screening. Pregnancy confirmed negative.',
      answers: {
        xray_pregnancy: 'NO',
      },
      reviewedAt: createTime(today, 9, 54),
    },
  });

  // 4. MRI Knee (order3b): SAFETY_REVIEW (Cardiac pacemaker contraindication)
  await prisma.technologistSafetyScreening.create({
    data: {
      imagingOrderId: order3b.id,
      patientId: seededPatients[9]!.id,
      appointmentId: (await prisma.appointment.findUniqueOrThrow({ where: { appointmentNumber: 'APT-2026-0003B' } })).id,
      completedByUserId: techUser.id,
      modality: ModalityType.MRI,
      identityVerified: true,
      identityVerificationMethod: 'PHOTO_ID_AND_VERBAL',
      identityVerifiedAt: createTime(today, 10, 12),
      safetyStatus: SafetyStatus.REQUIRES_REVIEW,
      safetyNotes: 'Patient has pacemaker implanted in 2021. Requires cardiology MR-safety clearance.',
      riskFactors: ['Implanted cardiac device concern reported (pacemaker/ICD). Requires clinical review.'],
      answers: {
        mri_pacemaker: 'YES',
        mri_aneurysm_clip: 'NO',
        mri_cochlear_implant: 'NO',
        mri_neurostimulator: 'NO',
        mri_infusion_pump: 'NO',
        mri_metal_in_eyes: 'NO',
        mri_implants_other: 'NO',
        mri_pregnancy: 'NO',
        mri_claustrophobia: 'NO',
      },
      reviewedAt: createTime(today, 10, 15),
    },
  });

  console.log('✅ Created 4 Seed Safety Screenings (3 Cleared, 1 Blocked in Review)');

  // Case 4: SCHEDULED Upcoming CT Head today at 11:00
  const order4 = await prisma.imagingOrder.create({
    data: {
      accessionNumber: 'ACC-20261105-CT04',
      patientId: seededPatients[3]!.id,
      modality: ModalityType.CT,
      bodyPart: 'Head/Brain',
      examinationName: examCtHead.name,
      clinicalIndication: 'Follow-up for minor head concussion 2 weeks post sports injury.',
      referringDoctorId: docMitchell.id,
      contrastRequired: false,
      priority: Priority.ROUTINE,
      orderStatus: OrderStatus.SCHEDULED,
      authorizationStatus: AuthorizationStatus.APPROVED,
      payerType: PayerType.INSURANCE,
      payerName: 'UnitedHealthcare Choice Plus',
      memberId: 'UHC-99214-S',
      createdById: receptionUser.id,
    },
  });

  await prisma.appointment.create({
    data: {
      appointmentNumber: 'APT-2026-0004',
      patientId: seededPatients[3]!.id,
      imagingOrderId: order4.id,
      modality: ModalityType.CT,
      equipmentId: ctScanner.id,
      examDefinitionId: examCtHead.id,
      examination: examCtHead.name,
      scheduledStart: createTime(today, 11, 0),
      scheduledEnd: createTime(today, 11, 20),
      durationMinutes: 20,
      status: AppointmentStatus.SCHEDULED,
      priority: Priority.ROUTINE,
      location: ctScanner.location,
      notes: 'Patient advised to arrive 15 minutes early for check-in.',
      createdById: receptionUser.id,
    },
  });

  // Case 5: SCHEDULED Upcoming MRI Knee today at 13:00
  const order5 = await prisma.imagingOrder.create({
    data: {
      accessionNumber: 'ACC-20261105-MR05',
      patientId: seededPatients[4]!.id,
      modality: ModalityType.MRI,
      bodyPart: 'Knee',
      examinationName: examMriKnee.name,
      clinicalIndication: 'Acute twist injury right knee playing soccer. Suspected anterior cruciate ligament (ACL) tear.',
      referringDoctorId: docChase.id,
      contrastRequired: false,
      priority: Priority.ROUTINE,
      orderStatus: OrderStatus.SCHEDULED,
      authorizationStatus: AuthorizationStatus.PENDING,
      payerType: PayerType.INSURANCE,
      payerName: 'Cigna Open Access',
      memberId: 'CIG-33129-W',
      createdById: receptionUser.id,
    },
  });

  await prisma.appointment.create({
    data: {
      appointmentNumber: 'APT-2026-0005',
      patientId: seededPatients[4]!.id,
      imagingOrderId: order5.id,
      modality: ModalityType.MRI,
      equipmentId: mriScanner.id,
      examDefinitionId: examMriKnee.id,
      examination: examMriKnee.name,
      scheduledStart: createTime(today, 13, 0),
      scheduledEnd: createTime(today, 13, 30),
      durationMinutes: 30,
      status: AppointmentStatus.SCHEDULED,
      priority: Priority.ROUTINE,
      location: mriScanner.location,
      createdById: receptionUser.id,
    },
  });

  // Case 6: CANCELLED Appointment (Patient sick)
  const order6 = await prisma.imagingOrder.create({
    data: {
      accessionNumber: 'ACC-20261105-CT06',
      patientId: seededPatients[5]!.id,
      modality: ModalityType.CT,
      bodyPart: 'Head/Brain',
      examinationName: examCtHead.name,
      clinicalIndication: 'Chronic dizzy spells, episodic vertigo.',
      referringDoctorId: docHouse.id,
      contrastRequired: false,
      priority: Priority.ROUTINE,
      orderStatus: OrderStatus.CANCELLED,
      authorizationStatus: AuthorizationStatus.NOT_REQUIRED,
      payerType: PayerType.SELF_PAY,
      createdById: receptionUser.id,
    },
  });

  await prisma.appointment.create({
    data: {
      appointmentNumber: 'APT-2026-0006',
      patientId: seededPatients[5]!.id,
      imagingOrderId: order6.id,
      modality: ModalityType.CT,
      equipmentId: ctScanner.id,
      examDefinitionId: examCtHead.id,
      examination: examCtHead.name,
      scheduledStart: createTime(today, 14, 0),
      scheduledEnd: createTime(today, 14, 20),
      durationMinutes: 20,
      status: AppointmentStatus.CANCELLED,
      priority: Priority.ROUTINE,
      location: ctScanner.location,
      cancellationReason: 'Patient called with high fever and respiratory symptoms; requested reschedule next week.',
      cancelledAt: createTime(today, 8, 30),
      createdById: receptionUser.id,
    },
  });

  // Case 7: NO_SHOW Appointment (Missed morning slot)
  const order7 = await prisma.imagingOrder.create({
    data: {
      accessionNumber: 'ACC-20261105-XR07',
      patientId: seededPatients[6]!.id,
      modality: ModalityType.XRAY,
      bodyPart: 'Knee',
      examinationName: examXrKnee.name,
      clinicalIndication: 'Bilateral knee osteoarthritis, evaluation for joint space narrowing.',
      referringDoctorId: docMitchell.id,
      contrastRequired: false,
      priority: Priority.ROUTINE,
      orderStatus: OrderStatus.SCHEDULED,
      authorizationStatus: AuthorizationStatus.APPROVED,
      payerType: PayerType.INSURANCE,
      payerName: 'Medicare Part B',
      memberId: 'MED-11928-S',
      createdById: receptionUser.id,
    },
  });

  await prisma.appointment.create({
    data: {
      appointmentNumber: 'APT-2026-0007',
      patientId: seededPatients[6]!.id,
      imagingOrderId: order7.id,
      modality: ModalityType.XRAY,
      equipmentId: xrayRoom.id,
      examDefinitionId: examXrKnee.id,
      examination: examXrKnee.name,
      scheduledStart: createTime(today, 8, 30),
      scheduledEnd: createTime(today, 8, 45),
      durationMinutes: 15,
      status: AppointmentStatus.NO_SHOW,
      priority: Priority.ROUTINE,
      location: xrayRoom.location,
      noShowReason: 'Patient failed to appear for 08:30 appointment. Two telephone outreach calls went to voicemail.',
      createdById: receptionUser.id,
    },
  });

  // Case 8: Tomorrow Morning SCHEDULED MRI Brain
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const order8 = await prisma.imagingOrder.create({
    data: {
      accessionNumber: 'ACC-20261106-MR08',
      patientId: seededPatients[7]!.id,
      modality: ModalityType.MRI,
      bodyPart: 'Brain',
      examinationName: examMriBrain.name,
      clinicalIndication: 'Chronic memory impairment and mild cognitive decline. Screening for vascular dementia.',
      referringDoctorId: docWilson.id,
      contrastRequired: false,
      priority: Priority.ROUTINE,
      orderStatus: OrderStatus.SCHEDULED,
      authorizationStatus: AuthorizationStatus.APPROVED,
      payerType: PayerType.INSURANCE,
      payerName: 'Medicare Advantage',
      memberId: 'MED-ADV-8821',
      createdById: receptionUser.id,
    },
  });

  await prisma.appointment.create({
    data: {
      appointmentNumber: 'APT-2026-0008',
      patientId: seededPatients[7]!.id,
      imagingOrderId: order8.id,
      modality: ModalityType.MRI,
      equipmentId: mriScanner.id,
      examDefinitionId: examMriBrain.id,
      examination: examMriBrain.name,
      scheduledStart: createTime(tomorrow, 9, 0),
      scheduledEnd: createTime(tomorrow, 9, 45),
      durationMinutes: 45,
      status: AppointmentStatus.SCHEDULED,
      priority: Priority.ROUTINE,
      location: mriScanner.location,
      notes: 'Claustrophobia noted. Mild oral anxiolytic prescribed by referring physician.',
      createdById: receptionUser.id,
    },
  });

  // Case 9: Unscheduled Order (Ready for booking demo!)
  await prisma.imagingOrder.create({
    data: {
      accessionNumber: 'ACC-20261106-XR09',
      patientId: seededPatients[8]!.id,
      modality: ModalityType.XRAY,
      bodyPart: 'Chest',
      examinationName: examXrChest.name,
      clinicalIndication: 'Persistent dry cough for 3 weeks post-viral infection. Rule out focal pneumonia.',
      referringDoctorId: docMitchell.id,
      contrastRequired: false,
      priority: Priority.ROUTINE,
      orderStatus: OrderStatus.CREATED,
      authorizationStatus: AuthorizationStatus.NOT_REQUIRED,
      payerType: PayerType.SELF_PAY,
      createdById: receptionUser.id,
    },
  });

  console.log('✅ Created 9 Realistic Clinical Imaging Orders & Appointments (Checked-in, Scheduled, Cancelled, No-show)');

  // 9. Seed Audit Logs
  await prisma.auditLog.createMany({
    data: [
      {
        userId: adminUser.id,
        action: 'SYSTEM_INITIALIZATION',
        entityType: 'System',
        entityId: 'RIS-CORE-V2',
        details: { phase: 'PHASE_2', env: 'development', message: 'Phase 2 Reception, Orders & Scheduling initialized' },
        ipAddress: '127.0.0.1',
      },
      {
        userId: receptionUser.id,
        action: 'PATIENT_CREATED',
        entityType: 'Patient',
        entityId: seededPatients[0]!.patientId,
        details: { mrn: seededPatients[0]!.patientId, name: `${seededPatients[0]!.firstName} ${seededPatients[0]!.lastName}` },
        ipAddress: '192.168.1.101',
      },
      {
        userId: receptionUser.id,
        action: 'ORDER_CREATED',
        entityType: 'ImagingOrder',
        entityId: order1.accessionNumber,
        details: { accessionNumber: order1.accessionNumber, modality: order1.modality, priority: order1.priority },
        ipAddress: '192.168.1.101',
      },
      {
        userId: receptionUser.id,
        action: 'APPOINTMENT_SCHEDULED',
        entityType: 'Appointment',
        entityId: 'APT-2026-0001',
        details: { scheduledStart: apptStart1.toISOString(), scheduledEnd: apptEnd1.toISOString(), equipment: ctScanner.name },
        ipAddress: '192.168.1.101',
      },
      {
        userId: receptionUser.id,
        action: 'PATIENT_CHECKED_IN',
        entityType: 'Appointment',
        entityId: 'APT-2026-0001',
        details: { tokenNumber: 'CT-001', accessionNumber: order1.accessionNumber, identityVerified: true },
        ipAddress: '192.168.1.101',
      },
      {
        userId: receptionUser.id,
        action: 'PATIENT_CHECKED_IN',
        entityType: 'Appointment',
        entityId: 'APT-2026-0002',
        details: { tokenNumber: 'MRI-001', accessionNumber: order2.accessionNumber, identityVerified: true },
        ipAddress: '192.168.1.101',
      },
    ],
  });

  console.log('✅ Created Initial Phase 2 Audit Logs');
  console.log('✨ Phase 2 Database Seeding Completed Successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
