import type { ServiceCategory } from '@/shared/types/domain'

export const serviceCategoryValues = [
  'inspection',
  'periodic_service',
  'diagnostics',
  'repair',
  'oil_fluids',
  'brakes',
  'tires_wheels',
  'suspension_steering',
  'engine_drivetrain',
  'electrical',
  'body_paint',
  'detailing',
  'tuning',
  'documents',
  'other',
] as const satisfies readonly ServiceCategory[]

export const serviceCategoryOptions: Array<{ value: ServiceCategory; label: string }> = [
  { value: serviceCategoryValues[0], label: 'Przegląd' },
  { value: serviceCategoryValues[1], label: 'Serwis okresowy' },
  { value: serviceCategoryValues[2], label: 'Diagnostyka' },
  { value: serviceCategoryValues[3], label: 'Naprawa' },
  { value: serviceCategoryValues[4], label: 'Oleje i płyny' },
  { value: serviceCategoryValues[5], label: 'Hamulce' },
  { value: serviceCategoryValues[6], label: 'Opony i koła' },
  { value: serviceCategoryValues[7], label: 'Zawieszenie i układ kierowniczy' },
  { value: serviceCategoryValues[8], label: 'Silnik i napęd' },
  { value: serviceCategoryValues[9], label: 'Elektryka' },
  { value: serviceCategoryValues[10], label: 'Blacharka i lakier' },
  { value: serviceCategoryValues[11], label: 'Detailing' },
  { value: serviceCategoryValues[12], label: 'Tuning' },
  { value: serviceCategoryValues[13], label: 'Dokumenty' },
  { value: serviceCategoryValues[14], label: 'Inne' },
]

export const serviceCategoryLabels = Object.fromEntries(
  serviceCategoryOptions.map((option) => [option.value, option.label]),
) as Record<ServiceCategory, string>
