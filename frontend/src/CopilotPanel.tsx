import { useState } from 'react'
import { copilotoStream } from './api'

const SUGERENCIAS = [
  '¿Cómo va el día?',
  '¿Qué necesito gestionar hoy?',
  '¿Qué alertas hay abiertas?',
  '¿Quién está de vacaciones hoy?',
  '¿Qué centro tiene más huecos?',
  'Muéstrame revisiones vencidas',
]

/** Render minimalista de markdown para respuestas del copiloto: **negrita**, *cursiva*, listas. */
function renderRespuesta(texto: string): string {
  const escachado = texto
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
  return escachado
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/\n/g, '<br/>')
}

type Props = { contexto: unknown; abierto: boolean; onToggle: () => void }

function CopilotPanel({ contexto, abierto, onToggle }: Props) {
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
    <section className="panel-card copilot" aria-label="Asistente IA">
      <header className="panel-head copilot-head">
        <button
          type="button"
          className="copilot-toggle"
          aria-expanded={abierto}
          onClick={onToggle}
        >
          <span className="copilot-spark material-symbols-outlined" aria-hidden="true">
            auto_awesome
          </span>
          <span className="copilot-titulo">
            <strong>Asistente IA</strong>
            <small>Pregúntale a tus hojas en lenguaje natural</small>
          </span>
          <span className="badge badge-ok">Modelos gratuitos</span>
          <span className="copilot-chevron material-symbols-outlined" aria-hidden="true">
            {abierto ? 'expand_less' : 'expand_more'}
          </span>
        </button>
      </header>

      {abierto ? (
        <>
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
            <p
              className="copilot-respuesta"
              aria-live="polite"
              role="status"
              dangerouslySetInnerHTML={{ __html: renderRespuesta(respuesta) }}
            />
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
        </>
      ) : null}
    </section>
  )
}

export default CopilotPanel
