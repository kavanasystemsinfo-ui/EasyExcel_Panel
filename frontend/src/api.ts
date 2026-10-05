export type SheetInfo = {
  name: string
  rows: number
  cols: number
}

export type Workbook = {
  id: string
  filename: string
  uploaded_at: string
  sheets: SheetInfo[]
}

export type SheetRows = {
  sheet: string
  header: string[]
  rows: unknown[][]
  total: number
  offset: number
  limit: number
}

export const PAGE_SIZE = 100
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? ''

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, init)
  if (!response.ok) {
    let detail = `Error HTTP ${response.status}`
    try {
      const body = (await response.json()) as { detail?: string }
      if (body.detail) detail = body.detail
    } catch {
      // sin cuerpo JSON: nos quedamos con el status
    }
    throw new Error(detail)
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export function uploadWorkbook(file: File): Promise<Workbook> {
  const form = new FormData()
  form.append('file', file)
  return request<Workbook>('/api/v1/workbooks', { method: 'POST', body: form })
}

export function getSheetRows(
  workbookId: string,
  sheet: string,
  offset: number,
  limit: number,
): Promise<SheetRows> {
  const query = new URLSearchParams({ offset: String(offset), limit: String(limit) })
  const sheetPath = encodeURIComponent(sheet)
  return request<SheetRows>(
    `/api/v1/workbooks/${workbookId}/sheets/${sheetPath}/rows?${query.toString()}`,
  )
}

export function deleteWorkbook(workbookId: string): Promise<void> {
  return request<void>(`/api/v1/workbooks/${workbookId}`, { method: 'DELETE' })
}
