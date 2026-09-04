import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { ResponsiveModal } from '@/shared/components/responsive-modal'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { Textarea } from '@/shared/components/ui/textarea'
import type { Vehicle, VehicleFormValues } from '@/shared/types/domain'

const bodyTypeOptions = ['Sedan', 'Kombi', 'SUV', 'Crossover', 'Kabriolet', 'MiniVan', 'Hatchback', 'Coupe', 'Pickup', 'Ciężarowy'] as const
const transmissionOptions = ['Automat', 'Manual'] as const

const vehicleSchema = z.object({
  name: z.string().trim().min(2, 'Podaj nazwę auta'),
  make: z.string().trim().min(2, 'Podaj markę'),
  model: z.string().trim().min(1, 'Podaj model'),
  year: z.number().int().min(1950).max(2100).optional(),
  currentMileage: z.number().int().min(0).optional(),
  bodyType: z.string().trim().optional(),
  fuelType: z.string().trim().optional(),
  transmission: z.string().trim().optional(),
  engine: z.string().trim().optional(),
  power: z.number().int().min(1).optional(),
  color: z.string().trim().optional(),
  vin: z.string().trim().optional(),
  registrationNumber: z.string().trim().optional(),
  imageUrl: z.string().trim().optional(),
  notes: z.string().trim().optional(),
})

type VehicleValues = z.infer<typeof vehicleSchema>

function toOptionalNumber(value: string) {
  return value === '' ? undefined : Number(value)
}

function toVehicleFormDefaults(vehicle?: Vehicle | null): VehicleValues {
  if (!vehicle) {
    return emptyVehicleValues
  }

  return {
    name: vehicle.name,
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year,
    currentMileage: vehicle.currentMileage,
    bodyType: vehicle.bodyType,
    fuelType: vehicle.fuelType,
    transmission: vehicle.transmission,
    engine: vehicle.engine,
    power: vehicle.power,
    color: vehicle.color,
    vin: vehicle.vin,
    registrationNumber: vehicle.registrationNumber,
    imageUrl: vehicle.imageUrl,
    notes: vehicle.notes,
  }
}

interface VehicleFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialValues?: Vehicle | null
  onSubmit: (values: VehicleFormValues) => Promise<void>
}

const emptyVehicleValues: VehicleValues = {
  name: '',
  make: '',
  model: '',
  year: undefined,
  currentMileage: undefined,
  bodyType: '',
  fuelType: '',
  transmission: '',
  engine: '',
  power: undefined,
  color: '',
  vin: '',
  registrationNumber: '',
  imageUrl: '',
  notes: '',
}

export function VehicleForm({ open, onOpenChange, initialValues, onSubmit }: VehicleFormProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [imageUploadError, setImageUploadError] = useState<string | null>(null)
  const [selectedImageName, setSelectedImageName] = useState('')
  const form = useForm<VehicleValues>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: emptyVehicleValues,
  })
  const imageUrl = form.watch('imageUrl')

  useEffect(() => {
    if (!open) {
      return
    }

    setImageUploadError(null)
    setSelectedImageName('')
    form.reset(
      initialValues ? toVehicleFormDefaults(initialValues) : emptyVehicleValues,
    )
  }, [form, initialValues, open])

  async function handleSubmit(values: VehicleValues) {
    await onSubmit(values)
    onOpenChange(false)
  }

  async function handleImageFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    if (!file.type.startsWith('image/')) {
      setImageUploadError('Wybierz plik graficzny')
      setSelectedImageName('')
      event.target.value = ''
      return
    }

    try {
      const imageDataUrl = await readFileAsDataUrl(file)
      form.setValue('imageUrl', imageDataUrl, { shouldDirty: true })
      setSelectedImageName(file.name)
      setImageUploadError(null)
    } catch {
      setImageUploadError('Nie udało się wczytać zdjęcia')
      setSelectedImageName('')
    }

    event.target.value = ''
  }

  function handleRemoveImage() {
    form.setValue('imageUrl', '', { shouldDirty: true })
    setImageUploadError(null)
    setSelectedImageName('')

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={initialValues ? 'Edytuj auto' : 'Dodaj auto'}
      description="Podstawowe dane są krótkie. Reszta jest schowana niżej."
    >
      <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="vehicle-name">Nazwa</Label>
            <Input id="vehicle-name" placeholder="np. BMW 320d" {...form.register('name')} />
            {form.formState.errors.name ? <p className="text-sm text-red-600">{form.formState.errors.name.message}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="vehicle-make">Marka</Label>
            <Input id="vehicle-make" placeholder="BMW" {...form.register('make')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vehicle-model">Model</Label>
            <Input id="vehicle-model" placeholder="320d" {...form.register('model')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vehicle-year">Rok</Label>
            <Input
              id="vehicle-year"
              type="number"
              inputMode="numeric"
              placeholder="2019"
              {...form.register('year', { setValueAs: toOptionalNumber })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vehicle-mileage">Przebieg</Label>
            <Input
              id="vehicle-mileage"
              type="number"
              inputMode="numeric"
              placeholder="128450"
              {...form.register('currentMileage', { setValueAs: toOptionalNumber })}
            />
          </div>
        </div>

        <details className="rounded-3xl border border-zinc-200 bg-zinc-50 px-4 py-3">
          <summary className="cursor-pointer list-none text-sm font-semibold text-zinc-900">Więcej informacji</summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="vehicle-body">Typ nadwozia</Label>
              <Select value={form.watch('bodyType') || undefined} onValueChange={(value) => form.setValue('bodyType', value)}>
                <SelectTrigger id="vehicle-body" aria-label="Typ nadwozia">
                  <SelectValue placeholder="Wybierz typ nadwozia" />
                </SelectTrigger>
                <SelectContent>
                  {bodyTypeOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehicle-fuel">Paliwo</Label>
              <Input id="vehicle-fuel" placeholder="Diesel" {...form.register('fuelType')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehicle-transmission">Skrzynia</Label>
              <Select value={form.watch('transmission') || undefined} onValueChange={(value) => form.setValue('transmission', value)}>
                <SelectTrigger id="vehicle-transmission" aria-label="Skrzynia">
                  <SelectValue placeholder="Wybierz skrzynię" />
                </SelectTrigger>
                <SelectContent>
                  {transmissionOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehicle-engine">Silnik</Label>
              <Input id="vehicle-engine" placeholder="2.0 190 KM" {...form.register('engine')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehicle-power">Moc</Label>
              <Input
                id="vehicle-power"
                type="number"
                inputMode="numeric"
                placeholder="190"
                {...form.register('power', { setValueAs: toOptionalNumber })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehicle-color">Kolor</Label>
              <Input id="vehicle-color" placeholder="Grafitowy" {...form.register('color')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehicle-registration">Rejestracja</Label>
              <Input id="vehicle-registration" placeholder="KR 1234X" {...form.register('registrationNumber')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehicle-vin">VIN</Label>
              <Input id="vehicle-vin" placeholder="WBA..." {...form.register('vin')} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="vehicle-image">Dodaj zdjęcie z dysku</Label>
              <div className="rounded-3xl border border-zinc-200 bg-white px-4 py-3">
                <input
                  ref={fileInputRef}
                  id="vehicle-image"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => void handleImageFileChange(event)}
                />
                <div className="flex flex-wrap items-center justify-center gap-3 text-center">
                  <label
                    htmlFor="vehicle-image"
                    className="inline-flex h-9 cursor-pointer items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-medium text-zinc-800 transition hover:border-zinc-300 hover:bg-zinc-100"
                  >
                    Wybierz plik
                  </label>
                  <p className="text-sm text-zinc-500">
                    {selectedImageName ? selectedImageName : '(nie wybrano pliku)'}
                  </p>
                </div>
              </div>
              {imageUploadError ? <p className="text-sm text-red-600">{imageUploadError}</p> : null}
              {imageUrl ? (
                <div className="space-y-3 rounded-3xl border border-zinc-200 bg-white p-3">
                  <img src={imageUrl} alt="Podgląd zdjęcia auta" className="h-40 w-full rounded-2xl object-cover" />
                  <Button type="button" variant="ghost" onClick={handleRemoveImage}>
                    Usuń zdjęcie
                  </Button>
                </div>
              ) : null}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="vehicle-notes">Notatki</Label>
              <Textarea id="vehicle-notes" placeholder="Krótka notatka o aucie" {...form.register('notes')} />
            </div>
          </div>
        </details>

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Anuluj
          </Button>
          <Button type="submit" data-testid="vehicle-submit">
            {initialValues ? 'Zapisz auto' : 'Dodaj auto'}
          </Button>
        </div>
      </form>
    </ResponsiveModal>
  )
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }

      reject(new Error('Invalid file result'))
    }

    reader.onerror = () => reject(reader.error ?? new Error('File read failed'))
    reader.readAsDataURL(file)
  })
}
