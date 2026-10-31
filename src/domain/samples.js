import { parseBlock } from "./textFormat";
import { clone } from "./utils";

// Sample questions for the first run (made-up scores).
export const EXAMPLES = `Menciona algo que le pedirías a una inteligencia artificial
Hacer la tarea | 31
Escribir un correo | 22
Una receta | 14
Traducir algo | 11
Consejos de amor | 9
Hacer una imagen | 7

Menciona algo típico de Guadalajara
Tortas ahogadas | 40
Tequila | 20
Mariachi | 15
Las Chivas | 12
Tlaquepaque | 8
Las lluvias | 5

Menciona algo que haces en Día de Muertos
Poner el altar | 42
Ir al panteón | 20
Comer pan de muerto | 16
Escribir calaveritas | 10
Maquillarte de catrina | 7

Menciona algo que no puede faltar en una carne asada
Tortillas | 34
Cerveza | 25
Salsa | 15
Cebollitas | 10
Guacamole | 8
Música | 5

Menciona una razón para llegar tarde al trabajo
Tráfico | 39
Me quedé dormido | 28
El camión | 12
La lluvia | 9
Los hijos | 7

Menciona algo que a la gente le preocupa de la inteligencia artificial
Que nos quite el trabajo | 38
Que se rebele | 21
Que nos espíe | 14
Noticias falsas | 11
Que piense por nosotros | 9`;

export const sampleBank = () =>
  parseBlock(EXAMPLES).questions.map((q, i) => ({ id: "ej" + (i + 1), q: q.q, cat: "Ejemplos", answers: q.answers, updatedAt: 1 }));

/* First run: load the samples and build a game with three of them. Runs only once, even if the user deletes them later. */
export function seedFirstRun({ state, bank, seeded }) {
  if (seeded) return { state, bank, seeded: true, changed: false };
  if (bank.length) return { state, bank, seeded: true, changed: false };
  const nextBank = sampleBank();
  const nextState = state.list.length ? state
    : { ...state, list: nextBank.slice(0, 3).map((b) => ({ id: b.id, q: b.q, cat: b.cat, answers: clone(b.answers) })) };
  return { state: nextState, bank: nextBank, seeded: true, changed: true };
}
