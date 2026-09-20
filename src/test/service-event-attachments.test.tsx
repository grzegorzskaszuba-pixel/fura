import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ServiceEventDetail } from '@/features/service-events/service-event-detail'
import { ServiceEventForm } from '@/features/service-events/service-event-form'
import type { ServiceEvent, Vehicle } from '@/shared/types/domain'

const megabyte = 1024 * 1024

const vehicle: Vehicle = {
  id: 'vehicle-1',
  profileId: 'profile-1',
  name: 'BMW 320d',
  make: 'BMW',
  model: '320d',
  currentMileage: 128450,
  createdAt: '2026-08-10T10:00:00.000Z',
  updatedAt: '2026-08-10T10:00:00.000Z',
}

function createServiceEvent(attachments: ServiceEvent['attachments']): ServiceEvent {
  return {
    id: 'event-1',
    profileId: 'profile-1',
    vehicleId: 'vehicle-1',
    status: 'completed',
    category: 'repair',
    title: 'Naprawa',
    currency: 'PLN',
    attachmentCount: attachments?.length,
    attachments,
    createdAt: '2026-08-10T10:00:00.000Z',
    updatedAt: '2026-08-10T10:00:00.000Z',
  }
}

function createSizedFile(name: string, sizeBytes: number, type = 'application/pdf') {
  return new File([new Uint8Array(sizeBytes)], name, { type })
}

function renderForm(onSubmit = vi.fn().mockResolvedValue(undefined), initialValues?: ServiceEvent) {
  render(<ServiceEventForm open onOpenChange={vi.fn()} initialValues={initialValues} onSubmit={onSubmit} />)

  return {
    input: screen.getByLabelText('Załączniki'),
    cameraInput: screen.getByLabelText('Zrób zdjęcie'),
    onSubmit,
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('service event attachments', () => {
  it('appends repeated selections and preserves phone camera capture', async () => {
    const user = userEvent.setup()
    const { input, cameraInput } = renderForm()

    expect(cameraInput).toHaveAttribute('accept', 'image/*')
    expect(cameraInput).toHaveAttribute('capture', 'environment')

    await user.upload(input, new File(['invoice'], 'faktura.pdf', { type: 'application/pdf' }))
    await user.upload(input, new File(['notes'], 'notatki.txt', { type: 'text/plain' }))
    await user.upload(cameraInput, new File(['photo'], 'licznik.jpg', { type: 'image/jpeg' }))

    expect(screen.getByText('faktura.pdf')).toBeInTheDocument()
    expect(screen.getByText('notatki.txt')).toBeInTheDocument()
    expect(screen.getByText('licznik.jpg')).toBeInTheDocument()
    expect(screen.getByText('(3 pliki)')).toBeInTheDocument()
  })

  it('rejects a sixth attachment without replacing the existing selection', async () => {
    const user = userEvent.setup()
    const { input } = renderForm()
    const firstFive = Array.from({ length: 5 }, (_, index) => createSizedFile(`plik-${index}.pdf`, 1))

    await user.upload(input, firstFive)
    await user.upload(input, createSizedFile('plik-5.pdf', 1))

    expect(screen.getByText(/maksymalnie 5 załączników/i)).toBeInTheDocument()
    expect(screen.getByText('plik-0.pdf')).toBeInTheDocument()
    expect(screen.getByText('plik-4.pdf')).toBeInTheDocument()
    expect(screen.queryByText('plik-5.pdf')).not.toBeInTheDocument()
  })

  it('rejects a selection above the 20 MB aggregate limit', async () => {
    const user = userEvent.setup()
    const { input } = renderForm()

    await user.upload(input, createSizedFile('duzy.pdf', 20 * megabyte))
    await user.upload(input, createSizedFile('jeszcze-jeden.pdf', 1))

    expect(screen.getByText(/łączny rozmiar załączników.*20 MB/i)).toBeInTheDocument()
    expect(screen.getAllByText('duzy.pdf').length).toBeGreaterThan(0)
    expect(screen.queryByText('jeszcze-jeden.pdf')).not.toBeInTheDocument()
  })

  it('keeps saved attachments when a new file is added during editing', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const { input } = renderForm(onSubmit, createServiceEvent([{ id: 'saved-1', name: 'stara-faktura.pdf', mimeType: 'application/pdf' }]))

    await user.type(screen.getByLabelText('Tytuł'), ' - aktualizacja')
    await user.upload(input, new File(['new'], 'nowe-zdjecie.jpg', { type: 'image/jpeg' }))
    await user.click(screen.getByTestId('service-submit'))

    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(onSubmit.mock.calls[0]?.[0].attachmentNames).toEqual(['stara-faktura.pdf', 'nowe-zdjecie.jpg'])
    expect(onSubmit.mock.calls[0]?.[0].attachments).toHaveLength(2)
  })

  it('shows a file-read error without submitting the form', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    class BrokenFileReader {
      onload: ((event: ProgressEvent<FileReader>) => void) | null = null
      onerror: ((event: ProgressEvent<FileReader>) => void) | null = null

      readAsDataURL() {
        this.onerror?.(new ProgressEvent('error') as ProgressEvent<FileReader>)
      }
    }

    vi.stubGlobal('FileReader', BrokenFileReader)
    const { input } = renderForm(onSubmit)

    await user.type(screen.getByLabelText('Tytuł'), 'Odczyt załącznika')
    await user.upload(input, new File(['photo'], 'uszkodzone.jpg', { type: 'image/jpeg' }))
    await user.click(screen.getByTestId('service-submit'))

    expect(await screen.findByText('Nie udało się odczytać pliku uszkodzone.jpg')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByTestId('service-submit')).toBeInTheDocument()
  })

  it('renders non-image files with a download fallback', async () => {
    const user = userEvent.setup()
    render(
      <ServiceEventDetail
        event={createServiceEvent([{ id: 'pdf-1', name: 'faktura.pdf', mimeType: 'application/pdf', contentUrl: 'data:application/pdf;base64,ZmFrZQ==' }])}
        vehicle={vehicle}
        open
        onOpenChange={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn().mockResolvedValue(undefined)}
        onMarkCompleted={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    await user.click(screen.getByTestId('attachment-thumbnail-0'))

    expect(await screen.findByText('Podgląd niedostępny')).toBeInTheDocument()
    expect(screen.getByText('Pobierz plik')).toHaveAttribute('download', 'faktura.pdf')
    expect(screen.getByTestId('attachment-lightbox').querySelector('img')).toBeNull()
  })

  it('replaces a broken image preview with the fallback instead of crashing', async () => {
    const user = userEvent.setup()
    render(
      <ServiceEventDetail
        event={createServiceEvent([{ id: 'image-1', name: 'zdjecie.jpg', mimeType: 'image/jpeg', previewUrl: 'data:image/jpeg;base64,broken' }])}
        vehicle={vehicle}
        open
        onOpenChange={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn().mockResolvedValue(undefined)}
        onMarkCompleted={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    await user.click(screen.getByTestId('attachment-thumbnail-0'))
    const lightbox = screen.getByTestId('attachment-lightbox')
    const image = lightbox.querySelector('img')

    if (!image) {
      throw new Error('Expected an image in the attachment lightbox')
    }

    fireEvent.error(image)

    await waitFor(() => {
      expect(lightbox).toHaveTextContent('Podgląd niedostępny')
    })
    expect(lightbox.querySelector('img')).toBeNull()
  })
})
