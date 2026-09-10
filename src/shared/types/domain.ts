export type ServiceCategory =
  | 'inspection'
  | 'periodic_service'
  | 'diagnostics'
  | 'repair'
  | 'oil_fluids'
  | 'brakes'
  | 'tires_wheels'
  | 'suspension_steering'
  | 'engine_drivetrain'
  | 'electrical'
  | 'body_paint'
  | 'detailing'
  | 'tuning'
  | 'documents'
  | 'other'

export interface UserProfile {
  id: string
  username: string
  displayName?: string
  createdAt: string
  updatedAt: string
}

export interface Vehicle {
  id: string
  profileId: string
  name: string
  make: string
  model: string
  year?: number
  bodyType?: string
  fuelType?: string
  transmission?: string
  engine?: string
  power?: number
  color?: string
  vin?: string
  registrationNumber?: string
  currentMileage?: number
  imageUrl?: string
  notes?: string
  archived?: boolean
  createdAt: string
  updatedAt: string
}

export interface ServiceEvent {
  id: string
  profileId: string
  vehicleId: string
  status: 'completed' | 'planned' | 'cancelled'
  category: ServiceCategory
  title: string
  eventDate?: string
  mileage?: number
  description?: string
  workshopName?: string
  workshopLocation?: WorkshopLocation
  partsCost?: number
  laborCost?: number
  otherCost?: number
  currency: 'PLN'
  attachmentCount?: number
  attachmentNames?: string[]
  attachments?: ServiceAttachment[]
  isRecurring?: boolean
  recurrenceType?: 'time' | 'mileage'
  recurrenceIntervalValue?: number
  recurrenceIntervalUnit?: 'days' | 'weeks' | 'months' | 'years'
  recurrenceMileageInterval?: number
  createdAt: string
  updatedAt: string
}

export interface WorkshopLocation {
  placeId: string
  label: string
  address?: string
  lat: number
  lng: number
}

export interface AppStateRecord {
  key: string
  value: string
}

export interface ProfileCreateInput {
  username: string
  displayName?: string
}

export interface LoginCredentials {
  username: string
  password: string
}

export interface RegisterCredentials {
  username: string
  password: string
  displayName?: string
}

export interface AuthCredentialRecord {
  profileId: string
  username: string
  passwordHash: string
  passwordSalt: string
  createdAt: string
  updatedAt: string
}

export interface VehicleFormValues {
  name: string
  make: string
  model: string
  year?: number
  bodyType?: string
  fuelType?: string
  transmission?: string
  engine?: string
  power?: number
  color?: string
  vin?: string
  registrationNumber?: string
  currentMileage?: number
  imageUrl?: string
  notes?: string
}

export interface ServiceEventFormValues {
  status: 'completed' | 'planned'
  category: ServiceCategory
  title: string
  eventDate?: string
  mileage?: number
  description?: string
  workshopName?: string
  workshopLocation?: WorkshopLocation
  partsCost?: number
  laborCost?: number
  otherCost?: number
  attachmentCount?: number
  attachmentNames?: string[]
  attachments?: ServiceAttachment[]
  isRecurring?: boolean
  recurrenceType?: 'time' | 'mileage'
  recurrenceIntervalValue?: number
  recurrenceIntervalUnit?: 'days' | 'weeks' | 'months' | 'years'
  recurrenceMileageInterval?: number
}

export type ServiceTab = 'history' | 'plan'

export interface ServiceAttachment {
  id: string
  name: string
  mimeType?: string
  previewUrl?: string
}
