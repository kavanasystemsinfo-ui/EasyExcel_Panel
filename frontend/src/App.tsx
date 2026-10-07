import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import {
  exportSheet,
  getDemo,
  getSheetRows,
  PAGE_SIZE,
  uploadWorkbook,
  type Workbook,
} from './api'
import { esColumnaEstado, norm } from './cells'
import { generarGraficos } from './charts'
import {
  anadirColumna,
  anadirFila,
  borrarFila,
  editarCelda,
  hojaDe,
  type WorkbookFull,
} from './edit'
import { pasaFiltros, resumenFiltros, type Filtro } from './filters'
import { descargarBlob, nombreExport, payloadExport } from './export'
import { calcularKpis, type SheetData } from './kpis'
import { buscarEnLibro } from './search'
import {
  ES_SECCION,
  SECCIONES,
  alertasDeSeccion,
  graficosDeSeccion,
  hojasDeSeccion,
  kpisDeSeccion,
  type Seccion,
} from './views'
import { construirContexto } from './copilot'
import Alertas from './Alertas'
import CoveragePanel from './CoveragePanel'
import ChartsPanel from './ChartsPanel'
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
  const [filtros, setFiltros] = useState<Filtro[]>([])
  const [destacada, setDestacada] = useState<number | null>(null)
  const [seccion, setSeccion] = useState<Seccion>('resumen')
  const [hoy] = useState(() => new Date())
  const fileRef = useRef<HTMLInputElement>(null)
  const wbRef = useRef<WorkbookFull | null>(null)
  const destacadaTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function instalar(completo: WorkbookFull, destino: Seccion = 'resumen') {
    const tok = nuevoToken()
    wbRef.current = completo
    setWb(completo)
    setToken(tok)
    setCambios(0)
    setSeccion(destino)
    setHoja(completo.hojas[0]?.name ?? null)
    setPagina(0)
    setQuery('')
    setSoloActivos(false)
    setOcultas([])
    setFiltros([])
    setDestacada(null)
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
      const vista = sesion.vista
      const seccionOk: Seccion =
        vista?.seccion && ES_SECCION(vista.seccion) ? vista.seccion : 'resumen'
      const nombres = sesion.wb.hojas.map((h) => h.name)
      const visibles = hojasDeSeccion(seccionOk, nombres)
      const hojaOk =
        vista?.hoja &&
        nombres.includes(vista.hoja) &&
        (seccionOk === 'resumen' || visibles.includes(vista.hoja))
      setSeccion(seccionOk)
      setHoja(hojaOk ? vista.hoja : (visibles[0] ?? nombres[0] ?? null))
      setQuery(vista?.query ?? '')
      setSoloActivos(vista?.soloActivos ?? false)
      setOcultas(vista?.ocultas ?? [])
      const headerActiva = hojaOk
        ? sesion.wb.hojas.find((h) => h.name === vista.hoja)?.header ?? []
        : []
      setFiltros(
        (vista?.filtros ?? []).filter(
          (f) => f.col >= 0 && f.col < headerActiva.length,
        ),
      )
      setPagina(vista?.pagina ?? 0)
      setDemoCargando(false)
      return
    }
    void iniciarDemo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!token || !wb) return
    const sesion = cargarSesion()
    if (!sesion || sesion.token !== token) return
    guardarSesion({
      ...sesion,
      vista: { seccion, hoja, query, soloActivos, ocultas, filtros, pagina },
    })
  }, [token, wb, seccion, hoja, query, soloActivos, ocultas, filtros, pagina])

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
      instalar(await cargarHojas(manifest), 'datos')
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

  const pares = useMemo(() => {
    if (!hojaActiva) return [] as { fila: unknown[]; i: number }[]
    let conIndice = hojaActiva.rows.map((fila, i) => ({ fila, i }))
    const texto = norm(query)
    if (texto) {
      conIndice = conIndice.filter(({ fila }) =>
        fila.some((celda) => norm(celda).includes(texto)),
      )
    }
    if (soloActivos && conEstado) {
      const iEstado = hojaActiva.header.findIndex((col) => esColumnaEstado(col))
      conIndice = conIndice.filter(({ fila }) => norm(fila[iEstado]) === 'activo')
    }
    if (filtros.length) {
      conIndice = conIndice.filter(({ fila }) => pasaFiltros(fila, filtros))
    }
    return conIndice
  }, [hojaActiva, query, soloActivos, conEstado, filtros])

  const kpisData = useMemo(() => {
    const data: Record<string, SheetData> = {}
    if (!wb) return data
    for (const h of wb.hojas) data[h.name] = { header: h.header, rows: h.rows }
    return data
  }, [wb])
  const kpis = useMemo(() => calcularKpis(kpisData, hoy), [kpisData, hoy])
  const graficos = useMemo(() => generarGraficos(kpisData), [kpisData])

  const busquedaGlobal = useMemo(() => {
    if (!wb || norm(query).length < 2) return null
    const resultado = buscarEnLibro(wb.hojas, query, 8)
    return resultado.total > 0
      ? { total: resultado.total, items: resultado.coincidencias }
      : null
  }, [wb, query])

  const filtrando = Boolean(query.trim()) || (soloActivos && conEstado) || filtros.length > 0
  const nombresHojas = wb ? wb.hojas.map((h) => h.name) : []
  const hojasVisibles = hojasDeSeccion(seccion, nombresHojas)
  const sheetsSelector = (wb?.hojas ?? [])
    .filter((h) => hojasVisibles.includes(h.name))
    .sort((a, b) => hojasVisibles.indexOf(a.name) - hojasVisibles.indexOf(b.name))
    .map((h) => ({ name: h.name, rows: h.rows.length, cols: h.header.length }))
  const kpisSeccion = kpisDeSeccion(seccion)
  const graficosSeccion = graficosDeSeccion(seccion, graficos)
  const nombreSeccion = SECCIONES.find((s) => s.id === seccion)?.nombre ?? 'Panel'
  const filtrosImpresion = resumenFiltros(
    hojaActiva?.header ?? [],
    query,
    soloActivos && conEstado,
    filtros,
  )

  const contextoCopiloto = useMemo(() => {
    const resumen = resumenFiltros(
      hojaActiva?.header ?? [],
      query,
      soloActivos && conEstado,
      filtros,
    )
    return construirContexto({
      hoja: hoja ?? '',
      seccion: nombreSeccion,
      filtros: resumen,
      kpis,
      alertas: alertasDeSeccion(kpis).map((alerta) => alerta.texto),
      header: hojaActiva?.header ?? [],
      filas: pares.map(({ fila }) => fila),
    })
  }, [
    hojaActiva,
    query,
    soloActivos,
    conEstado,
    filtros,
    kpis,
    hoja,
    nombreSeccion,
    pares,
  ])

  function seleccionarHoja(name: string) {
    setHoja(name)
    setPagina(0)
    setOcultas([])
    setFiltros([])
    setDestacada(null)
    setRowsError(null)
  }

  function cambiarSeccion(siguiente: Seccion) {
    setSeccion(siguiente)
    const nombres = wb?.hojas.map((h) => h.name) ?? []
    const visibles = hojasDeSeccion(siguiente, nombres)
    if (siguiente !== 'resumen' && visibles.length && !visibles.includes(hoja ?? '')) {
      seleccionarHoja(visibles[0])
    }
  }

  function irA(hojaDestino: string, fila: number) {
    setSeccion('datos')
    seleccionarHoja(hojaDestino)
    setPagina(Math.floor(fila / PAGE_SIZE) * PAGE_SIZE)
    setDestacada(fila)
    if (destacadaTimer.current) clearTimeout(destacadaTimer.current)
    destacadaTimer.current = setTimeout(() => setDestacada(null), 5000)
  }

  function quitarFiltro(col: number) {
    setFiltros((prev) => prev.filter((f) => f.col !== col))
    setPagina(0)
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

  async function exportarExcel() {
    if (!wb || !hoja || !hojaActiva) return
    try {
      const payload = payloadExport(
        hojaActiva.header,
        ocultas,
        pares.map((p) => p.fila),
      )
      const blob = await exportSheet(wb.id, hoja, payload)
      descargarBlob(blob, nombreExport(wb.filename, hoja))
    } catch (error: unknown) {
      setRowsError(messageOf(error, 'No se pudo exportar la hoja'))
    }
  }

  const exportarPdf = () => window.print()

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
      <Sidebar
        wb={wb}
        seccion={seccion}
        onSeccion={cambiarSeccion}
        active={hoja}
        onSelect={seleccionarHoja}
        onReset={reset}
      />

      <div className="app-main">
        <Topbar
          sheetCount={wb.hojas.length}
          query={query}
          onQuery={cambiarQuery}
          onUploadClick={abrirSelector}
          token={token}
          cambios={cambios}
          onReset={reset}
          resultados={busquedaGlobal}
          onIrA={irA}
          exportExcel={seccion !== 'resumen'}
          onExportExcel={exportarExcel}
          onExportPdf={exportarPdf}
        />

        <div className="app-content">
          <div className="print-head">
            <span className="print-head-title">
              EasyExcel Panel · {nombreSeccion}
            </span>
            <span className="print-head-meta">
              {seccion !== 'resumen' && hojaActiva ? `${hojaActiva.name} · ` : ''}
              {hoy.toLocaleDateString('es-ES', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              })}
              {filtrosImpresion.length ? ` · ${filtrosImpresion.join(' · ')}` : ''}
            </span>
          </div>

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

          <KpiCards kpis={kpis} solo={kpisSeccion} />

          {seccion === 'resumen' ? (
            <Alertas kpis={kpis} />
          ) : (
            <section className="grid-section">
              <div className="grid-head">
                <SheetSelector
                  sheets={sheetsSelector}
                  active={hoja ?? ''}
                  onSelect={seleccionarHoja}
                />
                <span className="grid-meta">
                  {hojaActiva
                    ? `${hojaActiva.rows.length} filas · edita en local`
                    : 'Cargando hoja…'}
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
                coincidencias={query.trim() ? pares.length : null}
                filtros={filtros}
                onQuitarFiltro={quitarFiltro}
                onAddRow={() => aplicar((w) => anadirFila(w, hoja ?? ''))}
                onAddCol={anadirColumnaDialogo}
                onExportExcel={exportarExcel}
                onExportPdf={exportarPdf}
              />

              {hojaActiva ? (
                <GridView
                  sheetName={hojaActiva.name}
                  header={hojaActiva.header}
                  rows={pares.slice(pagina, pagina + PAGE_SIZE).map((p) => p.fila)}
                  rowIds={pares.slice(pagina, pagina + PAGE_SIZE).map((p) => p.i)}
                  total={pares.length}
                  offset={pagina}
                  limit={PAGE_SIZE}
                  onPage={(nueva) => {
                    setRowsError(null)
                    setPagina(nueva)
                  }}
                  hiddenCols={ocultas}
                  filtered={filtrando}
                  allRows={hojaActiva.rows}
                  filtros={filtros}
                  onFiltros={(nuevos) => {
                    setFiltros(nuevos)
                    setPagina(0)
                  }}
                  highlight={destacada}
                  onEdit={(fila, col, valor) =>
                    aplicar((w) => editarCelda(w, hoja ?? '', fila, col, valor))
                  }
                  onDeleteRow={(fila) => aplicar((w) => borrarFila(w, hoja ?? '', fila))}
                />
              ) : (
                <p className="loading">Cargando hoja…</p>
              )}
            </section>
          )}

          <section className="bottom-panels">
            <CopilotPanel contexto={contextoCopiloto} />
            {seccion === 'operaciones' && kpis.cobertura?.length ? (
              <CoveragePanel cobertura={kpis.cobertura} />
            ) : null}
            {graficosSeccion.length ? <ChartsPanel graficos={graficosSeccion} /> : null}
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
