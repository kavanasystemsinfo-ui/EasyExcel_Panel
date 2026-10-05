import { useEffect, useState } from 'react'
import './App.css'
import {
  getSheetRows,
  PAGE_SIZE,
  uploadWorkbook,
  type SheetRows,
  type Workbook,
} from './api'
import GridView from './GridView'
import SheetSelector from './SheetSelector'
import UploadZone from './UploadZone'

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

function App() {
  const [workbook, setWorkbook] = useState<Workbook | null>(null)
  const [sheet, setSheet] = useState<string | null>(null)
  const [offset, setOffset] = useState(0)
  const [page, setPage] = useState<SheetRows | null>(null)
  const [busy, setBusy] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [rowsError, setRowsError] = useState<string | null>(null)
  const [loadingRows, setLoadingRows] = useState(false)

  useEffect(() => {
    if (!workbook || !sheet) return
    let cancelled = false
    getSheetRows(workbook.id, sheet, offset, PAGE_SIZE)
      .then((result) => {
        if (!cancelled) setPage(result)
      })
      .catch((error: unknown) => {
        if (!cancelled) setRowsError(messageOf(error, 'No se pudo leer la hoja'))
      })
      .finally(() => {
        if (!cancelled) setLoadingRows(false)
      })
    return () => {
      cancelled = true
    }
  }, [workbook, sheet, offset])

  const handleFile = async (file: File) => {
    setBusy(true)
    setUploadError(null)
    setPage(null)
    setRowsError(null)
    setLoadingRows(false)
    setOffset(0)
    try {
      const loaded = await uploadWorkbook(file)
      setWorkbook(loaded)
      setSheet(loaded.sheets[0]?.name ?? null)
      setLoadingRows(true)
    } catch (error: unknown) {
      setUploadError(messageOf(error, 'No se pudo cargar el archivo'))
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setWorkbook(null)
    setSheet(null)
    setPage(null)
    setOffset(0)
    setUploadError(null)
    setRowsError(null)
    setLoadingRows(false)
  }

  const goToPage = (newOffset: number) => {
    setRowsError(null)
    setLoadingRows(true)
    setOffset(newOffset)
  }

  return (
    <main className="panel">
      <header className="panel-head">
        <h1>EasyExcel Panel</h1>
        <p>Sube un .xlsx, explora sus hojas y trabaja con sus datos en el navegador.</p>
      </header>

      {!workbook ? (
        <UploadZone onFile={handleFile} busy={busy} error={uploadError} />
      ) : (
        <div className="workspace">
          <div className="workbook-bar">
            <strong>{workbook.filename}</strong>
            <span>
              {workbook.sheets.length} hoja
              {workbook.sheets.length === 1 ? '' : 's'}
            </span>
            <button type="button" className="ghost" onClick={reset}>
              Subir otro archivo
            </button>
          </div>
          <SheetSelector
            sheets={workbook.sheets}
            active={sheet ?? ''}
            onSelect={(name) => {
              setRowsError(null)
              setLoadingRows(true)
              setSheet(name)
              setOffset(0)
            }}
          />
          {rowsError ? (
            <p role="alert" className="error">
              {rowsError}
            </p>
          ) : null}
          {loadingRows && !page ? <p className="loading">Cargando hoja…</p> : null}
          {page && sheet ? (
            <GridView
              sheetName={sheet}
              header={page.header}
              rows={page.rows}
              total={page.total}
              offset={page.offset}
              limit={page.limit}
              onPage={goToPage}
            />
          ) : null}
        </div>
      )}
    </main>
  )
}

export default App
