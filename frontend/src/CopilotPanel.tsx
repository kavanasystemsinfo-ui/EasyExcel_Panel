import { useState } from 'react'
import { copilotoStream } from './api'

const SUGERENCIAS = [
  '¿Quién está de vacaciones hoy?',
  '¿Qué centro tiene más huecos?',
  'Muéstrame revisiones vencidas',
]

type Props = { contexto: unknown }

function CopilotPanel({ contexto }: Props) {
  const [valor, setValor] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [respuesta, setRespuesta] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [meta, setMeta] = useState<{ proveedor: string; modelo: string } | null>(null)

  async function enviar(pregunta: string) {
    const limpia = pregunta.trim()
    if (!limpia || enviando) return
    setEnviando(true)
    setError(null)
    setRespuesta('')
    setMeta(null)
    try {
      const fin = await copilotoStream(limpia, contexto, (trozo) =>
        setRespuesta((previo) => previo + trozo),
      )
      setMeta({ proveedor: fin.proveedor, modelo: fin.modelo })
    } catch (exc: unknown) {
      setError(exc instanceof Error ? exc.message : 'El copiloto no pudo responder')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section className="panel-card copilot" aria-label="Copiloto de datos">
      <header className="panel-head">
        <div className="copilot-title">
          <span className="copilot-spark material-symbols-outlined" aria-hidden="true">
            auto_awesome
          </span>
          <div>
            <h3>Copiloto de datos</h3>
            <p>Pregúntale a tus hojas en lenguaje natural</p>
          </div>
        </div>
        <span className="badge badge-ok">Modelos gratuitos</span>
      </header>

      <div className="copilot-form">
        <input
          className="copilot-input"
          type="text"
          disabled={enviando}
          value={valor}
          placeholder="Pregúntale a tus datos…"
          aria-label="Pregunta al copiloto"
          onChange={(event) => setValor(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void enviar(valor)
            }
          }}
        />
        <button
          type="button"
          className="btn btn-primary copilot-send"
          disabled={enviando || !valor.trim()}
          onClick={() => void enviar(valor)}
        >
          {enviando ? 'Pensando…' : 'Enviar'}
        </button>
      </div>

      <p className="copilot-chips">
        {SUGERENCIAS.map((texto) => (
          <button
            key={texto}
            type="button"
            className="chip"
            disabled={enviando}
            onClick={() => {
              setValor(texto)
              void enviar(texto)
            }}
          >
            {texto}
          </button>
        ))}
      </p>

      {respuesta ? (
        <p className="copilot-respuesta" aria-live="polite">
          {respuesta}
        </p>
      ) : null}
      {enviando && !respuesta ? (
        <p className="copilot-respuesta copilot-cargando" aria-live="polite">
          Consultando los modelos gratuitos…
        </p>
      ) : null}
      {error ? (
        <p className="copilot-error" role="alert">
          {error}
        </p>
      ) : null}
      {meta ? (
        <p className="copilot-meta">
          {meta.proveedor} · {meta.modelo}
        </p>
      ) : null}

      <p className="copilot-foot">
        Modelos gratuitos externos para datos demo. No subas información personal real.
      </p>
    </section>
  )
}

export default CopilotPanel
