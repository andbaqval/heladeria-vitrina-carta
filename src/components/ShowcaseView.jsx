import { FAMILY_NAMES } from '../domain';
import { statusLabel } from './status';

export default function ShowcaseView({ entities, alerts, profile, onSetStatus }) {
  const availableCount = entities.filter((item) => item.status === 'in_vitrina').length;

  return (
    <main className="panel">
      <section className="panel-heading">
        <div><p className="eyebrow">Panel en vivo</p><h2>Hoy en la vitrina</h2></div>
        <div className="counter"><strong>{availableCount}</strong><span>disponibles</span></div>
      </section>
      {alerts.length > 0 && (
        <div className="warning-list">
          {alerts.map((alert) => <p key={alert.family}><span>!</span> {alert.family}: quedan {alert.inShowcase} sabores en vitrina.</p>)}
        </div>
      )}
      <div className="panel-grid">
        {FAMILY_NAMES.map((family) => {
          const items = entities.filter((item) => item.type === 'sabor' && item.family === family);
          const available = items.filter((item) => item.status === 'in_vitrina');
          if (!items.length) return null;
          return (
            <section className="panel-family" key={family}>
              <h3>{family}<span>{available.length}/{items.length}</span></h3>
              {items.map((item) => (
                <article className={`panel-item ${item.status}`} key={item.id}>
                  <div><b>{item.name}</b><small>{statusLabel(item.status)}</small></div>
                  {profile === 'Operación' && (
                    <div className="status-actions">
                      <button title="En vitrina" onClick={() => onSetStatus(item, 'in_vitrina')} className={item.status === 'in_vitrina' ? 'selected' : ''}>●</button>
                      <button title="Agotado hoy" onClick={() => onSetStatus(item, 'agotado')} className={item.status === 'agotado' ? 'selected' : ''}>A</button>
                      <button title="Fuera de temporada" onClick={() => onSetStatus(item, 'temporada')} className={item.status === 'temporada' ? 'selected' : ''}>T</button>
                    </div>
                  )}
                </article>
              ))}
            </section>
          );
        })}
      </div>
    </main>
  );
}
