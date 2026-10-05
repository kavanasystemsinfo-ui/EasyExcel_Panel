const SUGERENCIAS = [
  '¿Quién está de vacaciones hoy?',
  '¿Qué centro tiene más huecos?',
  'Muéstrame revisiones vencidas',
]

function CopilotPanel() {
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
        <span className="badge badge-warn">IA sin conectar</span>
      </header>
      <input
        className="copilot-input"
        type="text"
        disabled
        placeholder="Pregúntale a tus datos… (disponible cuando se conecte el modelo)"
        aria-label="Pregunta al copiloto"
      />
      <p className="copilot-chips">
        {SUGERENCIAS.map((texto) => (
          <span key={texto} className="chip chip-static">
            {texto}
          </span>
        ))}
      </p>
      <p className="copilot-foot">Motor de IA: pendiente de configuración de credenciales.</p>
    </section>
  )
}

export default CopilotPanel
