import audiSuv from '@/shared/assets/vehicles/audi-suv.svg'
import bmwSedan from '@/shared/assets/vehicles/bmw-sedan.svg'
import porscheCoupe from '@/shared/assets/vehicles/porsche-coupe.svg'

export const vehicleImageOptions = [
  { value: bmwSedan, label: 'Sedan' },
  { value: audiSuv, label: 'SUV' },
  { value: porscheCoupe, label: 'Coupe' },
] as const

export function getDefaultVehicleImage(bodyType?: string) {
  const value = bodyType?.toLowerCase()

  if (value?.includes('suv')) {
    return audiSuv
  }

  if (value?.includes('coupe')) {
    return porscheCoupe
  }

  return bmwSedan
}
