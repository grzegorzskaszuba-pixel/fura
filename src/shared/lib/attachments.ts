import type { ServiceAttachment } from '@/shared/types/domain'
import { generateId } from '@/shared/lib/utils'

const imageExtensions = new Set(['gif', 'jpeg', 'jpg', 'png', 'svg', 'webp'])
export const MAX_SERVICE_ATTACHMENTS = 5
export const MAX_SERVICE_ATTACHMENT_SIZE_BYTES = 20 * 1024 * 1024

export function getAttachmentExtension(name: string) {
  return name.split('.').pop()?.toLowerCase()
}

export function isImageAttachment(attachment: Pick<ServiceAttachment, 'mimeType' | 'name' | 'previewUrl'>) {
  if (attachment.previewUrl?.startsWith('data:image/')) {
    return true
  }

  if (attachment.mimeType?.startsWith('image/')) {
    return true
  }

  const extension = getAttachmentExtension(attachment.name)
  return extension ? imageExtensions.has(extension) : false
}

export function normalizeServiceAttachments(input: {
  attachments?: ServiceAttachment[]
  attachmentNames?: string[]
}) {
  if (input.attachments && input.attachments.length > 0) {
    return input.attachments
  }

  return (input.attachmentNames ?? []).map((name, index) => ({
    id: `legacy-attachment-${index}-${name}`,
    name,
  }))
}

export async function buildServiceAttachments(files: File[]): Promise<ServiceAttachment[]> {
  return Promise.all(
    files.map(async (file) => {
      const contentUrl = await readFileAsDataUrl(file)

      return {
        id: generateId(),
        name: file.name,
        mimeType: file.type || undefined,
        sizeBytes: file.size,
        contentUrl,
        previewUrl: isImageFile(file) ? contentUrl : undefined,
      }
    }),
  )
}

export function getServiceAttachmentSize(attachment: Pick<ServiceAttachment, 'contentUrl' | 'previewUrl' | 'sizeBytes'>) {
  if (typeof attachment.sizeBytes === 'number' && Number.isFinite(attachment.sizeBytes)) {
    return attachment.sizeBytes
  }

  const dataUrl = attachment.contentUrl ?? attachment.previewUrl

  if (!dataUrl) {
    return 0
  }

  return getDataUrlSize(dataUrl)
}

function isImageFile(file: File) {
  if (file.type.startsWith('image/')) {
    return true
  }

  const extension = getAttachmentExtension(file.name)
  return extension ? imageExtensions.has(extension) : false
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.onerror = () => reject(new Error(`Nie udało się odczytać pliku ${file.name}`))
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.readAsDataURL(file)
  })
}

function getDataUrlSize(dataUrl: string) {
  const separatorIndex = dataUrl.indexOf(',')

  if (!dataUrl.startsWith('data:') || separatorIndex < 0) {
    return 0
  }

  const metadata = dataUrl.slice(5, separatorIndex).toLowerCase()
  const payload = dataUrl.slice(separatorIndex + 1)

  if (!metadata.includes(';base64')) {
    try {
      return new TextEncoder().encode(decodeURIComponent(payload)).length
    } catch {
      return 0
    }
  }

  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor(payload.length * 3 / 4) - padding)
}