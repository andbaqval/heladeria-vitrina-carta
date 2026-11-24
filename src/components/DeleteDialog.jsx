export default function DeleteDialog({ onCancel, onConfirm }) {
  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="delete-title">
        <h2 id="delete-title">¿Eliminar producto?</h2>
        <p>Esta acción queda registrada en el historial y no puede deshacerse desde esta pantalla.</p>
        <div><button onClick={onCancel}>Cancelar</button><button className="danger-fill" onClick={onConfirm}>Eliminar</button></div>
      </div>
    </div>
  );
}
