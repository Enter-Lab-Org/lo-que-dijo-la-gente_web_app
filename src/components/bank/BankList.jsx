import BankItem from "./BankItem";
import { plural } from "../../domain/utils";

/* Bank results: count of visible vs total, add-all, and one row per question. */
export default function BankList({ items, total, notice, isInGame, onAddAll, onToggleGame, onEdit, onDelete }) {
  return (
    <>
      <div className="b-sub">
        <span id="bCount">{notice || `${items.length} de ${total} ${plural(total, "pregunta")}`}</span>
        <button className="btn sm" id="bAddAll" type="button" disabled={!items.some((b) => !isInGame(b.id))} onClick={onAddAll}>Agregar las que se ven a la partida</button>
      </div>
      <ul className="b-list" id="bList">
        {items.map((b) => <BankItem key={b.id} item={b} inGame={isInGame(b.id)} onToggleGame={onToggleGame} onEdit={onEdit} onDelete={onDelete} />)}
      </ul>
      <p className="hint" id="bEmpty" hidden={items.length > 0}>
        {total ? "Ninguna pregunta coincide con la búsqueda." : "Tu banco está vacío. Escribe una pregunta en el formulario o importa varias en bloque."}
      </p>
    </>
  );
}
