import { useEffect, useRef, useState } from "react";
import { MAX_ANSWERS } from "../domain/constants";
import { PROFILE_LIST, QUESTION_PROFILES, getProfile, savedPicks } from "../domain/profiles";
import { plural } from "../domain/utils";
import ProfilePanel from "../components/admin/ProfilePanel";
import BankQuestionForm from "../components/admin/BankQuestionForm";
import BankQuestionList from "../components/admin/BankQuestionList";
import CategoriesPanel from "../components/admin/CategoriesPanel";
import ConfirmDialog from "../components/admin/ConfirmDialog";
import UsersTab from "./UsersTab";

const PARTS = [["perfil", "Perfil del juego"], ["preguntas", "Preguntas"], ["categorias", "Categorías"], ["usuarios", "Usuarios"]];
const blankForm = () => ({ text: "", categoryId: "", profile: QUESTION_PROFILES.DEFAULT, answers: Array.from({ length: 5 }, () => ({ text: "", points: "" })) });
const byText = (a, b) => a.text.localeCompare(b.text, "es", { sensitivity: "base" });

/* Administración panel (ADMIN and OPERADOR): game profile, database question bank and categories;
   user management only when the role allows it. The server enforces every permission; this only shapes the UI. */
export default function AdminTab({ api, usersApi, canManageUsers, currentUserId, profileStore }) {
  const parts = PARTS.filter(([key]) => key !== "usuarios" || canManageUsers);
  const [part, setPart] = useState("perfil");
  const [questions, setQuestions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [catName, setCatName] = useState("");
  const { config, apply } = profileStore;
  const [chosenId, setChosenId] = useState(config.active);
  const chosenRef = useRef(config.active); // the chosen profile when the questions arrive
  const [selected, setSelected] = useState(() => new Set());
  const [confirm, setConfirm] = useState(false);
  const [pendingId, setPendingId] = useState(null); // profile to switch to once unapplied changes are discarded

  useEffect(() => {
    let alive = true;
    Promise.all([api.listQuestions(), api.listCategories()]).then(([qs, cs]) => {
      if (alive) { setQuestions(qs); setCategories(cs); setSelected(new Set(savedPicks(qs, chosenRef.current))); }
    }, (e) => { if (alive) setNotice({ ok: false, text: e.message }); });
    return () => { alive = false; };
  }, [api]);

  const run = async (action, done) => {
    setBusy(true);
    try { setNotice({ ok: true, text: await done(await action()) }); }
    catch (e) { setNotice({ ok: false, text: e.message }); }
    finally { setBusy(false); }
  };

  // Categories
  const addCategory = () => run(() => api.createCategory(catName), (c) => {
    setCategories((list) => [...list, c].sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" })));
    setCatName("");
    return "Categoría agregada: " + c.name;
  });
  const removeCategory = (c) => run(() => api.removeCategory(c.id), () => {
    setCategories((list) => list.filter((x) => x.id !== c.id));
    setQuestions((list) => list.map((q) => (q.categoryId === c.id ? { ...q, categoryId: null, category: "" } : q)));
    if (form.categoryId === String(c.id)) setForm((f) => ({ ...f, categoryId: "" }));
    return "Categoría eliminada: " + c.name;
  });

  // Questions
  const saveQuestion = () => run(() => api.createQuestion({
    text: form.text,
    categoryId: form.categoryId ? Number(form.categoryId) : null,
    profile: form.profile,
    answers: form.answers.filter((a) => a.text.trim()),
  }), (q) => {
    setQuestions((list) => [...list, q].sort(byText));
    setForm((f) => ({ ...blankForm(), categoryId: f.categoryId, profile: f.profile }));
    return "Pregunta guardada.";
  });
  const removeQuestion = (q) => run(() => api.removeQuestion(q.id), () => {
    setQuestions((list) => list.filter((x) => x.id !== q.id));
    setSelected((s) => { const n = new Set(s); n.delete(q.id); return n; });
    return "Pregunta eliminada.";
  });

  // Profile
  const chosen = getProfile(chosenId);
  const profileQuestions = questions.filter((q) => q.profile === chosen.questionProfile);
  const picked = profileQuestions.filter((q) => selected.has(q.id));
  const saved = savedPicks(questions, chosenId);
  const dirty = saved.length !== picked.length || picked.some((q) => !saved.includes(q.id));
  // Choosing a profile preloads the picks saved in the database for it (the same for every operator);
  // with unapplied changes it asks first, because they would be lost.
  const switchTo = (id) => { setPendingId(null); chosenRef.current = id; setChosenId(id); setSelected(new Set(savedPicks(questions, id))); };
  const choose = (id) => { if (id === chosenId) return; if (dirty) setPendingId(id); else switchTo(id); };
  const toggle = (id) => { setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }); };
  const all = (on) => { setSelected(new Set(on ? profileQuestions.map((q) => q.id) : [])); };
  const askApply = () => setConfirm(true);
  // The picks are saved first; if that fails, the profile and the game bank stay as they were.
  const doApply = () => {
    setConfirm(false);
    const qp = chosen.questionProfile;
    const ids = picked.map((q) => q.id);
    return run(() => api.savePicks(qp, ids), () => {
      const saved = questions.map((q) => (q.profile === qp ? { ...q, picked: ids.includes(q.id) } : q));
      setQuestions(saved);
      const n = apply(chosen.id, saved, ids);
      return `Perfil ${chosen.name} activo: ${n} ${plural(n, "pregunta")} en el banco del juego.`;
    });
  };

  return (
    <div className="admin-tab">
      <div className="seg a-nav" role="group" aria-label="Partes del panel">
        {parts.map(([key, label]) => (
          <button key={key} type="button" aria-pressed={String(part === key)} onClick={() => setPart(key)}>{label}</button>
        ))}
      </div>
      {notice && part !== "usuarios" && <p className={"hint" + (notice.ok ? "" : " err")} role="status">{notice.text}</p>}

      {part === "perfil" && (
        <ProfilePanel profiles={PROFILE_LIST} chosen={chosen} activeId={config.active} questions={profileQuestions} selected={selected} dirty={dirty}
          onChoose={choose} onToggle={toggle} onAll={all} onApply={askApply} />
      )}
      {part === "preguntas" && (
        <div className="a-grid">
          <BankQuestionForm form={form} categories={categories} busy={busy} maxAnswers={MAX_ANSWERS}
            onChange={(k, v) => setForm((f) => ({ ...f, [k]: v }))}
            onAnswer={(i, k, v) => setForm((f) => ({ ...f, answers: f.answers.map((a, j) => (j === i ? { ...a, [k]: v } : a)) }))}
            onAddRow={() => setForm((f) => (f.answers.length >= MAX_ANSWERS ? f : { ...f, answers: [...f.answers, { text: "", points: "" }] }))}
            onSubmit={saveQuestion} />
          <BankQuestionList questions={questions} busy={busy} onDelete={removeQuestion} />
        </div>
      )}
      {part === "categorias" && (
        <CategoriesPanel categories={categories} name={catName} busy={busy} onName={setCatName} onAdd={addCategory} onDelete={removeCategory} />
      )}
      {part === "usuarios" && canManageUsers && usersApi && <UsersTab api={usersApi} currentUserId={currentUserId} />}

      {pendingId && (
        <ConfirmDialog title={`¿Descartar los cambios sin aplicar de ${chosen.name}?`} onYes={() => switchTo(pendingId)} onNo={() => setPendingId(null)}>
          Las preguntas marcadas o desmarcadas que no aplicaste se perderán.
        </ConfirmDialog>
      )}
      {confirm && (
        <ConfirmDialog title={`¿Deseas usar el perfil ${chosen.name}?`} onYes={doApply} onNo={() => setConfirm(false)}>
          {picked.length === 0 ? "No se cargarán preguntas: el banco del juego quedará vacío."
            : picked.length === 1 ? "Se cargará 1 pregunta al banco del juego." : `Se cargarán ${picked.length} preguntas al banco del juego.`}
          {" "}Reemplaza las preguntas que hay ahora en el banco del juego.
        </ConfirmDialog>
      )}
    </div>
  );
}
