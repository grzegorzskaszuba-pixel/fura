import { appConfig } from '@/shared/config/app-config'
import { httpRequest } from '@/shared/lib/http-client'

const shareBrochureBaseUrl = `${appConfig.apiBaseUrl}/share-brochures`

interface CreateShareBrochureResponse {
  id: string
  expiresAt: string
  url: string
}

export interface ActiveShareBrochure {
  id: string
  vehicleId: string
  createdAt: string
  expiresAt: string
  url: string
}

interface ListShareBrochuresResponse {
  brochures: ActiveShareBrochure[]
}

export const shareBrochureRepository = {
  async create(vehicleId: string) {
    return httpRequest<CreateShareBrochureResponse>(shareBrochureBaseUrl, {
      method: 'POST',
      body: { vehicleId },
    })
  },

  async listActive(vehicleId?: string) {
    const query = vehicleId ? `?vehicleId=${encodeURIComponent(vehicleId)}` : ''
    const response = await httpRequest<ListShareBrochuresResponse>(`${shareBrochureBaseUrl}${query}`)
    return response.brochures
  },

  async getActive(vehicleId: string) {
    const active = await this.listActive(vehicleId)
    return active[0] ?? null
  },

  async revoke(id: string) {
    await httpRequest<void>(`${shareBrochureBaseUrl}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
  },
}
