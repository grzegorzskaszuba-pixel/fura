import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import App from '@/app/App'
import { ServiceEventDetail } from '@/features/service-events/service-event-detail'
import { VehicleCarousel } from '@/features/vehicles/vehicle-carousel'

afterEach(() => {
  vi.useRealTimers()
})

async function openAppSession() {
  const user = userEvent.setup()
  render(<App />)
  await screen.findByTestId('active-vehicle-name')

  return user
}

describe('App MVP flow', () => {
  it('switches the active vehicle', async () => {
    const user = await openAppSession()
    const currentVehicleName = screen.getByTestId('active-vehicle-name').textContent ?? ''
    const nextVehicleName = currentVehicleName.includes('BMW 320d') ? 'Audi Q5' : 'BMW 320d'

    await user.click(screen.getByLabelText(`Pokaż auto ${nextVehicleName}`))

    await waitFor(() => {
      expect(screen.getByTestId('active-vehicle-name')).toHaveTextContent(nextVehicleName)
    })
  })

  it('adds a vehicle', async () => {
    const user = await openAppSession()
    const imageFile = new File(['vehicle-image'], 'octavia.png', { type: 'image/png' })

    await user.click(screen.getByLabelText('Menu auta'))
    await user.click(await screen.findByText('Dodaj nowe'))
    await user.type(screen.getByLabelText('Nazwa'), 'Skoda Octavia')
    await user.type(screen.getByLabelText('Marka'), 'Skoda')
    await user.type(screen.getByLabelText('Model'), 'Octavia')
    await user.type(screen.getByLabelText('Rok'), '2022')
    await user.type(screen.getByLabelText('Przebieg'), '15500')
    expect(screen.getByLabelText('Typ nadwozia')).toBeInTheDocument()
    expect(screen.getByLabelText('Skrzynia')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Moc'), '200')
    await user.type(screen.getByLabelText('Kolor'), 'Grafitowy')
    await user.upload(screen.getByLabelText('Dodaj zdjęcie z dysku'), imageFile)
    await user.click(screen.getByTestId('vehicle-submit'))

    await waitFor(() => {
      expect(screen.getByTestId('active-vehicle-name')).toHaveTextContent('Skoda Octavia')
    })

    await waitFor(() => {
      expect(screen.getByAltText('Skoda Octavia')).toHaveAttribute('src', expect.stringContaining('data:image/png;base64,'))
    })
  })

  it('adds a completed service event', async () => {
    const user = await openAppSession()
    const attachmentFiles = [
      new File(['invoice'], 'faktura.pdf', { type: 'application/pdf' }),
      new File(['parts'], 'czesci.csv', { type: 'text/csv' }),
    ]

    await user.click(screen.getByTestId('add-service-button'))
    await user.clear(screen.getByLabelText('Tytuł'))
    await user.type(screen.getByLabelText('Tytuł'), 'Wymiana filtra paliwa')
    await user.clear(screen.getByLabelText('Koszty usługi'))
    await user.type(screen.getByLabelText('Koszty usługi'), '320')
    await user.upload(screen.getByLabelText('Załączniki'), attachmentFiles)
    expect(screen.getByText('(2 pliki)')).toBeInTheDocument()
    await user.click(screen.getByTestId('service-submit'))

    await screen.findAllByText('Wymiana filtra paliwa')
    expect(screen.getAllByText('Wymiana filtra paliwa').length).toBeGreaterThan(0)
  })

  it('opens service attachments and enlarges the selected file', async () => {
    const user = userEvent.setup()

    render(
      <ServiceEventDetail
        event={{
          id: 'event-1',
          profileId: 'profile-1',
          vehicleId: 'vehicle-1',
          status: 'completed',
          category: 'repair',
          title: 'Wymiana oleju i filtra',
          eventDate: '2026-08-10',
          mileage: 128450,
          currency: 'PLN',
          attachmentCount: 2,
          attachmentNames: ['silnik-po-serwisie.png', 'faktura-serwisowa.pdf'],
          attachments: [
            {
              id: 'attachment-1',
              name: 'silnik-po-serwisie.png',
              mimeType: 'image/png',
              previewUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9sot3d8AAAAASUVORK5CYII=',
            },
            {
              id: 'attachment-2',
              name: 'faktura-serwisowa.pdf',
              mimeType: 'application/pdf',
            },
          ],
          createdAt: '2026-08-10T10:00:00.000Z',
          updatedAt: '2026-08-10T10:00:00.000Z',
        }}
        vehicle={{
          id: 'vehicle-1',
          profileId: 'profile-1',
          name: 'BMW 320d',
          make: 'BMW',
          model: '320d',
          currentMileage: 128450,
          createdAt: '2026-08-10T10:00:00.000Z',
          updatedAt: '2026-08-10T10:00:00.000Z',
        }}
        open
        onOpenChange={() => undefined}
        onEdit={() => undefined}
        onDelete={vi.fn().mockResolvedValue(undefined)}
        onMarkCompleted={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    expect(await screen.findByTestId('attachment-gallery')).toBeInTheDocument()
    expect(screen.getByText('silnik-po-serwisie.png (1/2)')).toBeInTheDocument()

    await user.click(screen.getByTestId('attachment-thumbnail-1'))
    expect(screen.getByText('faktura-serwisowa.pdf (2/2)')).toBeInTheDocument()

    await user.click(screen.getByTestId('attachment-slide-1'))
    expect(await screen.findByTestId('attachment-lightbox')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Zamknij podgląd załącznika'))

    await waitFor(() => {
      expect(screen.queryByTestId('attachment-lightbox')).not.toBeInTheDocument()
    })
  })

  it('plans a service and shows it in the plan tab', async () => {
    const user = await openAppSession()

    await user.click(screen.getByTestId('plan-service-button'))
    await user.clear(screen.getByLabelText('Tytuł'))
    await user.type(screen.getByLabelText('Tytuł'), 'Wymiana rozrządu')
    await user.type(screen.getByLabelText('Przebieg'), '150000')
    await user.click(screen.getByRole('button', { name: 'Tak' }))
    await user.click(screen.getByRole('button', { name: 'Okresowy' }))
    await user.type(screen.getByLabelText('Co ile'), '6')
    await user.click(screen.getByTestId('service-submit'))
    await waitFor(() => {
      expect(screen.queryByTestId('service-submit')).not.toBeInTheDocument()
    })
    await user.click(screen.getByTestId('tab-plan'))

    await screen.findAllByText('Wymiana rozrządu')
    expect(screen.getAllByText('Wymiana rozrządu').length).toBeGreaterThan(0)
  })

  it('switches between history and plan tabs', async () => {
    const user = await openAppSession()

    await user.click(screen.getByTestId('tab-plan'))
    await waitFor(() => {
      expect(screen.getByTestId('tab-plan')).toHaveAttribute('aria-pressed', 'true')
    })

    await user.click(screen.getByTestId('tab-history'))
    await waitFor(() => {
      expect(screen.getByTestId('tab-history')).toHaveAttribute('aria-pressed', 'true')
    })
  })

  it('keeps the sticky mobile actions visible', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 })
    window.dispatchEvent(new Event('resize'))

    await openAppSession()

    await waitFor(() => {
      expect(screen.getByTestId('add-service-button')).toBeVisible()
      expect(screen.getByTestId('plan-service-button')).toBeVisible()
    })
  })

  it('copies VIN after a long touch press on mobile', async () => {
    vi.useFakeTimers()
    const clipboardWriteText = vi.fn().mockResolvedValue(undefined)

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: clipboardWriteText },
    })

    render(
      <VehicleCarousel
        vehicles={[
          {
            id: 'vehicle-1',
            profileId: 'profile-1',
            name: 'BMW 320d',
            make: 'BMW',
            model: '320d',
            vin: 'WBA12345678901234',
            imageUrl: '/test-image.png',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ]}
        activeVehicleId="vehicle-1"
        onVehicleSelect={() => undefined}
      />,
    )

    const vinButton = screen.getByRole('button', { name: 'WBA12345678901234' })

    fireEvent.touchStart(vinButton)
    vi.advanceTimersByTime(500)
    fireEvent.touchEnd(vinButton)
    await Promise.resolve()

    expect(clipboardWriteText).toHaveBeenCalledWith('WBA12345678901234')
  })

  it('switches the active vehicle on pointer drag', async () => {
    const onVehicleSelect = vi.fn()

    render(
      <VehicleCarousel
        vehicles={[
          {
            id: 'vehicle-1',
            profileId: 'profile-1',
            name: 'BMW 320d',
            make: 'BMW',
            model: '320d',
            imageUrl: '/test-image-1.png',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
          {
            id: 'vehicle-2',
            profileId: 'profile-1',
            name: 'Audi Q5',
            make: 'Audi',
            model: 'Q5',
            imageUrl: '/test-image-2.png',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ]}
        activeVehicleId="vehicle-1"
        onVehicleSelect={onVehicleSelect}
      />,
    )

    const gestureArea = screen.getByTestId('vehicle-carousel-gesture-area')

    fireEvent.pointerDown(gestureArea, {
      button: 0,
      clientX: 220,
      clientY: 120,
      pointerId: 1,
      pointerType: 'touch',
    })
    fireEvent.pointerMove(gestureArea, {
      clientX: 120,
      clientY: 126,
      pointerId: 1,
      pointerType: 'touch',
    })
    fireEvent.pointerUp(gestureArea, {
      clientX: 120,
      clientY: 126,
      pointerId: 1,
      pointerType: 'touch',
    })

    expect(onVehicleSelect).toHaveBeenCalledWith('vehicle-2')
  })
})
