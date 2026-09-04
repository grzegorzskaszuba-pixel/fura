import type { ServiceAttachment } from '@/shared/types/domain'
import { generateId } from '@/shared/lib/utils'

const imageExtensions = new Set(['gif', 'jpeg', 'jpg', 'png', 'svg', 'webp'])

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
    files.map(async (file) => ({
      id: generateId(),
      name: file.name,
      mimeType: file.type || undefined,
      previewUrl: isImageFile(file) ? await readFileAsDataUrl(file) : undefined,
    })),
  )
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