import ArmedButton from "../atoms/ArmedButton";
import { answerTotal } from "../../domain/bank";
import { plural } from "../../domain/utils";

export default function BankItem({ item, inGame, onToggleGame, onEdit, onDelete }) {
  const n = item.answers.length;
  return (
    <li className={"b-item" + (inGame ? " inlist" : "")}>
      <div>
        <div className="b-q">{item.q}</div>
        <div className="b-meta">
          {item.cat ? <span className="chip">{item.cat}</span> : null}
          {`${n} ${plural(n, "respuesta")} · ${answerTotal(item.answers)} pts`}
        </div>
        <div className="b-ans">{item.answers.map((a) => `${a.text} ${a.pts}`).join(" · ")}</div>
      </div>
      <div className="b-acts">
        <button className={"btn sm" + (inGame ? "" : " b")} type="button" onClick={() => onToggleGame(item)}>{inGame ? "Quitar de la partida" : "Agregar a la partida"}</button>
        <button className="btn sm" type="button" onClick={() => onEdit(item)}>Editar</button>
        <ArmedButton className="btn sm" armedLabel="¿Eliminar?" onConfirm={() => onDelete(item.id)}>Eliminar</ArmedButton>
      </div>
    </li>
  );
}
