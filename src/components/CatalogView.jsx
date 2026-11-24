import { FAMILY_NAMES, POT_SIZES } from '../domain';
import { statusClass, statusLabel } from './status';

export default function CatalogView({
  entities,
  profile,
  search,
  onSearchChange,
  familyFilter,
  onFamilyFilterChange,
  statusFilter,
  onStatusFilterChange,
  onEdit,
}) {
  return (
    <main>
      <section className="filters" aria-label="Filtros del catálogo">
        <input aria-label="Buscar producto" placeholder="Buscar sabor o postre…" value={search} onChange={(event) => onSearchChange(event.target.value)} />
        <select aria-label="Filtrar por familia" value={familyFilter} onChange={(event) => onFamilyFilterChange(event.target.value)}>
          <option>Todas</option>
          {FAMILY_NAMES.map((family) => <option key={family}>{family}</option>)}
        </select>
        <select aria-label="Filtrar por estado" value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value)}>
          <option>Todos</option>
          <option>En vitrina</option>
          <option>Agotado hoy</option>
          <option>Fuera de temporada</option>
        </select>
      </section>

      <section className="catalogue">
        {FAMILY_NAMES.map((family) => {
          const products = entities.filter((item) => item.type === 'sabor' && item.family === family);
          if (products.length === 0) return null;
          return (
            <div className="family" key={family}>
              <h2>{family}</h2>
              <div className="flavor-grid">
                {products.map((item) => (
                  <article className={`flavor-card ${item.status === 'in_vitrina' ? '' : 'muted'}`} key={item.id}>
                    <div>
                      <h3>{item.name}</h3>
                      <span className={statusClass(item.status)}>{statusLabel(item.status)}</span>
                    </div>
                    {profile === 'Operación' && (
                      <button className="icon-edit" onClick={() => onEdit(item)} aria-label={`Editar ${item.name}`}>•••</button>
                    )}
                  </article>
                ))}
              </div>
            </div>
          );
        })}
        {entities.some((item) => item.type === 'postre') && (
          <div className="family dessert-family">
            <h2>Postres helados</h2>
            <div className="flavor-grid">
              {entities.filter((item) => item.type === 'postre').map((item) => (
                <article className="flavor-card" key={item.id}>
                  <div><h3>{item.name}</h3><strong>${item.price.toLocaleString('es-UY')}</strong></div>
                  {profile === 'Operación' && <button className="icon-edit" onClick={() => onEdit(item)} aria-label={`Editar ${item.name}`}>•••</button>}
                </article>
              ))}
            </div>
          </div>
        )}
      </section>

      <aside className="pot-prices">
        <h2>Potes artesanales</h2>
        <div>{POT_SIZES.map((pot) => <span key={pot.name}><b>{pot.name}</b><strong>${pot.price.toLocaleString('es-UY')}</strong></span>)}</div>
        <small>Carta fija publicada · no editable</small>
      </aside>
    </main>
  );
}
