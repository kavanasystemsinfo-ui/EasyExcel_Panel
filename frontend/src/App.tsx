import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import {
  getDemo,
  getSheetRows,
  PAGE_SIZE,
  uploadWorkbook,
  type Workbook,
} from './api'
import { esColumnaEstado, norm } from './cells'
import {
  anadirColumna,
  anadirFila,
  borrarFila,
  editarCelda,
  hojaDe,
  type WorkbookFull,
} from './edit'
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
import { borrarSesion, cargarSesion, guardarSesion, nuevoToken } from './session'

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

async function cargarHojas(manifest: Workbook): Promise<WorkbookFull> {
  const hojas = await Promise.all(
    manifest.sheets.map(async (sheet) => {
      let header: string[] = []
      let rows: unknown[][] = []
      let offset = 0
      for (;;) {
        const page = await getSheetRows(manifest.id, sheet.name, offset, 500)
        header = header.length ? header : page.header
        rows = rows.concat(page.rows)
        offset += page.rows.length
        if (page.rows.length === 0 || offset >= page.total) break
      }
      return { name: sheet.name, header, rows }
    }),
  )
  return {
    id: manifest.id,
    filename: manifest.filename,
    uploaded_at: manifest.uploaded_at,
    hojas,
  }
}

function App() {
  const [wb, setWb] = useState<WorkbookFull | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [cambios, setCambios] = useState(0)
  const [hoja, setHoja] = useState<string | null>(null)
  const [pagina, setPagina] = useState(0)
  const [demoCargando, setDemoCargando] = useState(true)
  const [busy, setBusy] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [rowsError, setRowsError] = useState<string | null>(null)
  const [avisoLocal, setAvisoLocal] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [soloActivos, setSoloActivos] = useState(false)
  const [ocultas, setOcultas] = useState<number[]>([])
  const [hoy] = useState(() => new Date())
  const fileRef = useRef<HTMLInputElement>(null)
  const wbRef = useRef<WorkbookFull | null>(null)

  function instalar(completo: WorkbookFull) {
    const tok = nuevoToken()
    wbRef.current = completo
    setWb(completo)
    setToken(tok)
    setCambios(0)
    setHoja(completo.hojas[0]?.name ?? null)
    setPagina(0)
    setQuery('')
    setSoloActivos(false)
    setOcultas([])
    setRowsError(null)
    guardarSesion({
      token: tok,
      cambios: 0,
      wb: completo,
      guardadoEn: new Date().toISOString(),
    })
  }

  async function iniciarDemo() {
    setDemoCargando(true)
    setUploadError(null)
    try {
      const manifest = await getDemo()
      const completo = await cargarHojas(manifest)
      if (wbRef.current) return
      instalar(completo)
    } catch (error: unknown) {
      if (!wbRef.current) {
        setUploadError(messageOf(error, 'No se pudo cargar el libro demo'))
      }
    } finally {
      setDemoCargando(false)
    }
  }

  useEffect(() => {
    const sesion = cargarSesion()
    if (sesion) {
      wbRef.current = sesion.wb
      setWb(sesion.wb)
      setToken(sesion.token)
      setCambios(sesion.cambios)
      setHoja(sesion.wb.hojas[0]?.name ?? null)
      setDemoCargando(false)
      return
    }
    void iniciarDemo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function persistir(completo: WorkbookFull, tok: string, numCambios: number) {
    const ok = guardarSesion({
      token: tok,
      cambios: numCambios,
      wb: completo,
      guardadoEn: new Date().toISOString(),
    })
    setAvisoLocal(
      ok ? null : 'Sin espacio en el navegador: los últimos cambios no se han guardado.',
    )
  }

  function aplicar(fn: (workbook: WorkbookFull) => WorkbookFull) {
    if (!wb || !token) return
    try {
      const next = fn(wb)
      const numCambios = cambios + 1
      setWb(next)
      setCambios(numCambios)
      setRowsError(null)
      persistir(next, token, numCambios)
    } catch (error: unknown) {
      setRowsError(messageOf(error, 'No se pudo aplicar el cambio'))
    }
  }

  const handleFile = async (file: File) => {
    setBusy(true)
    setUploadError(null)
    setRowsError(null)
    setAvisoLocal(null)
    try {
      const manifest = await uploadWorkbook(file)
      borrarSesion()
      instalar(await cargarHojas(manifest))
    } catch (error: unknown) {
      setUploadError(messageOf(error, 'No se pudo cargar el archivo'))
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    if (
      !window.confirm(
        '¿Restablecer el Excel? Se descartarán todos tus cambios locales.',
      )
    ) {
      return
    }
    borrarSesion()
    wbRef.current = null
    setWb(null)
    setToken(null)
    setCambios(0)
    setRowsError(null)
    setAvisoLocal(null)
    void iniciarDemo()
  }

  const hojaActiva = wb && hoja ? hojaDe(wb, hoja) : null
  const conEstado = hojaActiva ? hojaActiva.header.some((col) => esColumnaEstado(col)) : false

  const filtradas = useMemo(() => {
    if (!hojaActiva) return []
    let rows = hojaActiva.rows
    const texto = norm(query)
    if (texto) rows = rows.filter((fila) => fila.some((celda) => norm(celda).includes(texto)))
    if (soloActivos && conEstado) {
      const iEstado = hojaActiva.header.findIndex((col) => esColumnaEstado(col))
      rows = rows.filter((fila) => norm(fila[iEstado]) === 'activo')
    }
    return rows
  }, [hojaActiva, query, soloActivos, conEstado])

  const kpisData = useMemo(() => {
    const data: Record<string, SheetData> = {}
    if (!wb) return data
    for (const h of wb.hojas) data[h.name] = { header: h.header, rows: h.rows }
    return data
  }, [wb])
  const kpis = useMemo(() => calcularKpis(kpisData, hoy), [kpisData, hoy])

  const filtrando = Boolean(query.trim()) || (soloActivos && conEstado)

  function seleccionarHoja(name: string) {
    setHoja(name)
    setPagina(0)
    setOcultas([])
    setRowsError(null)
  }

  function cambiarQuery(valor: string) {
    setQuery(valor)
    setPagina(0)
  }

  function anadirColumnaDialogo() {
    const nombre = window.prompt('Nombre de la nueva columna:')
    if (nombre === null) return
    aplicar((w) => anadirColumna(w, hoja ?? '', nombre))
  }

  const abrirSelector = () => fileRef.current?.click()

  if (!wb) {
    return (
      <main className="standalone">
        <header className="brand-head">
          <span className="brand-mark" aria-hidden="true">
            E
          </span>
          <div>
            <h1>EasyExcel Panel</h1>
            <p>
              {demoCargando
                ? 'Cargando el libro demo…'
                : 'Sube un .xlsx, explora sus hojas y trabaja con sus datos en el navegador.'}
            </p>
          </div>
        </header>
        <UploadZone onFile={handleFile} busy={busy} error={uploadError} />
      </main>
    )
  }

  return (
    <div className="app-shell">
      <Sidebar wb={wb} active={hoja} onSelect={seleccionarHoja} onReset={reset} />

      <div className="app-main">
        <Topbar
          sheetCount={wb.hojas.length}
          query={query}
          onQuery={cambiarQuery}
          onUploadClick={abrirSelector}
          token={token}
          cambios={cambios}
          onReset={reset}
        />

        <div className="app-content">
          <section className="banner">
            <div>
              <h2>
                Gestión de Personal y Operaciones
                <span className="banner-pill">
                  Corte:{' '}
                  {hoy.toLocaleDateString('es-ES', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                </span>
              </h2>
              <p>
                Modo demo: los cambios se guardan solo en tu navegador — pulsa Restablecer
                para volver al original.
              </p>
            </div>
            <div className="banner-actions">
              <button type="button" className="btn btn-onbanner" onClick={() => aplicar((w) => anadirFila(w, hoja ?? ''))}>
                Nueva fila
              </button>
              <button type="button" className="btn btn-onbanner" onClick={anadirColumnaDialogo}>
                Nueva columna
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
          {rowsError ? (
            <p role="alert" className="error">
              {rowsError}
            </p>
          ) : null}
          {avisoLocal ? (
            <p role="status" className="aviso">
              {avisoLocal}
            </p>
          ) : null}

          <KpiCards kpis={kpis} />

          <section className="grid-section">
            <div className="grid-head">
              <SheetSelector
                sheets={wb.hojas.map((h) => ({
                  name: h.name,
                  rows: h.rows.length,
                  cols: h.header.length,
                }))}
                active={hoja ?? ''}
                onSelect={seleccionarHoja}
              />
              <span className="grid-meta">
                {hojaActiva ? `${hojaActiva.rows.length} filas · edita en local` : 'Cargando hoja…'}
              </span>
            </div>

            <Toolbar
              header={hojaActiva?.header ?? []}
              mostrarChipActivos={conEstado}
              soloActivos={soloActivos}
              onSoloActivos={() => {
                setSoloActivos((on) => !on)
                setPagina(0)
              }}
              ocultas={ocultas}
              onToggleCol={(i) =>
                setOcultas((prev) =>
                  prev.includes(i) ? prev.filter((n) => n !== i) : [...prev, i],
                )
              }
              coincidencias={query.trim() ? filtradas.length : null}
              onAddRow={() => aplicar((w) => anadirFila(w, hoja ?? ''))}
              onAddCol={anadirColumnaDialogo}
            />

            {hojaActiva ? (
              <GridView
                sheetName={hojaActiva.name}
                header={hojaActiva.header}
                rows={filtradas.slice(pagina, pagina + PAGE_SIZE)}
                total={filtradas.length}
                offset={pagina}
                limit={PAGE_SIZE}
                onPage={(nueva) => {
                  setRowsError(null)
                  setPagina(nueva)
                }}
                hiddenCols={ocultas}
                filtered={filtrando}
                onEdit={(fila, col, valor) =>
                  aplicar((w) => editarCelda(w, hoja ?? '', fila, col, valor))
                }
                onDeleteRow={(fila) => aplicar((w) => borrarFila(w, hoja ?? '', fila))}
              />
            ) : (
              <p className="loading">Cargando hoja…</p>
            )}
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
