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
import { serviceCategoryOptions, serviceCategoryValues } from '@/shared/constants/service-categories'
import { buildServiceAttachments, normalizeServiceAttachments } from '@/shared/lib/attachments'
import { formatCurrency } from '@/shared/lib/format'
import { getTodayIsoDate } from '@/shared/lib/utils'
import type { ServiceAttachment, ServiceEvent, ServiceEventFormValues } from '@/shared/types/domain'

const supportedAttachmentExtensions = ['txt', 'pdf', 'csv', 'xls', 'xlsx', 'doc', 'docx', 'rtf', 'odt', 'ods', 'xml', 'json', 'jpg', 'jpeg', 'png']
const supportedAttachmentMimeTypes = [
  'text/plain',
  'application/pdf',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/rtf',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/xml',
  'text/xml',
  'application/json',
  'image/jpeg',
  'image/png',
]
const attachmentAcceptValue = 'image/jpeg,image/png,.jpg,.jpeg,.png,.txt,.pdf,.csv,.xls,.xlsx,.doc,.docx,.rtf,.odt,.ods,.xml,.json'
const recurrenceUnitOptions = [
  { value: 'days', label: 'Dni' },
  { value: 'weeks', label: 'Tygodni' },
  { value: 'months', label: 'Miesięcy' },
  { value: 'years', label: 'Lat' },
] as const

const serviceEventSchema = z.object({
  status: z.enum(['completed', 'planned']),
  category: z.enum(serviceCategoryValues),
  title: z.string().trim().min(2, 'Podaj tytuł'),
  eventDate: z.string().optional(),
  mileage: z.number().int().min(0).optional(),
  laborCost: z.number().min(0).optional(),
  partsCost: z.number().min(0).optional(),
  otherCost: z.number().min(0).optional(),
  description: z.string().trim().optional(),
  workshopName: z.string().trim().optional(),
  attachmentCount: z.number().int().min(0).optional(),
  isRecurring: z.boolean().optional(),
  recurrenceType: z.enum(['time', 'mileage']).optional(),
  recurrenceIntervalValue: z.number().int().min(1).optional(),
  recurrenceIntervalUnit: z.enum(['days', 'weeks', 'months', 'years']).optional(),
  recurrenceMileageInterval: z.number().int().min(1).optional(),
}).superRefine((values, context) => {
  if (values.status !== 'planned' || !values.isRecurring) {
    return
  }

  if (!values.recurrenceType) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['recurrenceType'],
      message: 'Wybierz typ powtarzania',
    })
  }

  if (values.recurrenceType === 'time') {
    if (!values.recurrenceIntervalValue) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['recurrenceIntervalValue'],
        message: 'Podaj liczbę dla interwału okresowego',
      })
    }

    if (!values.recurrenceIntervalUnit) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['recurrenceIntervalUnit'],
        message: 'Wybierz jednostkę czasu',
      })
    }
  }

  if (values.recurrenceType === 'mileage' && !values.recurrenceMileageInterval) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['recurrenceMileageInterval'],
      message: 'Podaj co ile kilometrów ma się powtarzać serwis',
    })
  }
})

type ServiceEventValues = z.infer<typeof serviceEventSchema>

interface ServiceEventFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialValues?: ServiceEvent | null
  defaultStatus?: 'completed' | 'planned'
  onSubmit: (values: ServiceEventFormValues) => Promise<void>
}

const emptyValues: ServiceEventValues = {
  status: 'completed',
  category: 'periodic_service',
  title: '',
  eventDate: getTodayIsoDate(),
  mileage: undefined,
  laborCost: undefined,
  partsCost: undefined,
  otherCost: undefined,
  description: '',
  workshopName: '',
  attachmentCount: 0,
  isRecurring: false,
  recurrenceType: 'time',
  recurrenceIntervalValue: undefined,
  recurrenceIntervalUnit: 'months',
  recurrenceMileageInterval: undefined,
}

function toOptionalNumber(value: string) {
  return value === '' ? undefined : Number(value)
}

function toServiceEventFormDefaults(event?: ServiceEvent | null): ServiceEventValues {
  if (!event) {
    return emptyValues
  }

  return {
    status: event.status === 'planned' ? 'planned' : 'completed',
    category: event.category,
    title: event.title,
    eventDate: event.eventDate,
    mileage: event.mileage,
    laborCost: event.laborCost,
    partsCost: event.partsCost,
    otherCost: event.otherCost,
    description: event.description,
    workshopName: event.workshopName,
    attachmentCount: event.attachmentCount,
    isRecurring: event.isRecurring ?? false,
    recurrenceType: event.recurrenceType ?? 'time',
    recurrenceIntervalValue: event.recurrenceIntervalValue,
    recurrenceIntervalUnit: event.recurrenceIntervalUnit ?? 'months',
    recurrenceMileageInterval: event.recurrenceMileageInterval,
  }
}

function valuesTitle(status: 'completed' | 'planned') {
  return status === 'completed' ? 'Dodaj serwis' : 'Zaplanuj serwis'
}

export function ServiceEventForm({
  open,
  onOpenChange,
  initialValues,
  defaultStatus = 'completed',
  onSubmit,
}: ServiceEventFormProps) {
  const attachmentInputRef = useRef<HTMLInputElement | null>(null)
  const [attachments, setAttachments] = useState<ServiceAttachment[]>([])
  const [pendingAttachmentFiles, setPendingAttachmentFiles] = useState<File[]>([])
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  const form = useForm<ServiceEventValues>({
    resolver: zodResolver(serviceEventSchema),
    defaultValues: { ...emptyValues, status: defaultStatus },
  })
  const status = form.watch('status')
  const isRecurring = form.watch('isRecurring') ?? false
  const recurrenceType = form.watch('recurrenceType') ?? 'time'
  const totalCost = (form.watch('laborCost') ?? 0) + (form.watch('partsCost') ?? 0) + (form.watch('otherCost') ?? 0)
  const attachmentCount = form.watch('attachmentCount') ?? 0

  useEffect(() => {
    if (!open) {
      return
    }

    setAttachments(normalizeServiceAttachments(initialValues ?? {}))
    setPendingAttachmentFiles([])
    setAttachmentError(null)
    form.reset(
      initialValues
        ? toServiceEventFormDefaults(initialValues)
        : {
            ...emptyValues,
            status: defaultStatus,
            eventDate: defaultStatus === 'planned' ? '' : getTodayIsoDate(),
          },
    )
  }, [defaultStatus, form, initialValues, open])

  async function handleSubmit(values: ServiceEventValues) {
    const serializedAttachments = pendingAttachmentFiles.length > 0 ? await buildServiceAttachments(pendingAttachmentFiles) : attachments

    await onSubmit({
      ...values,
      isRecurring: values.status === 'planned' ? values.isRecurring : false,
      recurrenceType: values.status === 'planned' && values.isRecurring ? values.recurrenceType : undefined,
      recurrenceIntervalValue: values.status === 'planned' && values.isRecurring && values.recurrenceType === 'time' ? values.recurrenceIntervalValue : undefined,
      recurrenceIntervalUnit: values.status === 'planned' && values.isRecurring && values.recurrenceType === 'time' ? values.recurrenceIntervalUnit : undefined,
      recurrenceMileageInterval: values.status === 'planned' && values.isRecurring && values.recurrenceType === 'mileage' ? values.recurrenceMileageInterval : undefined,
      attachmentCount: serializedAttachments.length,
      attachmentNames: serializedAttachments.length > 0 ? serializedAttachments.map((attachment) => attachment.name) : undefined,
      attachments: serializedAttachments.length > 0 ? serializedAttachments : undefined,
    })
    onOpenChange(false)
  }

  function handleRecurringChange(nextValue: boolean) {
    form.setValue('isRecurring', nextValue, { shouldDirty: true })

    if (!nextValue) {
      form.setValue('recurrenceIntervalValue', undefined, { shouldDirty: true })
      form.setValue('recurrenceMileageInterval', undefined, { shouldDirty: true })
      form.clearErrors(['recurrenceType', 'recurrenceIntervalValue', 'recurrenceIntervalUnit', 'recurrenceMileageInterval'])
    }
  }

  function handleRecurrenceTypeChange(nextType: 'time' | 'mileage') {
    form.setValue('recurrenceType', nextType, { shouldDirty: true })

    if (nextType === 'time') {
      form.setValue('recurrenceMileageInterval', undefined, { shouldDirty: true })
    } else {
      form.setValue('recurrenceIntervalValue', undefined, { shouldDirty: true })
    }

    form.clearErrors(['recurrenceType', 'recurrenceIntervalValue', 'recurrenceIntervalUnit', 'recurrenceMileageInterval'])
  }

  function handleRemoveAttachments() {
    setAttachments([])
    setPendingAttachmentFiles([])
    setAttachmentError(null)
    form.setValue('attachmentCount', 0, { shouldDirty: true })

    if (attachmentInputRef.current) {
      attachmentInputRef.current.value = ''
    }
  }

  function handleAttachmentChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])

    if (files.length === 0) {
      return
    }

    if (files.some((file) => !isSupportedAttachmentFile(file))) {
      setAttachmentError('Dodaj pliki tekstowe, PDF, Excel, CSV albo JPG, JPEG, PNG')
      event.target.value = ''
      return
    }

    setAttachments(
      files.map((file, index) => ({
        id: `pending-attachment-${index}-${file.name}`,
        name: file.name,
        mimeType: file.type || undefined,
      })),
    )
    setPendingAttachmentFiles(files)
    setAttachmentError(null)
    form.setValue('attachmentCount', files.length, { shouldDirty: true })
    event.target.value = ''
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={initialValues ? 'Edytuj wpis' : valuesTitle(defaultStatus)}
      description="Wszystkie pola są dostępne od razu w jednym widoku."
    >
      <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
        <div className="space-y-2">
          <Label htmlFor="service-title">Tytuł</Label>
          <Input id="service-title" placeholder="np. Wymiana oleju" {...form.register('title')} />
          {form.formState.errors.title ? <p className="text-sm text-red-600">{form.formState.errors.title.message}</p> : null}
        </div>

        <div className="space-y-2">
          <Label>Kategoria</Label>
          <Select value={form.watch('category')} onValueChange={(value) => form.setValue('category', value as ServiceEventValues['category'])}>
            <SelectTrigger>
              <SelectValue placeholder="Wybierz kategorię" />
            </SelectTrigger>
            <SelectContent>
              {serviceCategoryOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="service-date">Data</Label>
            <Input id="service-date" type="date" {...form.register('eventDate')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="service-mileage">Przebieg</Label>
            <Input
              id="service-mileage"
              type="number"
              inputMode="numeric"
              placeholder="128450"
              {...form.register('mileage', { setValueAs: toOptionalNumber })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="service-total-cost">Wartość</Label>
            <Input
              id="service-total-cost"
              type="text"
              readOnly
              value={formatCurrency(totalCost)}
            />
          </div>
        </div>

        {status === 'planned' ? (
          <div className="space-y-4 rounded-3xl border border-zinc-200 bg-zinc-50 px-4 py-4">
            <div className="space-y-2">
              <Label>Powtarzaj</Label>
              <div className="grid grid-cols-2 gap-2 rounded-2xl bg-white p-1 ring-1 ring-zinc-200/80">
                {([
                  { value: false, label: 'Nie' },
                  { value: true, label: 'Tak' },
                ] as const).map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    aria-pressed={isRecurring === option.value}
                    className={`rounded-[14px] px-4 py-2.5 text-sm font-medium transition ${isRecurring === option.value ? 'bg-zinc-950 text-white' : 'text-zinc-500'}`}
                    onClick={() => handleRecurringChange(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {isRecurring ? (
              <>
                <div className="space-y-2">
                  <Label>Tryb powtarzania</Label>
                  <div className="grid grid-cols-2 gap-2 rounded-2xl bg-white p-1 ring-1 ring-zinc-200/80">
                    {([
                      { value: 'time', label: 'Okresowy' },
                      { value: 'mileage', label: 'Kilometrowy' },
                    ] as const).map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={recurrenceType === option.value}
                        className={`rounded-[14px] px-4 py-2.5 text-sm font-medium transition ${recurrenceType === option.value ? 'bg-zinc-950 text-white' : 'text-zinc-500'}`}
                        onClick={() => handleRecurrenceTypeChange(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  {form.formState.errors.recurrenceType ? <p className="text-sm text-red-600">{form.formState.errors.recurrenceType.message}</p> : null}
                </div>

                {recurrenceType === 'time' ? (
                  <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
                    <div className="space-y-2">
                      <Label htmlFor="service-recurrence-interval">Co ile</Label>
                      <Input
                        id="service-recurrence-interval"
                        type="number"
                        inputMode="numeric"
                        placeholder="3"
                        {...form.register('recurrenceIntervalValue', { setValueAs: toOptionalNumber })}
                      />
                      {form.formState.errors.recurrenceIntervalValue ? <p className="text-sm text-red-600">{form.formState.errors.recurrenceIntervalValue.message}</p> : null}
                    </div>
                    <div className="space-y-2">
                      <Label>Jednostka</Label>
                      <Select value={form.watch('recurrenceIntervalUnit') || undefined} onValueChange={(value) => form.setValue('recurrenceIntervalUnit', value as ServiceEventValues['recurrenceIntervalUnit'])}>
                        <SelectTrigger aria-label="Jednostka powtarzania">
                          <SelectValue placeholder="Wybierz jednostkę" />
                        </SelectTrigger>
                        <SelectContent>
                          {recurrenceUnitOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {form.formState.errors.recurrenceIntervalUnit ? <p className="text-sm text-red-600">{form.formState.errors.recurrenceIntervalUnit.message}</p> : null}
                    </div>
                  </div>
                ) : null}

                {recurrenceType === 'mileage' ? (
                  <div className="space-y-2">
                    <Label htmlFor="service-recurrence-mileage">Co ile kilometrów</Label>
                    <Input
                      id="service-recurrence-mileage"
                      type="number"
                      inputMode="numeric"
                      placeholder="10000"
                      {...form.register('recurrenceMileageInterval', { setValueAs: toOptionalNumber })}
                    />
                    <p className="text-xs text-zinc-500">Powtarzanie będzie liczone od przebiegu podanego w formularzu.</p>
                    {form.formState.errors.recurrenceMileageInterval ? <p className="text-sm text-red-600">{form.formState.errors.recurrenceMileageInterval.message}</p> : null}
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="service-workshop">Warsztat</Label>
            <Input id="service-workshop" placeholder="Nazwa warsztatu" {...form.register('workshopName')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="service-labor">Koszty usługi</Label>
            <Input
              id="service-labor"
              type="number"
              inputMode="decimal"
              placeholder="0"
              {...form.register('laborCost', { setValueAs: toOptionalNumber })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="service-parts">Koszty części</Label>
            <Input
              id="service-parts"
              type="number"
              inputMode="decimal"
              placeholder="0"
              {...form.register('partsCost', { setValueAs: toOptionalNumber })}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="service-other">Inne koszty</Label>
            <Input
              id="service-other"
              type="number"
              inputMode="decimal"
              placeholder="0"
              {...form.register('otherCost', { setValueAs: toOptionalNumber })}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="service-description">Opis</Label>
            <Textarea id="service-description" placeholder="Krótki opis, części, zakres prac" {...form.register('description')} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="service-attachments">Załączniki</Label>
            <div className="rounded-3xl border border-zinc-200 bg-white px-4 py-3">
              <input
                ref={attachmentInputRef}
                id="service-attachments"
                type="file"
                multiple
                accept={attachmentAcceptValue}
                className="sr-only"
                onChange={handleAttachmentChange}
              />
              <div className="flex flex-wrap items-center justify-center gap-3 text-center">
                <label
                  htmlFor="service-attachments"
                  className="inline-flex h-9 cursor-pointer items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-medium text-zinc-800 transition hover:border-zinc-300 hover:bg-zinc-100"
                >
                  Wybierz pliki
                </label>
                <p className="text-sm text-zinc-500">{formatAttachmentSummary(attachments.map((attachment) => attachment.name), attachmentCount)}</p>
              </div>
            </div>
            {attachmentError ? <p className="text-sm text-red-600">{attachmentError}</p> : null}
            {attachments.length > 0 ? (
              <div className="space-y-3 rounded-3xl border border-zinc-200 bg-white p-3">
                <div className="flex flex-wrap gap-2">
                  {attachments.map((attachment) => (
                    <span key={attachment.id} className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-sm text-zinc-700">
                      {attachment.name}
                    </span>
                  ))}
                </div>
                <Button type="button" variant="ghost" onClick={handleRemoveAttachments}>
                  Usuń załączniki
                </Button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Anuluj
          </Button>
          <Button type="submit" data-testid="service-submit">
            {initialValues ? 'Zapisz wpis' : form.watch('status') === 'completed' ? 'Dodaj serwis' : 'Zaplanuj serwis'}
          </Button>
        </div>
      </form>
    </ResponsiveModal>
  )
}

function isSupportedAttachmentFile(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase()

  if (extension && supportedAttachmentExtensions.includes(extension)) {
    return true
  }

  return supportedAttachmentMimeTypes.includes(file.type)
}

function formatAttachmentSummary(names: string[], count: number) {
  if (names.length > 0) {
    return names.length === 1 ? names[0] : `(${names.length} pliki)`
  }

  if (count > 0) {
    return `(${count} zapisane pliki)`
  }

  return '(nie wybrano plików)'
}
