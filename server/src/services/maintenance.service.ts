import { prisma } from '../config/db';
import { Prisma, EquipmentStatus, ModalityType } from '@prisma/client';
import { AppError } from '../utils/appError';
import { logAuditEvent } from './audit.service';
import {
  generateScheduleNumber,
  generateQcCheckNumber,
  generateServiceTicketNumber,
  generateDowntimeNumber,
  generateCertificateNumber,
  generateContractNumber,
  generateServiceRecordNumber,
} from '../utils/identifierGenerator';

export interface AuditContext {
  userId?: string;
  userRole?: string;
  ipAddress?: string;
  userAgent?: string;
}

// ============================================================================
// SEEDING DEFAULT ASSETS, CHECKLIST TEMPLATES & SERVICE CONTACTS
// ============================================================================

let maintenanceDataInitialized = false;

export async function ensureDefaultMaintenanceData(): Promise<void> {
  if (maintenanceDataInitialized) return;
  maintenanceDataInitialized = true;

  try {
    // 1. Seed or ensure default equipment assets with serial numbers & asset tags
    const existingEquipment = await prisma.equipment.findMany();
    if (existingEquipment.length === 0) {
      const assets = [
      {
        assetTag: 'EQ-CT-001',
        name: 'GE Revolution CT 128-Slice',
        modality: ModalityType.CT,
        assetCategory: 'CT',
        manufacturer: 'GE Healthcare',
        model: 'Revolution EVO',
        serialNumber: 'CT-SN-GE-128-2024',
        status: EquipmentStatus.AVAILABLE,
        location: 'CT Console Room 1',
        roomNumber: 'Room CT-01',
        department: 'Radiology',
        powerRatingKva: new Prisma.Decimal(125.0),
        operatingTempMin: new Prisma.Decimal(18.0),
        operatingTempMax: new Prisma.Decimal(24.0),
        notes: 'Primary 128-slice high-resolution trauma and cardiac scanner',
      },
      {
        assetTag: 'EQ-MRI-001',
        name: 'Siemens Magnetom Vida 3.0T MRI',
        modality: ModalityType.MRI,
        assetCategory: 'MRI',
        manufacturer: 'Siemens Healthineers',
        model: 'Magnetom Vida 3T',
        serialNumber: 'MR-SN-SIEM-30-2023',
        status: EquipmentStatus.AVAILABLE,
        location: 'MRI Scanner Control Room',
        roomNumber: 'Room MR-01',
        department: 'Radiology',
        powerRatingKva: new Prisma.Decimal(160.0),
        operatingTempMin: new Prisma.Decimal(18.0),
        operatingTempMax: new Prisma.Decimal(22.0),
        notes: '3.0T wide-bore MRI with BioMatrix technology',
      },
      {
        assetTag: 'EQ-XRAY-001',
        name: 'Philips DigitalDiagnost C90 Digital X-Ray',
        modality: ModalityType.XRAY,
        assetCategory: 'XRAY',
        manufacturer: 'Philips Healthcare',
        model: 'DigitalDiagnost C90',
        serialNumber: 'XR-SN-PHIL-90-2024',
        status: EquipmentStatus.AVAILABLE,
        location: 'General Radiography Room 1',
        roomNumber: 'Room XR-01',
        department: 'Radiology',
        powerRatingKva: new Prisma.Decimal(65.0),
        operatingTempMin: new Prisma.Decimal(15.0),
        operatingTempMax: new Prisma.Decimal(28.0),
        notes: 'Ceiling-suspended premium digital radiography suite',
      },
      {
        assetTag: 'EQ-INJ-001',
        name: 'Medrad Stellant D Dual-Syringe CT Injector',
        modality: ModalityType.CT,
        assetCategory: 'INJECTOR',
        manufacturer: 'Bayer Healthcare',
        model: 'Stellant D with Certegra',
        serialNumber: 'INJ-MED-STEL-9821',
        status: EquipmentStatus.AVAILABLE,
        location: 'CT Console Room 1',
        roomNumber: 'Room CT-01',
        department: 'Radiology',
        powerRatingKva: new Prisma.Decimal(2.5),
        operatingTempMin: new Prisma.Decimal(15.0),
        operatingTempMax: new Prisma.Decimal(30.0),
        notes: 'Dual syringe injector for saline chaser & automated protocol pacing',
      },
      {
        assetTag: 'EQ-CHILLER-001',
        name: 'KKT Chillers Compact Line MRI Water Chiller',
        modality: ModalityType.MRI,
        assetCategory: 'CHILLER',
        manufacturer: 'KKT Chillers',
        model: 'CompactLine cBoxX 60',
        serialNumber: 'CHL-KKT-60KW-4091',
        status: EquipmentStatus.AVAILABLE,
        location: 'Equipment Plant Room A',
        roomNumber: 'Plant-A',
        department: 'Biomedical Engineering',
        powerRatingKva: new Prisma.Decimal(45.0),
        operatingTempMin: new Prisma.Decimal(5.0),
        operatingTempMax: new Prisma.Decimal(40.0),
        notes: 'Closed-loop helium compressor and gradient coil water/glycol heat exchanger',
      },
      {
        assetTag: 'EQ-UPS-001',
        name: 'Schneider Galaxy VM 160 kVA 3-Phase UPS',
        modality: ModalityType.CT,
        assetCategory: 'UPS',
        manufacturer: 'Schneider Electric',
        model: 'Galaxy VM 160kVA',
        serialNumber: 'UPS-SCHN-160KVA-8812',
        status: EquipmentStatus.AVAILABLE,
        location: 'Main Substation & Electrical Plant Room',
        roomNumber: 'Substation-1',
        department: 'Electrical Maintenance',
        powerRatingKva: new Prisma.Decimal(160.0),
        operatingTempMin: new Prisma.Decimal(10.0),
        operatingTempMax: new Prisma.Decimal(30.0),
        notes: 'Dedicated 415V 3-phase online double-conversion UPS for CT suite and emergency lighting',
      },
    ];

    for (const a of assets) {
      await prisma.equipment.create({ data: a });
    }
  } else {
    // Ensure all existing equipment have assetTag and assetCategory
    for (const eq of existingEquipment) {
      if (!eq.assetTag || !eq.assetCategory) {
        const tag = eq.assetTag || `EQ-${eq.modality}-${eq.id.slice(-6).toUpperCase()}`;
        try {
          await prisma.equipment.update({
            where: { id: eq.id },
            data: {
              assetTag: tag,
              assetCategory: (eq as any).assetCategory || String(eq.modality),
            },
          });
        } catch (_) {
          // Ignore duplicate assetTag if seeded concurrently
        }
      }
    }
  }

  // 2. Seed PM Checklist Templates (OEM & Regulatory Aligned)
  const templatesCount = await prisma.pmChecklistTemplate.count();
  if (templatesCount === 0) {
    const templates = [
      {
        code: 'PM-TMPL-CT-Q',
        title: 'Quarterly CT Scanner OEM & AERB Safety Preventive Maintenance',
        modality: 'CT',
        frequency: 'QUARTERLY',
        oemManufacturer: 'GE Healthcare / Universal OEM',
        version: '2026.1',
        sections: [
          {
            title: 'Mechanical & Gantry Inspection',
            items: [
              { code: 'CT-M01', test: 'Gantry slip ring brushes & contact tracks cleaning', tolerance: 'No carbon scoring', isMandatory: true },
              { code: 'CT-M02', test: 'Gantry rotation balance & bearing lubrication check', tolerance: 'Vibration < 0.2 mm/s', isMandatory: true },
              { code: 'CT-M03', test: 'Emergency Stop button functional cut-off test', tolerance: 'Instant cutoff < 100 ms', isMandatory: true },
              { code: 'CT-M04', test: 'Laser alignment lights accuracy (sagittal & coronal)', tolerance: 'Deviation <= 1.0 mm', isMandatory: true },
            ],
          },
          {
            title: 'X-Ray Generator, Tube & Collimator',
            items: [
              { code: 'CT-X01', test: 'Oil heat exchanger pump flow rate and leak inspection', tolerance: 'Flow rate >= 12 L/min, zero leaks', isMandatory: true },
              { code: 'CT-X02', test: 'kVp and mA accuracy across tube potential (80, 100, 120, 140 kVp)', tolerance: 'Within +/- 2.5% of nominal', isMandatory: true },
              { code: 'CT-X03', test: 'Pre-patient collimator blade positioning repeatability', tolerance: '<= 0.5 mm error', isMandatory: true },
            ],
          },
          {
            title: 'Image Quality & Dosimetry Calibration',
            items: [
              { code: 'CT-Q01', test: 'CT number of water (Standard Phantom 20 cm)', tolerance: '0 +/- 3.0 HU', isMandatory: true },
              { code: 'CT-Q02', test: 'CT number of air', tolerance: '-1000 +/- 5.0 HU', isMandatory: true },
              { code: 'CT-Q03', test: 'Image noise variance (standard deviation in water)', tolerance: '<= 3.5 HU', isMandatory: true },
              { code: 'CT-Q04', test: 'CTDIvol calibration check (16 cm head & 32 cm body phantom)', tolerance: 'Within +/- 10% of reference', isMandatory: true },
            ],
          },
        ],
      },
      {
        code: 'PM-TMPL-MRI-Q',
        title: 'Quarterly MRI Superconducting Magnet, Cryogen & RF Preventive Maintenance',
        modality: 'MRI',
        frequency: 'QUARTERLY',
        oemManufacturer: 'Siemens Healthineers / Universal OEM',
        version: '2026.1',
        sections: [
          {
            title: 'Cryogen & Cold Head Subsystem',
            items: [
              { code: 'MR-C01', test: 'Liquid helium level check & boil-off rate monitor', tolerance: 'Helium level >= 75%, boil-off < 0.1%/day', isMandatory: true },
              { code: 'MR-C02', test: 'Cryocooler cold head motor sound & cycle timing', tolerance: 'Cycle frequency 1.0 - 1.2 Hz', isMandatory: true },
              { code: 'MR-C03', test: 'Helium compressor discharge & suction pressure', tolerance: 'Discharge 280-320 psi', isMandatory: true },
            ],
          },
          {
            title: 'RF Shielding, Cage & Coils',
            items: [
              { code: 'MR-R01', test: 'RF cabin door seal, copper contact fingers & door latch', tolerance: 'Attenuation > 100 dB across 10-150 MHz', isMandatory: true },
              { code: 'MR-R02', test: 'Body transmit/receive coil tuning and SNR verification', tolerance: 'SNR within 5% of factory benchmark', isMandatory: true },
              { code: 'MR-R03', test: 'Emergency quench pipe pressure gauge & burst disc seal', tolerance: 'Intact, no moisture condensation', isMandatory: true },
            ],
          },
          {
            title: 'Gradients & Safety Systems',
            items: [
              { code: 'MR-G01', test: 'Gradient amplifier cooling loop temperature & flow rate', tolerance: 'Water inlet temp 8-12 deg C', isMandatory: true },
              { code: 'MR-G02', test: 'Patient table emergency unlock & manual retract function', tolerance: 'Egress duration < 5 seconds', isMandatory: true },
            ],
          },
        ],
      },
      {
        code: 'PM-TMPL-XRAY-Q',
        title: 'Quarterly Digital Radiography Collimator, AEC & Radiation Safety PM',
        modality: 'XRAY',
        frequency: 'QUARTERLY',
        oemManufacturer: 'Philips / Universal OEM',
        version: '2026.1',
        sections: [
          {
            title: 'Radiation & Beam Safety',
            items: [
              { code: 'XR-B01', test: 'Light beam and X-ray field congruency (collimation)', tolerance: '<= 1.0% of SID (Source-to-Image Distance)', isMandatory: true },
              { code: 'XR-B02', test: 'AEC (Automatic Exposure Control) chamber repeatability', tolerance: 'Coefficient of variation < 0.05', isMandatory: true },
              { code: 'XR-B03', test: 'High-voltage cable termination & dielectric oil check', tolerance: 'Clean, no oil seepage or pinholes', isMandatory: true },
            ],
          },
        ],
      },
      {
        code: 'PM-TMPL-CHILLER-M',
        title: 'Monthly Plant Water/Glycol Chiller Maintenance',
        modality: 'CHILLER',
        frequency: 'MONTHLY',
        oemManufacturer: 'KKT Chillers / Industrial Standard',
        version: '2026.1',
        sections: [
          {
            title: 'Hydraulic & Thermal Verification',
            items: [
              { code: 'CH-01', test: 'Cooling loop delivery temperature to MRI/CT', tolerance: 'Set point 10.0 +/- 1.0 deg C', isMandatory: true },
              { code: 'CH-02', test: 'Supply line glycol concentration refractometer test', tolerance: '35% to 40% ethylene glycol', isMandatory: true },
              { code: 'CH-03', test: 'Pump discharge pressure & flow rate', tolerance: 'Flow rate >= 90 L/min, pressure >= 3.5 bar', isMandatory: true },
              { code: 'CH-04', test: 'Condenser air filters & fin cleanliness', tolerance: 'Clear airflow, no blockage', isMandatory: false },
            ],
          },
        ],
      },
      {
        code: 'PM-TMPL-UPS-M',
        title: 'Monthly 3-Phase Online UPS Battery & Inverter Test',
        modality: 'UPS',
        frequency: 'MONTHLY',
        oemManufacturer: 'Schneider / Industrial Standard',
        version: '2026.1',
        sections: [
          {
            title: 'Electrical & Battery Autonomy',
            items: [
              { code: 'UPS-01', test: 'Battery bank float voltage & internal resistance test', tolerance: '13.6V +/- 0.2V per block', isMandatory: true },
              { code: 'UPS-02', test: 'Static bypass automated switchover simulation', tolerance: 'Transfer time < 4 ms (no phase glitch)', isMandatory: true },
              { code: 'UPS-03', test: 'Output voltage harmonic distortion (THD-v)', tolerance: 'THD < 2.0% under full clinical load', isMandatory: true },
            ],
          },
        ],
      },
    ];

    for (const t of templates) {
      await prisma.pmChecklistTemplate.create({ data: t });
    }
  }

  // 3. Seed Service Contacts & Vendors
  const contactsCount = await prisma.serviceContact.count();
  if (contactsCount === 0) {
    const contacts = [
      {
        vendorName: 'GE Healthcare Bio-Medical Field Service',
        contactName: 'Suresh Menon',
        role: 'Senior CT Field Service Engineer',
        email: 'suresh.menon@gehealthcare.service.local',
        phone: '+91-98401-22345',
        emergencyPhone: '+91-1800-419-4343 (24/7 Helpline)',
        escalationLevel: 1,
        equipmentSpecialty: 'CT, Discovery, Revolution EVO',
        vendorAddress: 'GE Healthcare India, Technology Center, Whitefield, Bengaluru',
      },
      {
        vendorName: 'Siemens Healthineers Advanced Customer Care',
        contactName: 'Dr. Vikramaditya Sen',
        role: 'Lead MR Field Applications & Service Specialist',
        email: 'vikram.sen@siemens-healthineers.local',
        phone: '+91-98200-55678',
        emergencyPhone: '+91-1800-209-1800 (National Dispatch)',
        escalationLevel: 1,
        equipmentSpecialty: 'MRI, Magnetom Vida, Superconducting Cryogenics',
        vendorAddress: 'Siemens Healthineers, Central Plaza, Worli, Mumbai',
      },
      {
        vendorName: 'Philips Healthcare Customer Services',
        contactName: 'Ananya Sharma',
        role: 'Regional X-Ray Service Manager',
        email: 'ananya.sharma@philips.service.local',
        phone: '+91-98112-99887',
        emergencyPhone: '+91-1800-102-2929',
        escalationLevel: 2,
        equipmentSpecialty: 'Digital Radiography, C90, Fluoroscopy',
        vendorAddress: 'Philips Innovation Campus, Manyata Tech Park, Bengaluru',
      },
      {
        vendorName: 'Bayer Radiology Device Support',
        contactName: 'Karthik Raman',
        role: 'Injector Product Specialist',
        email: 'karthik.raman@bayer.service.local',
        phone: '+91-97400-11223',
        emergencyPhone: '+91-80-6677-8899',
        escalationLevel: 1,
        equipmentSpecialty: 'Medrad Stellant D, Certegra Injector Workstation',
        vendorAddress: 'Bayer House, Central Avenue, Hiranandani, Thane',
      },
    ];

    for (const c of contacts) {
      await prisma.serviceContact.create({ data: c });
    }
  }
  } catch (_) {
    // Graceful recovery if initial seed experiences transient collision
  }
}

// ============================================================================
// 1. EQUIPMENT ASSET REGISTER
// ============================================================================

export async function listEquipment(filters?: {
  modality?: string;
  assetCategory?: string;
  status?: string;
  search?: string;
  activeOnly?: boolean;
}) {
  await ensureDefaultMaintenanceData();

  const where: Prisma.EquipmentWhereInput = {};
  if (filters?.activeOnly !== false) {
    where.active = true;
  }
  if (filters?.modality) {
    where.modality = filters.modality as ModalityType;
  }
  if (filters?.assetCategory) {
    where.assetCategory = filters.assetCategory;
  }
  if (filters?.status) {
    where.status = filters.status as EquipmentStatus;
  }
  if (filters?.search) {
    const s = filters.search.trim();
    where.OR = [
      { name: { contains: s, mode: 'insensitive' } },
      { serialNumber: { contains: s, mode: 'insensitive' } },
      { assetTag: { contains: s, mode: 'insensitive' } },
      { location: { contains: s, mode: 'insensitive' } },
      { manufacturer: { contains: s, mode: 'insensitive' } },
    ];
  }

  return prisma.equipment.findMany({
    where,
    include: {
      pmSchedules: {
        where: { status: { in: ['SCHEDULED', 'DUE', 'OVERDUE'] } },
        orderBy: { nextDueDate: 'asc' },
        take: 1,
      },
      contracts: {
        where: { status: 'ACTIVE' },
        orderBy: { endDate: 'desc' },
        take: 1,
      },
      certificates: {
        where: { status: 'VALID' },
        orderBy: { expiryDate: 'asc' },
        take: 1,
      },
    },
    orderBy: [{ assetCategory: 'asc' }, { name: 'asc' }],
  });
}

export async function getEquipmentById(idOrTag: string) {
  await ensureDefaultMaintenanceData();

  const eq = await prisma.equipment.findFirst({
    where: {
      OR: [{ id: idOrTag }, { assetTag: idOrTag }, { serialNumber: idOrTag }],
    },
    include: {
      pmSchedules: { orderBy: { nextDueDate: 'desc' }, take: 10 },
      qcChecks: { orderBy: { checkDate: 'desc' }, take: 15 },
      serviceTickets: { orderBy: { openedAt: 'desc' }, take: 10 },
      downtimes: { orderBy: { startTime: 'desc' }, take: 10 },
      certificates: { orderBy: { expiryDate: 'desc' }, take: 10 },
      contracts: { orderBy: { endDate: 'desc' }, take: 5 },
      serviceRecords: { orderBy: { serviceDate: 'desc' }, take: 10 },
      partsUsages: {
        include: { inventoryItem: true, batch: true },
        orderBy: { installedAt: 'desc' },
        take: 15,
      },
    },
  });

  if (!eq) {
    throw AppError.notFound(`Equipment asset '${idOrTag}' not found`);
  }
  return eq;
}

export async function createEquipment(
  input: {
    assetTag?: string;
    name: string;
    modality: ModalityType;
    assetCategory?: string;
    manufacturer: string;
    model: string;
    serialNumber: string;
    status?: EquipmentStatus;
    location?: string;
    roomNumber?: string;
    department?: string;
    powerRatingKva?: number;
    operatingTempMin?: number;
    operatingTempMax?: number;
    notes?: string;
  },
  context?: AuditContext
) {
  const resolvedLocation = (input.location || input.roomNumber || 'Main Facility').trim();
  if (!input.name || !input.serialNumber) {
    throw AppError.badRequest('Equipment name and serial number are strictly required');
  }

  // Check unique serial number
  const existing = await prisma.equipment.findUnique({
    where: { serialNumber: input.serialNumber.trim() },
  });
  if (existing) {
    throw AppError.conflict(`Equipment with serial number '${input.serialNumber}' is already registered`);
  }

  const assetTag = input.assetTag?.trim() || `EQ-${input.modality}-${Math.floor(100 + Math.random() * 900)}`;

  const created = await prisma.equipment.create({
    data: {
      assetTag,
      name: input.name.trim(),
      modality: input.modality,
      assetCategory: input.assetCategory?.trim() || String(input.modality),
      manufacturer: input.manufacturer?.trim() || 'Unknown OEM',
      model: input.model?.trim() || 'Standard Model',
      serialNumber: input.serialNumber.trim(),
      status: input.status || EquipmentStatus.OPERATIONAL,
      location: resolvedLocation,
      roomNumber: input.roomNumber?.trim(),
      department: input.department?.trim() || 'Radiology',
      powerRatingKva: input.powerRatingKva ? new Prisma.Decimal(input.powerRatingKva) : null,
      operatingTempMin: input.operatingTempMin ? new Prisma.Decimal(input.operatingTempMin) : null,
      operatingTempMax: input.operatingTempMax ? new Prisma.Decimal(input.operatingTempMax) : null,
      notes: input.notes?.trim(),
    },
  });

  await logAuditEvent({
    userId: context?.userId,
    action: 'EQUIPMENT_ASSET_CREATED',
    entityType: 'Equipment',
    entityId: created.id,
    details: {
      assetTag: created.assetTag,
      serialNumber: created.serialNumber,
      name: created.name,
      modality: created.modality,
    },
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
  });

  return created;
}

export async function updateEquipment(
  id: string,
  input: Partial<{
    name: string;
    status: EquipmentStatus;
    location: string;
    roomNumber: string;
    department: string;
    powerRatingKva: number;
    operatingTempMin: number;
    operatingTempMax: number;
    notes: string;
    active: boolean;
  }>,
  context?: AuditContext
) {
  const existing = await prisma.equipment.findUnique({ where: { id } });
  if (!existing) {
    throw AppError.notFound(`Equipment asset '${id}' not found`);
  }

  const updateData: Prisma.EquipmentUpdateInput = {};
  if (input.name !== undefined) updateData.name = input.name.trim();
  if (input.status !== undefined) updateData.status = input.status;
  if (input.location !== undefined) updateData.location = input.location.trim();
  if (input.roomNumber !== undefined) updateData.roomNumber = input.roomNumber.trim();
  if (input.department !== undefined) updateData.department = input.department.trim();
  if (input.powerRatingKva !== undefined) updateData.powerRatingKva = new Prisma.Decimal(input.powerRatingKva);
  if (input.operatingTempMin !== undefined) updateData.operatingTempMin = new Prisma.Decimal(input.operatingTempMin);
  if (input.operatingTempMax !== undefined) updateData.operatingTempMax = new Prisma.Decimal(input.operatingTempMax);
  if (input.notes !== undefined) updateData.notes = input.notes.trim();
  if (input.active !== undefined) updateData.active = input.active;

  const updated = await prisma.equipment.update({
    where: { id },
    data: updateData,
  });

  await logAuditEvent({
    userId: context?.userId,
    action: 'EQUIPMENT_ASSET_UPDATED',
    entityType: 'Equipment',
    entityId: updated.id,
    details: { changes: input },
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
  });

  return updated;
}

// ============================================================================
// 2. PM SCHEDULE CALENDAR
// ============================================================================

export async function listPmSchedules(filters?: {
  equipmentId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}) {
  await ensureDefaultMaintenanceData();

  const where: Prisma.MaintenanceScheduleWhereInput = {};
  if (filters?.equipmentId) where.equipmentId = filters.equipmentId;
  if (filters?.status) where.status = filters.status;

  if (filters?.startDate || filters?.endDate) {
    where.scheduledDate = {};
    if (filters.startDate) where.scheduledDate.gte = new Date(filters.startDate);
    if (filters.endDate) where.scheduledDate.lte = new Date(filters.endDate);
  }

  const schedules = await prisma.maintenanceSchedule.findMany({
    where,
    include: {
      equipment: true,
      contract: true,
      checklistTemplate: true,
    },
    orderBy: { scheduledDate: 'asc' },
  });

  // Calculate dynamic OVERDUE status if past due date
  const now = new Date();
  return schedules.map((s) => {
    const isOverdue = s.status !== 'COMPLETED' && s.status !== 'CANCELLED' && new Date(s.nextDueDate) < now;
    return {
      ...s,
      isOverdue,
      status: isOverdue && s.status === 'SCHEDULED' ? 'OVERDUE' : s.status,
    };
  });
}

export async function createPmSchedule(
  input: {
    equipmentId: string;
    title: string;
    maintenanceType?: string;
    frequency?: string;
    intervalDays?: number;
    contractType?: string;
    contractId?: string;
    scheduledDate: string;
    nextDueDate?: string;
    assignedEngineer?: string;
    vendorName?: string;
    checklistTemplateId?: string;
    notes?: string;
  },
  context?: AuditContext
) {
  const eq = await prisma.equipment.findUnique({ where: { id: input.equipmentId } });
  if (!eq) {
    throw AppError.notFound(`Equipment '${input.equipmentId}' not found`);
  }

  const scheduled = new Date(input.scheduledDate);
  if (isNaN(scheduled.getTime())) {
    throw AppError.badRequest('Valid scheduled date is required');
  }

  const intervalDays = input.intervalDays || 90;
  const nextDue = input.nextDueDate ? new Date(input.nextDueDate) : new Date(scheduled.getTime() + intervalDays * 86400000);

  const scheduleNumber = generateScheduleNumber();

  const created = await prisma.maintenanceSchedule.create({
    data: {
      scheduleNumber,
      equipmentId: eq.id,
      title: input.title.trim(),
      maintenanceType: input.maintenanceType || 'PREVENTIVE_MAINTENANCE',
      frequency: input.frequency || 'QUARTERLY',
      intervalDays,
      contractType: input.contractType || 'AMC',
      contractId: input.contractId || null,
      scheduledDate: scheduled,
      nextDueDate: nextDue,
      assignedEngineer: input.assignedEngineer?.trim() || null,
      vendorName: input.vendorName?.trim() || null,
      checklistTemplateId: input.checklistTemplateId || null,
      notes: input.notes?.trim() || null,
      status: 'SCHEDULED',
    },
    include: { equipment: true, checklistTemplate: true },
  });

  // Update nextMaintenanceDate on equipment asset
  await prisma.equipment.update({
    where: { id: eq.id },
    data: { nextMaintenanceDate: nextDue },
  });

  await logAuditEvent({
    userId: context?.userId,
    action: 'PM_SCHEDULE_CREATED',
    entityType: 'MaintenanceSchedule',
    entityId: created.id,
    details: {
      scheduleNumber: created.scheduleNumber,
      equipment: eq.name,
      scheduledDate: created.scheduledDate,
      nextDueDate: created.nextDueDate,
    },
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
  });

  return created;
}

export async function completePmSchedule(
  id: string,
  input: {
    completedChecklist?: any;
    notes?: string;
    performedById: string;
    performedByName?: string;
    nextDueDate?: string;
  },
  context?: AuditContext
) {
  const pm = await prisma.maintenanceSchedule.findUnique({
    where: { id },
    include: { equipment: true },
  });
  if (!pm) {
    throw AppError.notFound(`PM schedule '${id}' not found`);
  }

  const now = new Date();
  const nextDue = input.nextDueDate ? new Date(input.nextDueDate) : new Date(now.getTime() + pm.intervalDays * 86400000);

  const updated = await prisma.$transaction(async (tx) => {
    const updatedSchedule = await tx.maintenanceSchedule.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        lastCompletedDate: now,
        nextDueDate: nextDue,
        completedChecklist: input.completedChecklist || null,
        completedById: input.performedById,
        completedByName: input.performedByName || 'Maintenance Engineer',
        completedAt: now,
        notes: input.notes ? `${pm.notes ? pm.notes + '\n' : ''}Completion Note: ${input.notes}` : pm.notes,
      },
    });

    // Update equipment dates and status
    await tx.equipment.update({
      where: { id: pm.equipmentId },
      data: {
        lastMaintenanceDate: now,
        nextMaintenanceDate: nextDue,
        status: EquipmentStatus.AVAILABLE,
      },
    });

    // Create formal ServiceRecord in audit history
    await tx.serviceRecord.create({
      data: {
        recordNumber: generateServiceRecordNumber(),
        equipmentId: pm.equipmentId,
        serviceType: 'PREVENTIVE_MAINTENANCE',
        serviceDate: now,
        serviceProvider: pm.vendorName || 'In-House Biomedical Engineering',
        engineerName: input.performedByName || pm.assignedEngineer || 'Field Engineer',
        workDescription: `Completed PM: ${pm.title} (${pm.frequency}). All checklist tolerances verified.`,
        findingsAndRecommendations: input.notes || 'Routine maintenance completed satisfactory. Normal clinical return.',
        statusBefore: pm.equipment.status,
        statusAfter: EquipmentStatus.AVAILABLE,
        pmScheduleId: pm.id,
      },
    });

    return updatedSchedule;
  });

  await logAuditEvent({
    userId: context?.userId || input.performedById,
    action: 'PM_SCHEDULE_COMPLETED',
    entityType: 'MaintenanceSchedule',
    entityId: updated.id,
    details: {
      scheduleNumber: updated.scheduleNumber,
      equipmentId: pm.equipmentId,
      nextDueDate: nextDue,
    },
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
  });

  return updated;
}

// ============================================================================
// 3. DAILY / WEEKLY QC CHECKLIST
// ============================================================================

export async function recordQcCheck(
  input: {
    equipmentId: string;
    frequency?: string;
    overallResult?: string;
    status?: string;
    performedById: string;
    performedByName?: string;
    performedByRole?: string;
    temperatureC?: number;
    humidityPercent?: number;
    chillerTempC?: number;
    heliumLevelPercent?: number;
    ctNumberWaterHu?: number;
    ctNumberWater?: number;
    noiseVariance?: number;
    snrMetric?: number;
    phantomScanPassed?: boolean;
    laserAlignmentPassed?: boolean;
    emergencyStopPassed?: boolean;
    checklistData?: any;
    notes?: string;
  },
  context?: AuditContext
) {
  const eq = await prisma.equipment.findUnique({ where: { id: input.equipmentId } });
  if (!eq) {
    throw AppError.notFound(`Equipment asset '${input.equipmentId}' not found`);
  }

  const checklistData = (input.checklistData && Array.isArray(input.checklistData) && input.checklistData.length > 0)
    ? input.checklistData
    : [
        { item: 'Phantom Scan Alignment', status: input.phantomScanPassed !== false ? 'PASS' : 'FAIL' },
        { item: 'Laser Crosshair Calibration', status: input.laserAlignmentPassed !== false ? 'PASS' : 'FAIL' },
        { item: 'Emergency Stop Circuit', status: input.emergencyStopPassed !== false ? 'PASS' : 'FAIL' },
      ];

  const checkNumber = generateQcCheckNumber();
  const overallResult = input.overallResult || (input.status === 'PASSED' ? 'PASS' : input.status) || 'PASS';

  const created = await prisma.equipmentQcCheck.create({
    data: {
      checkNumber,
      equipmentId: eq.id,
      frequency: input.frequency || 'DAILY',
      checkDate: new Date(),
      performedById: input.performedById,
      performedByName: input.performedByName || 'Technologist',
      performedByRole: input.performedByRole || 'TECHNOLOGIST',
      overallResult,
      temperatureC: input.temperatureC !== undefined ? new Prisma.Decimal(input.temperatureC) : null,
      humidityPercent: input.humidityPercent !== undefined ? new Prisma.Decimal(input.humidityPercent) : null,
      chillerTempC: input.chillerTempC !== undefined ? new Prisma.Decimal(input.chillerTempC) : null,
      heliumLevelPercent: input.heliumLevelPercent !== undefined ? new Prisma.Decimal(input.heliumLevelPercent) : null,
      ctNumberWaterHu: (input.ctNumberWaterHu !== undefined ? input.ctNumberWaterHu : input.ctNumberWater !== undefined ? input.ctNumberWater : null) !== null
        ? new Prisma.Decimal(input.ctNumberWaterHu ?? input.ctNumberWater!)
        : null,
      noiseVariance: input.noiseVariance !== undefined ? new Prisma.Decimal(input.noiseVariance) : null,
      checklistData,
      notes: input.notes?.trim() || null,
    },
    include: { equipment: true },
  });

  // If QC check critically fails, raise alarm and optionally flag equipment
  if (input.overallResult === 'FAIL') {
    await prisma.equipment.update({
      where: { id: eq.id },
      data: { status: EquipmentStatus.OUT_OF_SERVICE },
    });
  }

  await logAuditEvent({
    userId: context?.userId || input.performedById,
    action: 'EQUIPMENT_QC_CHECK_RECORDED',
    entityType: 'EquipmentQcCheck',
    entityId: created.id,
    details: {
      checkNumber: created.checkNumber,
      equipment: eq.name,
      result: created.overallResult,
    },
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
  });

  return created;
}

export async function listQcChecks(equipmentId?: string, frequency?: string) {
  const where: Prisma.EquipmentQcCheckWhereInput = {};
  if (equipmentId) where.equipmentId = equipmentId;
  if (frequency) where.frequency = frequency;

  return prisma.equipmentQcCheck.findMany({
    where,
    include: { equipment: true },
    orderBy: { checkDate: 'desc' },
    take: 50,
  });
}

// ============================================================================
// 4. PM CHECKLIST TEMPLATES (BY MODALITY)
// ============================================================================

export async function listPmTemplates(modality?: string) {
  await ensureDefaultMaintenanceData();

  const where: Prisma.PmChecklistTemplateWhereInput = { active: true };
  if (modality) where.modality = modality;

  return prisma.pmChecklistTemplate.findMany({
    where,
    orderBy: [{ modality: 'asc' }, { code: 'asc' }],
  });
}

export async function getPmTemplateById(idOrCode: string) {
  return prisma.pmChecklistTemplate.findFirst({
    where: { OR: [{ id: idOrCode }, { code: idOrCode }] },
  });
}

// ============================================================================
// 5. SERVICE TICKET / BREAKDOWN
// ============================================================================

export async function createServiceTicket(
  input: {
    equipmentId: string;
    title: string;
    description: string;
    errorCodes?: string;
    priority?: string; // 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    reportedById: string;
    reportedByName?: string;
    assignedEngineer?: string;
    vendorName?: string;
    triggerDowntime?: boolean;
    downtimeCause?: string;
  },
  context?: AuditContext
) {
  const eq = await prisma.equipment.findUnique({ where: { id: input.equipmentId } });
  if (!eq) {
    throw AppError.notFound(`Equipment '${input.equipmentId}' not found`);
  }

  if (!input.title || !input.description) {
    throw AppError.badRequest('Service ticket title and detailed fault description are required');
  }

  const ticketNumber = generateServiceTicketNumber();
  const priority = input.priority || 'MEDIUM';
  const shouldDowntime = input.triggerDowntime ?? (priority === 'CRITICAL' || priority === 'HIGH');

  return prisma.$transaction(async (tx) => {
    let downtimeId: string | undefined;

    if (shouldDowntime) {
      // Create downtime log
      const dwn = await tx.equipmentDowntime.create({
        data: {
          downtimeNumber: generateDowntimeNumber(),
          equipmentId: eq.id,
          startTime: new Date(),
          causeCategory: 'HARDWARE_FAILURE',
          cause: input.downtimeCause || input.description,
          impactLevel: priority === 'CRITICAL' ? 'FULL_STOP' : 'PARTIAL_DEGRADATION',
          recordedById: input.reportedById,
          recordedByName: input.reportedByName || 'Staff',
        },
      });
      downtimeId = dwn.id;

      // Update machine availability to OUT_OF_SERVICE
      await tx.equipment.update({
        where: { id: eq.id },
        data: { status: EquipmentStatus.OUT_OF_SERVICE },
      });
    }

    const ticket = await tx.serviceTicket.create({
      data: {
        ticketNumber,
        equipmentId: eq.id,
        title: input.title.trim(),
        description: input.description.trim(),
        errorCodes: input.errorCodes?.trim() || null,
        priority,
        status: input.assignedEngineer ? 'ASSIGNED' : 'OPEN',
        reportedById: input.reportedById,
        reportedByName: input.reportedByName || 'Staff',
        assignedEngineer: input.assignedEngineer?.trim() || null,
        vendorName: input.vendorName?.trim() || null,
        assignedAt: input.assignedEngineer ? new Date() : null,
        isDowntimeCaused: shouldDowntime,
        downtimeId: downtimeId || null,
      },
      include: { equipment: true, downtimes: true },
    });

    await logAuditEvent({
      userId: context?.userId || input.reportedById,
      action: 'SERVICE_TICKET_CREATED',
      entityType: 'ServiceTicket',
      entityId: ticket.id,
      details: {
        ticketNumber: ticket.ticketNumber,
        equipment: eq.name,
        priority: ticket.priority,
        downtimeInitiated: shouldDowntime,
      },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return ticket;
  });
}

export async function updateServiceTicketStatus(
  ticketId: string,
  input: {
    status: string; // 'ASSIGNED', 'IN_PROGRESS', 'AWAITING_PARTS', 'RESOLVED', 'CLOSED'
    assignedEngineer?: string;
    vendorName?: string;
    resolutionNotes?: string;
    rootCause?: string;
    resolvedById?: string;
    resolvedByName?: string;
    closeDowntime?: boolean;
  },
  context?: AuditContext
) {
  const ticket = await prisma.serviceTicket.findUnique({
    where: { id: ticketId },
    include: { equipment: true },
  });
  if (!ticket) {
    throw AppError.notFound(`Service ticket '${ticketId}' not found`);
  }

  const now = new Date();
  const updateData: Prisma.ServiceTicketUpdateInput = { status: input.status };

  if (input.assignedEngineer) {
    updateData.assignedEngineer = input.assignedEngineer.trim();
    if (!ticket.assignedAt) updateData.assignedAt = now;
  }
  if (input.vendorName) {
    updateData.vendorName = input.vendorName.trim();
  }
  if (input.rootCause) {
    updateData.rootCause = input.rootCause.trim();
  }

  const isResolving = input.status === 'RESOLVED' || input.status === 'CLOSED';
  if (isResolving) {
    updateData.resolvedAt = now;
    if (input.status === 'CLOSED') updateData.closedAt = now;
    if (input.resolutionNotes) updateData.resolutionNotes = input.resolutionNotes.trim();
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.serviceTicket.update({
      where: { id: ticketId },
      data: updateData,
      include: { equipment: true },
    });

    // If resolved and downtime was triggered, close active downtime
    if (isResolving) {
      const activeDowntime = await tx.equipmentDowntime.findFirst({
        where: { equipmentId: ticket.equipmentId, endTime: null },
        orderBy: { startTime: 'desc' },
      });

      if (activeDowntime) {
        const durationMin = Math.round((now.getTime() - new Date(activeDowntime.startTime).getTime()) / 60000);
        await tx.equipmentDowntime.update({
          where: { id: activeDowntime.id },
          data: {
            endTime: now,
            durationMinutes: durationMin,
            resolutionSummary: input.resolutionNotes || 'Service ticket resolved and machine verified operational',
          },
        });
      }

      // Restore equipment status to AVAILABLE
      await tx.equipment.update({
        where: { id: ticket.equipmentId },
        data: { status: EquipmentStatus.AVAILABLE },
      });

      // Record in ServiceRecord history
      await tx.serviceRecord.create({
        data: {
          recordNumber: generateServiceRecordNumber(),
          equipmentId: ticket.equipmentId,
          serviceType: 'BREAKDOWN_REPAIR',
          serviceDate: now,
          serviceProvider: input.vendorName || ticket.vendorName || 'OEM Field Engineering',
          engineerName: input.assignedEngineer || ticket.assignedEngineer || 'Field Specialist',
          workDescription: `Resolved Fault: ${ticket.title}. ${input.resolutionNotes || ''}`,
          findingsAndRecommendations: input.rootCause || 'Root cause corrected. Calibration and test exposures passed.',
          statusBefore: EquipmentStatus.OUT_OF_SERVICE,
          statusAfter: EquipmentStatus.AVAILABLE,
          serviceTicketId: ticket.id,
        },
      });
    }

    await logAuditEvent({
      userId: context?.userId || input.resolvedById,
      action: 'SERVICE_TICKET_STATUS_UPDATED',
      entityType: 'ServiceTicket',
      entityId: updated.id,
      details: {
        ticketNumber: updated.ticketNumber,
        newStatus: updated.status,
      },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return updated;
  });
}

export async function listServiceTickets(filters?: {
  equipmentId?: string;
  status?: string;
  priority?: string;
}) {
  const where: Prisma.ServiceTicketWhereInput = {};
  if (filters?.equipmentId) where.equipmentId = filters.equipmentId;
  if (filters?.status) where.status = filters.status;
  if (filters?.priority) where.priority = filters.priority;

  return prisma.serviceTicket.findMany({
    where,
    include: {
      equipment: true,
      partsUsages: { include: { inventoryItem: true } },
    },
    orderBy: { openedAt: 'desc' },
  });
}

// ============================================================================
// 6. MACHINE DOWNTIME LOG & APPOINTMENT IMPACT
// ============================================================================

export async function recordDowntimeStart(
  input: {
    equipmentId: string;
    serviceTicketId?: string;
    causeCategory?: string;
    cause: string;
    impactLevel?: string;
    recordedById: string;
    recordedByName?: string;
  },
  context?: AuditContext
) {
  const eq = await prisma.equipment.findUnique({ where: { id: input.equipmentId } });
  if (!eq) {
    throw AppError.notFound(`Equipment '${input.equipmentId}' not found`);
  }

  const startTime = new Date();
  const downtimeNumber = generateDowntimeNumber();

  // Find active scheduled appointments that are affected in scheduling
  const affectedAppointments = await prisma.appointment.findMany({
    where: {
      equipmentId: eq.id,
      scheduledStart: { gte: startTime },
      scheduledEnd: { lte: new Date(startTime.getTime() + 24 * 3600000) }, // next 24 hours
      status: { in: ['SCHEDULED'] },
    },
    select: { id: true, appointmentNumber: true, scheduledStart: true },
  });

  const affectedCount = affectedAppointments.length;
  const affectedIds = affectedAppointments.map((a) => a.id);

  const downtime = await prisma.$transaction(async (tx) => {
    const dwn = await tx.equipmentDowntime.create({
      data: {
        downtimeNumber,
        equipmentId: eq.id,
        serviceTicketId: input.serviceTicketId || null,
        startTime,
        causeCategory: input.causeCategory || 'HARDWARE_FAILURE',
        cause: input.cause.trim(),
        impactLevel: input.impactLevel || 'FULL_STOP',
        affectedAppointmentsCount: affectedCount,
        affectedAppointmentIds: affectedIds,
        recordedById: input.recordedById,
        recordedByName: input.recordedByName || 'Staff',
      },
      include: { equipment: true },
    });

    // Mark equipment OUT_OF_SERVICE
    await tx.equipment.update({
      where: { id: eq.id },
      data: { status: EquipmentStatus.OUT_OF_SERVICE },
    });

    return dwn;
  });

  await logAuditEvent({
    userId: context?.userId || input.recordedById,
    action: 'EQUIPMENT_DOWNTIME_STARTED',
    entityType: 'EquipmentDowntime',
    entityId: downtime.id,
    details: {
      downtimeNumber: downtime.downtimeNumber,
      equipment: eq.name,
      affectedAppointmentsCount: affectedCount,
    },
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
  });

  return downtime;
}

export async function recordDowntimeEnd(
  downtimeId: string,
  input: {
    resolutionSummary?: string;
    recordedById?: string;
    recordedByName?: string;
  },
  context?: AuditContext
) {
  const dwn = await prisma.equipmentDowntime.findUnique({
    where: { id: downtimeId },
    include: { equipment: true },
  });
  if (!dwn) {
    throw AppError.notFound(`Downtime log '${downtimeId}' not found`);
  }

  const endTime = new Date();
  const durationMinutes = Math.round((endTime.getTime() - new Date(dwn.startTime).getTime()) / 60000);

  const updated = await prisma.$transaction(async (tx) => {
    const completed = await tx.equipmentDowntime.update({
      where: { id: downtimeId },
      data: {
        endTime,
        durationMinutes,
        resolutionSummary: input.resolutionSummary?.trim() || 'Machine restored to active service',
      },
      include: { equipment: true },
    });

    // Mark equipment AVAILABLE if not in other maintenance
    await tx.equipment.update({
      where: { id: dwn.equipmentId },
      data: { status: EquipmentStatus.AVAILABLE },
    });

    return completed;
  });

  await logAuditEvent({
    userId: context?.userId || input.recordedById,
    action: 'EQUIPMENT_DOWNTIME_ENDED',
    entityType: 'EquipmentDowntime',
    entityId: updated.id,
    details: {
      downtimeNumber: updated.downtimeNumber,
      durationMinutes,
    },
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
  });

  return updated;
}

export async function listDowntimeLogs(filters?: {
  equipmentId?: string;
  startDate?: string;
  endDate?: string;
}) {
  const where: Prisma.EquipmentDowntimeWhereInput = {};
  if (filters?.equipmentId) where.equipmentId = filters.equipmentId;

  if (filters?.startDate || filters?.endDate) {
    where.startTime = {};
    if (filters.startDate) where.startTime.gte = new Date(filters.startDate);
    if (filters.endDate) where.startTime.lte = new Date(filters.endDate);
  }

  return prisma.equipmentDowntime.findMany({
    where,
    include: { equipment: true, serviceTicket: true },
    orderBy: { startTime: 'desc' },
  });
}

// ============================================================================
// 7. PARTS AND SPARE STOCK (MODULE 11 INTEGRATION)
// ============================================================================

export async function consumeMaintenancePart(
  input: {
    equipmentId: string;
    serviceTicketId?: string;
    pmScheduleId?: string;
    inventoryItemId: string;
    batchId?: string;
    location?: string;
    quantityUsed: number;
    reason: string;
    installedById: string;
    installedByName?: string;
  },
  context?: AuditContext
) {
  if (input.quantityUsed <= 0) {
    throw AppError.badRequest('Part quantity must be at least 1 unit');
  }

  const eq = await prisma.equipment.findUnique({ where: { id: input.equipmentId } });
  if (!eq) throw AppError.notFound(`Equipment '${input.equipmentId}' not found`);

  const item = await prisma.inventoryItem.findUnique({ where: { id: input.inventoryItemId } });
  if (!item) throw AppError.notFound(`Inventory spare item '${input.inventoryItemId}' not found in Module 11`);

  const location = input.location || 'GENERAL_STORE';

  return prisma.$transaction(async (tx) => {
    // 1. Locate batch if provided or pick FEFO
    let batchId = input.batchId;
    if (!batchId) {
      const availableBatch = await tx.inventoryBatch.findFirst({
        where: {
          itemId: item.id,
          isBlocked: false,
          currentQuantity: { gte: input.quantityUsed },
        },
        orderBy: { expiryDate: 'asc' },
      });
      if (availableBatch) {
        batchId = availableBatch.id;
      }
    }

    if (batchId) {
      const batch = await tx.inventoryBatch.findUnique({ where: { id: batchId } });
      if (!batch || batch.currentQuantity < input.quantityUsed) {
        throw AppError.conflict(`Insufficient batch quantity in batch '${batch?.batchNumber || batchId}'`);
      }
      await tx.inventoryBatch.update({
        where: { id: batchId },
        data: { currentQuantity: { decrement: input.quantityUsed } },
      });
    }

    // 2. Decrement location stock if exists
    const locStock = await tx.locationStock.findFirst({
      where: {
        itemId: item.id,
        location,
        ...(batchId ? { batchId } : {}),
      },
    });

    if (locStock && locStock.quantity >= input.quantityUsed) {
      await tx.locationStock.update({
        where: { id: locStock.id },
        data: { quantity: { decrement: input.quantityUsed } },
      });
    }

    // 3. Update main item stock
    const updatedItem = await tx.inventoryItem.update({
      where: { id: item.id },
      data: { quantity: { decrement: input.quantityUsed } },
    });

    const unitPrice = Number(item.unitPrice || 0);
    const totalCost = new Prisma.Decimal(unitPrice * input.quantityUsed);

    // 4. Record Module 11 StockTransaction for auditable consumption
    const txnNumber = `TXN-PM-${Date.now().toString().slice(-6)}`;
    const txn = await tx.stockTransaction.create({
      data: {
        transactionNumber: txnNumber,
        type: 'MAINTENANCE_PARTS',
        itemId: item.id,
        batchId: batchId || null,
        sourceLocation: location,
        quantity: input.quantityUsed,
        balanceBefore: item.quantity,
        balanceAfter: updatedItem.quantity,
        reference: input.serviceTicketId || input.pmScheduleId || eq.assetTag || 'MAINTENANCE',
        reason: `Maintenance spares used on ${eq.name}: ${input.reason}`,
        unitCost: item.unitPrice,
        totalValue: totalCost,
        performedById: input.installedById,
        performedByName: input.installedByName || 'Biomedical Engineer',
      },
    });

    // 5. Create MaintenancePartUsage
    const partUsage = await tx.maintenancePartUsage.create({
      data: {
        equipmentId: eq.id,
        serviceTicketId: input.serviceTicketId || null,
        pmScheduleId: input.pmScheduleId || null,
        inventoryItemId: item.id,
        batchId: batchId || null,
        stockTransactionId: txn.id,
        location,
        quantityUsed: input.quantityUsed,
        unitCost: item.unitPrice,
        totalCost,
        reason: input.reason.trim(),
        installedById: input.installedById,
        installedByName: input.installedByName || 'Biomedical Engineer',
      },
      include: {
        equipment: true,
        inventoryItem: true,
        batch: true,
      },
    });

    await logAuditEvent({
      userId: context?.userId || input.installedById,
      action: 'MAINTENANCE_PART_CONSUMED',
      entityType: 'MaintenancePartUsage',
      entityId: partUsage.id,
      details: {
        equipment: eq.name,
        itemCode: item.itemCode,
        quantityUsed: input.quantityUsed,
        stockTransactionId: txn.id,
      },
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return partUsage;
  });
}

export async function listMaintenancePartUsages(equipmentId?: string, serviceTicketId?: string) {
  const where: Prisma.MaintenancePartUsageWhereInput = {};
  if (equipmentId) where.equipmentId = equipmentId;
  if (serviceTicketId) where.serviceTicketId = serviceTicketId;

  return prisma.maintenancePartUsage.findMany({
    where,
    include: {
      equipment: true,
      inventoryItem: true,
      batch: true,
      serviceTicket: true,
    },
    orderBy: { installedAt: 'desc' },
  });
}

// ============================================================================
// 8. SERVICE HISTORY
// ============================================================================

export async function getEquipmentServiceHistory(equipmentId: string) {
  const eq = await prisma.equipment.findUnique({
    where: { id: equipmentId },
    include: {
      serviceRecords: { orderBy: { serviceDate: 'desc' } },
      pmSchedules: { where: { status: 'COMPLETED' }, orderBy: { completedAt: 'desc' } },
      serviceTickets: { orderBy: { openedAt: 'desc' } },
      certificates: { orderBy: { issueDate: 'desc' } },
      downtimes: { orderBy: { startTime: 'desc' } },
      partsUsages: { include: { inventoryItem: true }, orderBy: { installedAt: 'desc' } },
      qcChecks: { orderBy: { checkDate: 'desc' }, take: 10 },
    },
  });

  if (!eq) {
    throw AppError.notFound(`Equipment '${equipmentId}' not found`);
  }

  return {
    equipment: {
      id: eq.id,
      assetTag: eq.assetTag,
      name: eq.name,
      modality: eq.modality,
      serialNumber: eq.serialNumber,
      status: eq.status,
      location: eq.location,
    },
    totalServiceCount: eq.serviceRecords.length,
    serviceRecords: eq.serviceRecords,
    completedPmCount: eq.pmSchedules.length,
    completedPms: eq.pmSchedules,
    breakdownTickets: eq.serviceTickets,
    serviceTickets: eq.serviceTickets,
    calibrationCertificates: eq.certificates,
    certificates: eq.certificates,
    downtimes: eq.downtimes,
    downtimeLogs: eq.downtimes,
    partsConsumed: eq.partsUsages,
    partsUsages: eq.partsUsages,
    recentQcChecks: eq.qcChecks,
    qcChecks: eq.qcChecks,
  };
}

export async function createServiceRecord(
  input: {
    equipmentId: string;
    serviceType?: string;
    serviceDate?: string;
    serviceProvider?: string;
    vendorName?: string;
    engineerName?: string;
    workDescription?: string;
    serviceSummary?: string;
    partsReplaced?: string;
    findingsAndRecommendations?: string;
    statusBefore?: EquipmentStatus;
    statusAfter?: EquipmentStatus;
    cost?: number;
    totalCost?: number;
    serviceTicketId?: string;
    pmScheduleId?: string;
  },
  context?: AuditContext
) {
  const eq = await prisma.equipment.findUnique({ where: { id: input.equipmentId } });
  if (!eq) throw AppError.notFound(`Equipment '${input.equipmentId}' not found`);

  const recordNumber = generateServiceRecordNumber();
  const serviceDate = input.serviceDate ? new Date(input.serviceDate) : new Date();
  const cost = input.cost !== undefined ? input.cost : input.totalCost;

  const record = await prisma.serviceRecord.create({
    data: {
      recordNumber,
      equipmentId: eq.id,
      serviceType: input.serviceType || 'PREVENTIVE_MAINTENANCE',
      serviceDate,
      serviceProvider: (input.serviceProvider || input.vendorName || 'OEM Service Specialist').trim(),
      engineerName: (input.engineerName || 'Field Engineer').trim(),
      workDescription: (input.workDescription || input.serviceSummary || 'Standard maintenance routine executed').trim(),
      partsReplaced: input.partsReplaced?.trim() || null,
      findingsAndRecommendations: input.findingsAndRecommendations?.trim() || null,
      statusBefore: input.statusBefore || EquipmentStatus.OUT_OF_SERVICE,
      statusAfter: input.statusAfter || EquipmentStatus.AVAILABLE,
      cost: cost !== undefined ? new Prisma.Decimal(cost) : null,
      serviceTicketId: input.serviceTicketId || null,
      pmScheduleId: input.pmScheduleId || null,
    },
    include: { equipment: true },
  });

  await logAuditEvent({
    userId: context?.userId,
    action: 'SERVICE_RECORD_CREATED',
    entityType: 'ServiceRecord',
    entityId: record.id,
    details: {
      recordNumber: record.recordNumber,
      equipment: eq.name,
      serviceType: record.serviceType,
    },
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
  });

  return record;
}

// ============================================================================
// 9. CALIBRATION / TEST CERTIFICATES
// ============================================================================

export async function recordCalibrationCertificate(
  input: {
    equipmentId: string;
    certificateNumber?: string;
    certificationType: string; // 'RADIATION_SAFETY_AERB', 'DOSIMETRY_CALIBRATION', 'ELECTRICAL_SAFETY', 'QA_PHANTOM_ALIGNMENT'
    issuingAuthority: string;
    issueDate: string;
    expiryDate: string;
    documentReference?: string;
    measuredValues?: any;
    passed?: boolean;
    certifiedByName: string;
    remarks?: string;
  },
  context?: AuditContext
) {
  const eq = await prisma.equipment.findUnique({ where: { id: input.equipmentId } });
  if (!eq) throw AppError.notFound(`Equipment '${input.equipmentId}' not found`);

  const issueDate = new Date(input.issueDate);
  const expiryDate = new Date(input.expiryDate);
  if (isNaN(issueDate.getTime()) || isNaN(expiryDate.getTime())) {
    throw AppError.badRequest('Valid issue date and expiry date are required');
  }

  const certNumber = input.certificateNumber?.trim() || generateCertificateNumber();
  const now = new Date();
  const status = expiryDate < now ? 'EXPIRED' : (expiryDate.getTime() - now.getTime()) < (30 * 86400000) ? 'EXPIRING_SOON' : 'VALID';

  const cert = await prisma.calibrationCertificate.create({
    data: {
      certificateNumber: certNumber,
      equipmentId: eq.id,
      certificationType: input.certificationType,
      issuingAuthority: input.issuingAuthority.trim(),
      issueDate,
      expiryDate,
      status,
      documentReference: input.documentReference?.trim() || null,
      measuredValues: input.measuredValues || null,
      passed: input.passed ?? true,
      certifiedByName: input.certifiedByName.trim(),
      remarks: input.remarks?.trim() || null,
    },
    include: { equipment: true },
  });

  await logAuditEvent({
    userId: context?.userId,
    action: 'CALIBRATION_CERTIFICATE_RECORDED',
    entityType: 'CalibrationCertificate',
    entityId: cert.id,
    details: {
      certificateNumber: cert.certificateNumber,
      equipment: eq.name,
      certificationType: cert.certificationType,
      expiryDate: cert.expiryDate,
    },
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
  });

  return cert;
}

export async function listCalibrationCertificates(filters?: {
  equipmentId?: string;
  status?: string;
}) {
  const where: Prisma.CalibrationCertificateWhereInput = {};
  if (filters?.equipmentId) where.equipmentId = filters.equipmentId;
  if (filters?.status) where.status = filters.status;

  const certs = await prisma.calibrationCertificate.findMany({
    where,
    include: { equipment: true },
    orderBy: { expiryDate: 'asc' },
  });

  // Dynamically update status based on date
  const now = new Date();
  return certs.map((c) => {
    const isExpired = new Date(c.expiryDate) < now;
    const isExpiring = !isExpired && (new Date(c.expiryDate).getTime() - now.getTime()) < (30 * 86400000);
    return {
      ...c,
      isExpired,
      isExpiring,
      computedStatus: isExpired ? 'EXPIRED' : isExpiring ? 'EXPIRING_SOON' : 'VALID',
    };
  });
}

// ============================================================================
// 10. AMC / WARRANTY TRACKER
// ============================================================================

export async function recordMaintenanceContract(
  input: {
    equipmentId: string;
    contractNumber?: string;
    contractType?: string; // 'WARRANTY', 'AMC_COMPREHENSIVE', 'CMC', 'ON_DEMAND'
    vendorName: string;
    vendorContact?: string;
    startDate: string;
    endDate: string;
    coverageDetails: string;
    annualCost?: number;
    responseSlaHours?: number;
    contactPerson?: string;
    escalationContact?: string;
  },
  context?: AuditContext
) {
  const eq = await prisma.equipment.findUnique({ where: { id: input.equipmentId } });
  if (!eq) throw AppError.notFound(`Equipment '${input.equipmentId}' not found`);

  const start = new Date(input.startDate);
  const end = new Date(input.endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw AppError.badRequest('Valid contract start and end dates are required');
  }

  const contractNumber = input.contractNumber?.trim() || generateContractNumber();
  const now = new Date();
  const status = end < now ? 'EXPIRED' : (end.getTime() - now.getTime()) < (30 * 86400000) ? 'EXPIRING_SOON' : 'ACTIVE';

  const contract = await prisma.maintenanceContract.create({
    data: {
      contractNumber,
      equipmentId: eq.id,
      contractType: input.contractType || 'AMC_COMPREHENSIVE',
      vendorName: input.vendorName.trim(),
      vendorContact: input.vendorContact?.trim() || null,
      startDate: start,
      endDate: end,
      coverageDetails: input.coverageDetails.trim(),
      annualCost: input.annualCost !== undefined ? new Prisma.Decimal(input.annualCost) : null,
      responseSlaHours: input.responseSlaHours || 4,
      status,
      contactPerson: input.contactPerson?.trim() || null,
      escalationContact: input.escalationContact?.trim() || null,
    },
    include: { equipment: true },
  });

  await logAuditEvent({
    userId: context?.userId,
    action: 'MAINTENANCE_CONTRACT_RECORDED',
    entityType: 'MaintenanceContract',
    entityId: contract.id,
    details: {
      contractNumber: contract.contractNumber,
      equipment: eq.name,
      vendorName: contract.vendorName,
      endDate: contract.endDate,
    },
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
  });

  return contract;
}

export async function listMaintenanceContracts(filters?: {
  equipmentId?: string;
  status?: string;
}) {
  const where: Prisma.MaintenanceContractWhereInput = {};
  if (filters?.equipmentId) where.equipmentId = filters.equipmentId;
  if (filters?.status) where.status = filters.status;

  const contracts = await prisma.maintenanceContract.findMany({
    where,
    include: { equipment: true },
    orderBy: { endDate: 'asc' },
  });

  const now = new Date();
  return contracts.map((c) => {
    const isExpired = new Date(c.endDate) < now;
    const isExpiring = !isExpired && (new Date(c.endDate).getTime() - now.getTime()) < (30 * 86400000);
    return {
      ...c,
      isExpired,
      isExpiring,
      computedStatus: isExpired ? 'EXPIRED' : isExpiring ? 'EXPIRING_SOON' : 'ACTIVE',
    };
  });
}

// ============================================================================
// 11. ENGINEER / SUPPLIER CONTACTS
// ============================================================================

export async function createServiceContact(
  input: {
    vendorName: string;
    contactName?: string;
    contactPerson?: string;
    role?: string;
    email?: string;
    phone: string;
    alternatePhone?: string;
    emergencyPhone?: string;
    escalationLevel?: number;
    isEmergencyContact?: boolean;
    supportHours?: string;
    notes?: string;
    equipmentSpecialty?: string;
    vendorAddress?: string;
    equipmentIds?: string[];
  },
  context?: AuditContext
) {
  const name = (input.contactName || input.contactPerson || '').trim();
  if (!input.vendorName || !name || !input.phone) {
    throw AppError.badRequest('Vendor name, contact person name and phone number are required');
  }

  const contact = await prisma.serviceContact.create({
    data: {
      vendorName: input.vendorName.trim(),
      contactName: name,
      role: (input.role || 'Service Specialist').trim(),
      email: (input.email || 'support@vendor.local').trim(),
      phone: input.phone.trim(),
      emergencyPhone: (input.emergencyPhone || input.alternatePhone)?.trim() || null,
      escalationLevel: input.escalationLevel ? Number(input.escalationLevel) : (input.isEmergencyContact ? 1 : 2),
      equipmentSpecialty: (input.equipmentSpecialty || input.notes)?.trim() || null,
      vendorAddress: input.vendorAddress?.trim() || null,
      equipmentIds: input.equipmentIds || [],
    },
  });

  await logAuditEvent({
    userId: context?.userId,
    action: 'SERVICE_CONTACT_CREATED',
    entityType: 'ServiceContact',
    entityId: contact.id,
    details: {
      vendorName: contact.vendorName,
      contactName: contact.contactName,
    },
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
  });

  return {
    ...contact,
    contactPerson: contact.contactName,
    isEmergencyContact: contact.escalationLevel === 1 || Boolean(input.isEmergencyContact),
  };
}

export async function listServiceContacts(filters?: { vendorName?: string; role?: string }) {
  await ensureDefaultMaintenanceData();

  const where: Prisma.ServiceContactWhereInput = { active: true };
  if (filters?.vendorName) where.vendorName = { contains: filters.vendorName, mode: 'insensitive' };
  if (filters?.role) where.role = { contains: filters.role, mode: 'insensitive' };

  const contacts = await prisma.serviceContact.findMany({
    where,
    orderBy: [{ escalationLevel: 'asc' }, { vendorName: 'asc' }],
  });

  return contacts.map((c) => ({
    ...c,
    contactPerson: c.contactName,
    isEmergencyContact: c.escalationLevel === 1,
  }));
}

// ============================================================================
// 12. MACHINE AVAILABILITY STATUS & SCHEDULING INTERACTION
// ============================================================================

export async function setEquipmentAvailabilityStatus(
  equipmentId: string,
  input: {
    status: EquipmentStatus;
    reason?: string;
    performedById: string;
    performedByName?: string;
  },
  context?: AuditContext
) {
  const eq = await prisma.equipment.findUnique({ where: { id: equipmentId } });
  if (!eq) throw AppError.notFound(`Equipment '${equipmentId}' not found`);

  const prevStatus = eq.status;
  const newStatus = input.status;

  // Check affected upcoming appointments if transitioning out of active service
  const now = new Date();
  const willAffectScheduling = newStatus === EquipmentStatus.MAINTENANCE ||
    newStatus === EquipmentStatus.UNDER_PM ||
    newStatus === EquipmentStatus.OUT_OF_SERVICE;

  let affectedAppointments: any[] = [];
  if (willAffectScheduling) {
    affectedAppointments = await prisma.appointment.findMany({
      where: {
        equipmentId: eq.id,
        scheduledStart: { gte: now },
        status: { in: ['SCHEDULED'] },
      },
      include: {
        patient: { select: { patientId: true, firstName: true, lastName: true, phone: true } },
      },
      orderBy: { scheduledStart: 'asc' },
      take: 20,
    });
  }

  const updated = await prisma.equipment.update({
    where: { id: equipmentId },
    data: { status: newStatus },
  });

  await logAuditEvent({
    userId: context?.userId || input.performedById,
    action: 'EQUIPMENT_STATUS_CHANGED',
    entityType: 'Equipment',
    entityId: updated.id,
    details: {
      equipment: updated.name,
      previousStatus: prevStatus,
      newStatus,
      reason: input.reason,
      affectedAppointmentsCount: affectedAppointments.length,
    },
    ipAddress: context?.ipAddress,
    userAgent: context?.userAgent,
  });

  return {
    equipment: updated,
    previousStatus: prevStatus,
    newStatus,
    affectedAppointmentsCount: affectedAppointments.length,
    affectedAppointments,
  };
}

export async function getEquipmentAvailabilitySummary() {
  await ensureDefaultMaintenanceData();

  const allEquipment = await prisma.equipment.findMany({
    where: { active: true },
    select: {
      id: true,
      assetTag: true,
      name: true,
      modality: true,
      assetCategory: true,
      status: true,
      location: true,
      nextMaintenanceDate: true,
      lastMaintenanceDate: true,
    },
    orderBy: { name: 'asc' },
  });

  const availableCount = allEquipment.filter((e) => e.status === EquipmentStatus.AVAILABLE || e.status === EquipmentStatus.OPERATIONAL).length;
  const underPmCount = allEquipment.filter((e) => e.status === EquipmentStatus.MAINTENANCE || e.status === EquipmentStatus.UNDER_PM).length;
  const outOfServiceCount = allEquipment.filter((e) => e.status === EquipmentStatus.OUT_OF_SERVICE).length;

  const statusBreakdown: Record<string, number> = {
    AVAILABLE: allEquipment.filter((e) => e.status === EquipmentStatus.AVAILABLE).length,
    OPERATIONAL: allEquipment.filter((e) => e.status === EquipmentStatus.OPERATIONAL).length,
    BUSY: allEquipment.filter((e) => e.status === EquipmentStatus.BUSY).length,
    MAINTENANCE: allEquipment.filter((e) => e.status === EquipmentStatus.MAINTENANCE).length,
    UNDER_PM: allEquipment.filter((e) => e.status === EquipmentStatus.UNDER_PM).length,
    OUT_OF_SERVICE: allEquipment.filter((e) => e.status === EquipmentStatus.OUT_OF_SERVICE).length,
  };

  const activeDowntimes = await prisma.equipmentDowntime.findMany({
    where: { endTime: null },
    include: { equipment: true, serviceTicket: true },
    orderBy: { startTime: 'desc' },
  });

  return {
    totalEquipment: allEquipment.length,
    totalUnits: allEquipment.length,
    availableUnits: availableCount,
    underPmUnits: underPmCount,
    outOfServiceUnits: outOfServiceCount,
    statusBreakdown,
    equipment: allEquipment,
    equipmentList: allEquipment,
    activeDowntimesCount: activeDowntimes.length,
    activeDowntimes,
  };
}

// ============================================================================
// 13. MAINTENANCE REMINDERS
// ============================================================================

export async function getMaintenanceReminders(upcomingDays: number = 14) {
  await ensureDefaultMaintenanceData();

  const now = new Date();
  const futureThreshold = new Date(now.getTime() + upcomingDays * 86400000);
  const contractThreshold = new Date(now.getTime() + 30 * 86400000);

  // 1. Overdue PMs
  const overduePm = await prisma.maintenanceSchedule.findMany({
    where: {
      nextDueDate: { lt: now },
      status: { notIn: ['COMPLETED', 'CANCELLED'] },
    },
    include: { equipment: true },
    orderBy: { nextDueDate: 'asc' },
  });

  // 2. Upcoming PMs
  const upcomingPm = await prisma.maintenanceSchedule.findMany({
    where: {
      nextDueDate: { gte: now, lte: futureThreshold },
      status: { notIn: ['COMPLETED', 'CANCELLED'] },
    },
    include: { equipment: true },
    orderBy: { nextDueDate: 'asc' },
  });

  // 3. Calibration Certs Expiring / Expired
  const expiringCertificates = await prisma.calibrationCertificate.findMany({
    where: {
      expiryDate: { lte: contractThreshold },
    },
    include: { equipment: true },
    orderBy: { expiryDate: 'asc' },
  });

  // 4. Contracts Expiring / Expired
  const expiringContracts = await prisma.maintenanceContract.findMany({
    where: {
      endDate: { lte: contractThreshold },
      status: { not: 'EXPIRED' },
    },
    include: { equipment: true },
    orderBy: { endDate: 'asc' },
  });

  // 5. Active Critical Breakdown Tickets
  const openCriticalTickets = await prisma.serviceTicket.findMany({
    where: {
      status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'AWAITING_PARTS'] },
      priority: { in: ['CRITICAL', 'HIGH'] },
    },
    include: { equipment: true },
    orderBy: { openedAt: 'asc' },
  });

  return {
    alertTimestamp: now.toISOString(),
    daysLookahead: upcomingDays,
    totalReminders:
      overduePm.length +
      upcomingPm.length +
      expiringCertificates.length +
      expiringContracts.length +
      openCriticalTickets.length,
    overduePmCount: overduePm.length,
    overduePm,
    overduePms: overduePm,
    upcomingPmCount: upcomingPm.length,
    upcomingPm,
    upcomingPms: upcomingPm,
    expiringCertificatesCount: expiringCertificates.length,
    expiringCertificates,
    expiringContractsCount: expiringContracts.length,
    expiringContracts,
    openCriticalTicketsCount: openCriticalTickets.length,
    openCriticalTickets,
    openTickets: openCriticalTickets,
  };
}

// ============================================================================
// 14. EQUIPMENT PERFORMANCE ANALYTICS
// ============================================================================

export async function getEquipmentPerformanceAnalytics(filters?: {
  equipmentId?: string;
  periodDays?: number;
}) {
  await ensureDefaultMaintenanceData();

  const periodDays = filters?.periodDays || 30;
  const now = new Date();
  const periodStart = new Date(now.getTime() - periodDays * 86400000);
  const totalPeriodMinutes = periodDays * 24 * 60;

  // 1. Fetch relevant downtimes in period
  const downtimeWhere: Prisma.EquipmentDowntimeWhereInput = {
    startTime: { gte: periodStart },
  };
  if (filters?.equipmentId) downtimeWhere.equipmentId = filters.equipmentId;

  const downtimes = await prisma.equipmentDowntime.findMany({
    where: downtimeWhere,
    include: { equipment: true },
  });

  let totalDowntimeMinutes = 0;
  for (const d of downtimes) {
    if (d.durationMinutes) {
      totalDowntimeMinutes += d.durationMinutes;
    } else {
      // ongoing downtime
      const ongoingMin = Math.round((now.getTime() - new Date(d.startTime).getTime()) / 60000);
      totalDowntimeMinutes += ongoingMin;
    }
  }

  // Uptime Percentage: (1 - totalDowntime / totalPeriod) * 100
  const uptimePercentage = Math.max(0, Math.min(100, Number((((totalPeriodMinutes - totalDowntimeMinutes) / totalPeriodMinutes) * 100).toFixed(2))));

  // 2. Fetch service tickets / failures in period
  const ticketWhere: Prisma.ServiceTicketWhereInput = {
    openedAt: { gte: periodStart },
  };
  if (filters?.equipmentId) ticketWhere.equipmentId = filters.equipmentId;

  const tickets = await prisma.serviceTicket.findMany({
    where: ticketWhere,
    include: { equipment: true },
  });

  const failureCount = tickets.length;

  // Compute Mean Time to Repair (MTTR) in hours
  let totalRepairMinutes = 0;
  let resolvedTicketCount = 0;
  for (const t of tickets) {
    if (t.resolvedAt) {
      const repairMin = Math.round((new Date(t.resolvedAt).getTime() - new Date(t.openedAt).getTime()) / 60000);
      totalRepairMinutes += repairMin;
      resolvedTicketCount++;
    }
  }
  const mttrHours = resolvedTicketCount > 0 ? Number((totalRepairMinutes / resolvedTicketCount / 60).toFixed(2)) : 0;

  // 3. PM Completion Rate in period
  const pmWhere: Prisma.MaintenanceScheduleWhereInput = {
    scheduledDate: { gte: periodStart, lte: now },
  };
  if (filters?.equipmentId) pmWhere.equipmentId = filters.equipmentId;

  const pmsInPeriod = await prisma.maintenanceSchedule.findMany({ where: pmWhere });
  const completedPmInPeriod = pmsInPeriod.filter((p) => p.status === 'COMPLETED').length;
  const pmCompletionRate = pmsInPeriod.length > 0 ? Number(((completedPmInPeriod / pmsInPeriod.length) * 100).toFixed(1)) : 100.0;

  // 4. Per-equipment analytics breakdown
  const allEquipment = await prisma.equipment.findMany({
    where: {
      active: true,
      ...(filters?.equipmentId ? { id: filters.equipmentId } : {}),
    },
    select: { id: true, assetTag: true, name: true, modality: true, assetCategory: true, status: true },
  });

  const equipmentMetrics = allEquipment.map((eq) => {
    const eqDowntimes = downtimes.filter((d) => d.equipmentId === eq.id);
    let eqDowntimeMinutes = 0;
    for (const d of eqDowntimes) {
      eqDowntimeMinutes += d.durationMinutes || Math.round((now.getTime() - new Date(d.startTime).getTime()) / 60000);
    }
    const eqUptime = Math.max(0, Math.min(100, Number((((totalPeriodMinutes - eqDowntimeMinutes) / totalPeriodMinutes) * 100).toFixed(2))));
    const eqFailures = tickets.filter((t) => t.equipmentId === eq.id).length;

    return {
      equipmentId: eq.id,
      assetTag: eq.assetTag,
      name: eq.name,
      modality: eq.modality,
      category: eq.assetCategory,
      status: eq.status,
      downtimeMinutes: eqDowntimeMinutes,
      downtimeHours: Number((eqDowntimeMinutes / 60).toFixed(1)),
      uptimePercentage: eqUptime,
      failureCount: eqFailures,
    };
  });

  const operatingMinutes = Math.max(0, totalPeriodMinutes - totalDowntimeMinutes);
  const mtbfHours = failureCount > 0 ? Number((operatingMinutes / failureCount / 60).toFixed(2)) : Number((operatingMinutes / 60).toFixed(2));

  return {
    periodDays,
    totalPeriodMinutes,
    totalDowntimeMinutes,
    totalDowntimeHours: Number((totalDowntimeMinutes / 60).toFixed(1)),
    uptimePercentage,
    overallUptimePercentage: uptimePercentage,
    breakdownCount: failureCount,
    totalFailureCount: failureCount,
    failureCount,
    mtbfHours,
    mttrHours,
    pmCompletionRate,
    scheduledPmCount: pmsInPeriod.length,
    completedPmCount: completedPmInPeriod,
    equipmentMetrics,
  };
}
