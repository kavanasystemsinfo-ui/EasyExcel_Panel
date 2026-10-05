import { useState, type ChangeEvent, type DragEvent } from 'react'

type Props = {
  onFile: (file: File) => void
  busy: boolean
  error: string | null
}

function UploadZone({ onFile, busy, error }: Props) {
  const [inputError, setInputError] = useState<string | null>(null)

  function aceptar(file: File | undefined | null): string | null {
    if (!file || busy) return null
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      return 'Formato no soportado: sube un archivo .xlsx (no .xls ni .csv).'
    }
    onFile(file)
    return null
  }

  function handleInput(event: ChangeEvent<HTMLInputElement>) {
    const localError = aceptar(event.target.files?.[0])
    setInputError(localError)
    event.target.value = ''
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setInputError(aceptar(event.dataTransfer.files?.[0]))
  }

  const mensaje = inputError ?? error

  return (
    <div className="upload-stage">
      <div
        className="upload-card"
        data-testid="upload-zone"
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        <span className="upload-icon material-symbols-outlined" aria-hidden="true">
          upload_file
        </span>
        <h2>¿Por dónde empezamos?</h2>
        <p className="upload-sub">
          Arrastra aquí tu archivo <strong>.xlsx</strong> o selecciónalo desde tu equipo.
        </p>
        <label className="btn btn-primary upload-pick">
          {busy ? 'Cargando…' : 'Elegir archivo'}
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            aria-label="Archivo Excel"
            disabled={busy}
            onChange={handleInput}
          />
        </label>
        {mensaje ? (
          <p role="alert" className="error">
            {mensaje}
          </p>
        ) : null}
        <p className="upload-hint">Límites: 10 MB · 50 hojas · 200 columnas · 100.000 filas</p>
      </div>
    </div>
  )
}

export default UploadZone
