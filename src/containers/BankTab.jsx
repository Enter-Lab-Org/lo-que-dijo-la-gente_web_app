import { useEffect, useRef, useState } from "react";
import { MAX_ANSWERS } from "../domain/constants";
import * as B from "../domain/bank";
import { toText } from "../domain/textFormat";
import { themeFromBackup } from "../domain/theme";
import { clone, plural, today, uid } from "../domain/utils";
import BankToolbar from "../components/bank/BankToolbar";
import BankList from "../components/bank/BankList";
import QuestionForm from "../components/bank/QuestionForm";
import ImportPanel from "../components/bank/ImportPanel";
import BackupPanel from "../components/bank/BackupPanel";

const emptyForm = (cat = "") => ({ id: null, q: "", cat, answers: B.blankAnswers() });
const FORM_ERRORS = { "missing-question": "Escribe la pregunta.", "missing-answers": "Agrega al menos una respuesta." };

export default function BankTab({ bankStore, game, themeStore, files }) {
  const { bank, setBank } = bankStore;
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("");
  const [notice, setNotice] = useState(null);
  const [form, setForm] = useState(() => emptyForm());
  const [formMsg, setFormMsg] = useState("");
  const [impText, setImpText] = useState("");
  const [impCat, setImpCat] = useState("");
  const [impMsg, setImpMsg] = useState("");
  const [expMsg, setExpMsg] = useState("");
  const formRef = useRef(null), questionRef = useRef(null);

  const options = B.categoryOptions(bank);
  const activeCat = options.some((o) => o.value === cat) ? cat : "";
  const items = B.filterBank(bank, { query, cat: activeCat });
  const visible = () => B.filterBank(bankStore.current(), { query, cat: activeCat });
  useEffect(() => { setNotice(null); }, [bank, query, activeCat]);

  const resetForm = (keepCat) => setForm((f) => emptyForm(keepCat ? f.cat : ""));
  const g = game.actions;

  const list = {
    onAddAll: () => { const n = g.addToGame(visible()); setNotice(n ? `Agregué ${n} a la partida` : "Ya estaban en la partida"); },
    onToggleGame: (item) => { if (g.isInGame(item.id)) g.removeFromGame(item.id); else g.addToGame([item]); },
    onEdit: (item) => {
      setForm({ id: item.id, q: item.q, cat: item.cat || "", answers: clone(item.answers) });
      setFormMsg("");
      if (formRef.current && formRef.current.scrollIntoView) formRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    // Deleting from the bank does not remove the copy from the game.
    onDelete: (id) => { setBank(B.deleteQuestion(bankStore.current(), id)); if (form.id === id) resetForm(true); },
  };

  const formHandlers = {
    onChange: (field, value) => setForm((f) => ({ ...f, [field]: value })),
    onAnswer: (i, key, value) => setForm((f) => ({ ...f, answers: f.answers.map((a, j) => (j === i ? { ...a, [key]: value } : a)) })),
    onAddAnswer: () => setForm((f) => (f.answers.length < MAX_ANSWERS ? { ...f, answers: [...f.answers, B.blankAnswer()] } : f)),
    onRemoveAnswer: (i) => setForm((f) => { const answers = f.answers.filter((_, j) => j !== i); return { ...f, answers: answers.length ? answers : [B.blankAnswer()] }; }),
    onClear: () => { resetForm(true); setFormMsg(""); },
    onSubmit: () => {
      const r = B.validateQuestion(form);
      if (r.error) { setFormMsg(FORM_ERRORS[r.error]); if (r.error === "missing-question" && questionRef.current) questionRef.current.focus(); return; }
      const editing = !!form.id;
      const { bank: next, row } = B.upsertQuestion(bankStore.current(), { id: form.id || uid(), ...r.question });
      setBank(next);
      g.syncCopy(row);
      setFormMsg(editing ? "Cambios guardados." : "Guardada en el banco.");
      resetForm(true);
    },
  };

  const onNew = () => { setForm(emptyForm()); setFormMsg(""); if (questionRef.current) questionRef.current.focus(); };

  const onImport = () => {
    const r = B.importBlock(bankStore.current(), impText, impCat);
    if (!r.count) { setImpMsg("No encontré preguntas. Revisa que cada una tenga al menos una respuesta debajo."); return; }
    setBank(r.bank);
    setImpMsg(`Listo: ${r.count} ${plural(r.count, "pregunta")} en el banco.` + (r.skipped ? ` Omití ${r.skipped} ${plural(r.skipped, "bloque")} sin respuestas.` : ""));
    setImpText("");
  };

  const onOpenFile = async () => {
    const f = await files.openFile(); if (!f) return;
    if (!/\.json$/i.test(f.name)) { setImpText(f.text); setImpMsg(`Cargué ${f.name}. Revisa el texto y toca Importar al banco.`); return; }
    const r = B.mergeBackup(bankStore.current(), f.text);
    if (r.error === "invalid") { setImpMsg("Ese archivo no es un respaldo válido."); return; }
    if (r.error === "empty") { setImpMsg("El respaldo no trae preguntas."); return; }
    setBank(r.bank);
    let msg = `Respaldo cargado: ${r.count} ${plural(r.count, "pregunta")}.`;
    if (r.theme) { themeStore.actions.commitTheme(themeFromBackup(themeStore.current(), r.theme)); msg += " También cargué el diseño."; }
    setImpMsg(msg);
  };

  const save = async (name, text, mime) => {
    try { const m = await files.saveFile(name, text, mime); if (m) setExpMsg(m); }
    catch (e) { setExpMsg("No se pudo guardar el archivo."); }
  };
  const onBackup = () => save(`respaldo-lo-que-dijo-la-gente-${today()}.json`, JSON.stringify(B.buildBackup(bankStore.current(), themeStore.current()), null, 2), "application/json");
  const onExportText = () => {
    const txt = toText(visible());
    if (!txt) { setExpMsg("No hay preguntas para exportar."); return; }
    save(`preguntas-${today()}.txt`, txt, "text/plain");
  };

  return (
    <div className="b-grid">
      <div className="card">
        <BankToolbar query={query} onQuery={setQuery} cat={activeCat} options={options} onCat={setCat} onNew={onNew} />
        <BankList items={items} total={bank.length} notice={notice} isInGame={(id) => game.state.list.some((x) => x.id === id)} {...list} />
      </div>
      <div className="b-side">
        <QuestionForm form={form} categories={B.categories(bank)} message={formMsg} formRef={formRef} questionRef={questionRef} {...formHandlers} />
        <ImportPanel text={impText} onText={setImpText} cat={impCat} onCat={setImpCat} message={impMsg} onImport={onImport} onOpenFile={onOpenFile} />
        <BackupPanel message={expMsg} onBackup={onBackup} onExportText={onExportText} />
      </div>
    </div>
  );
}
