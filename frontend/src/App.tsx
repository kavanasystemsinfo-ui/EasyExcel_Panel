import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import {
  getSheetRows,
  PAGE_SIZE,
  uploadWorkbook,
  type SheetRows,
  type Workbook,
} from './api'
import { esColumnaEstado, norm } from './cells'
import { calcularKpis, type SheetData } from './kpis'
import CoveragePanel from './CoveragePanel'
import CopilotPanel from './CopilotPanel'
import GridView from './GridView'
import KpiCards from './KpiCards'
import SheetSelector from './SheetSelector'
import Sidebar from './Sidebar'
import Toolbar from './Toolbar'
import Topbar from './Topbar'
import UploadZone from './UploadZone'

const HOJAS_KPI = [
  'Empleados',
  'Centros',
  'Asignaciones',
  'Vacaciones',
  'Maquinaria',
  'Auditorias',
]
const FILAS_KPI = 500

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

function App() {
  const [workbook, setWorkbook] = useState<Workbook | null>(null)
  const [sheet, setSheet] = useState<string | null>(null)
  const [offset, setOffset] = useState(0)
  const [page, setPage] = useState<SheetRows | null>(null)
  const [kpisData, setKpisData] = useState<Record<string, SheetData>>({})
  const [busy, setBusy] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [rowsError, setRowsError] = useState<string | null>(null)
  const [loadingRows, setLoadingRows] = useState(false)
  const [query, setQuery] = useState('')
  const [soloActivos, setSoloActivos] = useState(false)
  const [ocultas, setOcultas] = useState<number[]>([])
  const [hoy] = useState(() => new Date())
  const fileRef = useRef<HTMLInputElement>(null)

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

  useEffect(() => {
    if (!workbook) return
    const disponibles = HOJAS_KPI.filter((nombre) =>
      workbook.sheets.some((s) => s.name === nombre),
    )
    if (!disponibles.length) return
    let cancelled = false
    Promise.all(
      disponibles.map((nombre) =>
        getSheetRows(workbook.id, nombre, 0, FILAS_KPI)
          .then((r) => ({ nombre, r }))
          .catch(() => null),
      ),
    ).then((resultados) => {
      if (cancelled) return
      const data: Record<string, SheetData> = {}
      for (const item of resultados) {
        if (item) data[item.nombre] = { header: item.r.header, rows: item.r.rows }
      }
      setKpisData(data)
    })
    return () => {
      cancelled = true
    }
  }, [workbook])

  const kpis = useMemo(() => calcularKpis(kpisData, hoy), [kpisData, hoy])

  const conEstado = page ? page.header.some((col) => esColumnaEstado(col)) : false

  const rowsFiltradas = useMemo(() => {
    if (!page) return []
    let rows = page.rows
    const texto = norm(query)
    if (texto) {
      rows = rows.filter((fila) => fila.some((celda) => norm(celda).includes(texto)))
    }
    if (soloActivos && conEstado) {
      const iEstado = page.header.findIndex((col) => esColumnaEstado(col))
      rows = rows.filter((fila) => norm(fila[iEstado]) === 'activo')
    }
    return rows
  }, [page, query, soloActivos, conEstado])

  const handleFile = async (file: File) => {
    setBusy(true)
    setUploadError(null)
    setPage(null)
    setRowsError(null)
    setLoadingRows(false)
    setOffset(0)
    setQuery('')
    setSoloActivos(false)
    setOcultas([])
    setKpisData({})
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
    setQuery('')
    setSoloActivos(false)
    setOcultas([])
    setKpisData({})
  }

  const goToPage = (newOffset: number) => {
    setRowsError(null)
    setLoadingRows(true)
    setOffset(newOffset)
  }

  const seleccionarHoja = (name: string) => {
    setRowsError(null)
    setLoadingRows(true)
    setSheet(name)
    setOffset(0)
    setOcultas([])
  }

  const abrirSelector = () => fileRef.current?.click()

  if (!workbook) {
    return (
      <main className="standalone">
        <header className="brand-head">
          <span className="brand-mark" aria-hidden="true">
            E
          </span>
          <div>
            <h1>EasyExcel Panel</h1>
            <p>Sube un .xlsx, explora sus hojas y trabaja con sus datos en el navegador.</p>
          </div>
        </header>
        <UploadZone onFile={handleFile} busy={busy} error={uploadError} />
      </main>
    )
  }

  return (
    <div className="app-shell">
      <Sidebar workbook={workbook} active={sheet} onSelect={seleccionarHoja} onReset={reset} />

      <div className="app-main">
        <Topbar
          sheetCount={workbook.sheets.length}
          query={query}
          onQuery={setQuery}
          onUploadClick={abrirSelector}
        />

        <div className="app-content">
          <section className="banner">
            <div>
              <h2>
                Gestión de Personal y Operaciones
                <span className="banner-pill">
                  Corte: {hoy.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </span>
              </h2>
              <p>
                Modo demo: {workbook.sheets.length} hoja
                {workbook.sheets.length === 1 ? '' : 's'} · pulsa un espacio de trabajo para
                navegar.
              </p>
            </div>
            <div className="banner-actions">
              <button
                type="button"
                className="btn btn-onbanner"
                disabled
                title="Altas editables: Fase 3"
              >
                Nueva Alta Empleado
              </button>
              <button
                type="button"
                className="btn btn-onbanner"
                disabled
                title="Asignación editable: Fase 3"
              >
                Asignar Turno
              </button>
              <button type="button" className="btn btn-primary" onClick={abrirSelector}>
                Cargar .xlsx
              </button>
            </div>
          </section>

          {uploadError ? (
            <p role="alert" className="error">
              {uploadError}
            </p>
          ) : null}

          <KpiCards kpis={kpis} />

          <section className="grid-section">
            <div className="grid-head">
              <SheetSelector
                sheets={workbook.sheets}
                active={sheet ?? ''}
                onSelect={seleccionarHoja}
              />
              <span className="grid-meta">
                {page ? `${page.total} filas · openpyxl` : 'Cargando hoja…'}
              </span>
            </div>

            <Toolbar
              header={page?.header ?? []}
              mostrarChipActivos={conEstado}
              soloActivos={soloActivos}
              onSoloActivos={() => setSoloActivos((on) => !on)}
              ocultas={ocultas}
              onToggleCol={(i) =>
                setOcultas((prev) =>
                  prev.includes(i) ? prev.filter((n) => n !== i) : [...prev, i],
                )
              }
              coincidencias={query.trim() ? rowsFiltradas.length : null}
            />

            {rowsError ? (
              <p role="alert" className="error">
                {rowsError}
              </p>
            ) : null}

            {page && sheet ? (
              <GridView
                sheetName={sheet}
                header={page.header}
                rows={rowsFiltradas}
                total={page.total}
                offset={page.offset}
                limit={page.limit}
                onPage={goToPage}
                hiddenCols={ocultas}
                filtered={Boolean(query.trim()) || (soloActivos && conEstado)}
              />
            ) : loadingRows ? (
              <p className="loading">Cargando hoja…</p>
            ) : null}
          </section>

          <section className="bottom-panels">
            <CopilotPanel />
            {kpis.cobertura?.length ? <CoveragePanel cobertura={kpis.cobertura} /> : null}
          </section>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        hidden
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void handleFile(file)
          event.target.value = ''
        }}
      />
    </div>
  )
}

export default App
