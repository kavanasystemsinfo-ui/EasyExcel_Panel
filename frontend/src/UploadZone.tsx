import { useRef, useState } from 'react'
import { MAX_UPLOAD_BYTES } from './api'

type Props = {
  onFile: (file: File) => void
  busy: boolean
  error: string | null
}

function checkFile(file: File): string | null {
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    return 'Solo se admiten archivos .xlsx'
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return 'El archivo supera el limite de 10 MB'
  }
  return null
}

export default function UploadZone({ onFile, busy, error }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  const handle = (file: File | undefined) => {
    if (!file || busy) return
    const problem = checkFile(file)
    setLocalError(problem)
    if (!problem) onFile(file)
  }

  const shownError = localError ?? error

  return (
    <section className="upload">
      <div
        data-testid="upload-zone"
        className={`upload-zone${busy ? ' is-busy' : ''}`}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          handle(event.dataTransfer.files[0])
        }}
      >
        <p>
          <strong>Sube tu Excel</strong>
        </p>
        <p>Arrastra un archivo .xlsx aqui o</p>
        <label className="upload-button">
          {busy ? 'Cargando…' : 'Seleccionar archivo'}
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx"
            aria-label="Archivo Excel"
            disabled={busy}
            onChange={(event) => {
              handle(event.target.files?.[0] ?? undefined)
              event.target.value = ''
            }}
          />
        </label>
        <p className="upload-hint">Maximo 10 MB · primera fila como cabeceras</p>
      </div>
      {shownError ? (
        <p role="alert" className="error">
          {shownError}
        </p>
      ) : null}
    </section>
  )
}
