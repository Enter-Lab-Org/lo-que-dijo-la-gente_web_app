import { THEME0 } from "../../domain/constants";
import { EMPTY_PUB, roundLabel } from "../../domain/screen";
import { normalizeTheme, screenVars } from "../../domain/theme";
import { useScreenFx } from "../../hooks/useScreenFx";
import TeamScore from "./TeamScore";
import PotDisplay from "./PotDisplay";
import StrikeIndicators from "./StrikeIndicators";
import Board from "./Board";
import BigX from "./BigX";

/* The public board. Used full screen on the projector and scaled as a monitor in the console.
   It only knows the public state (pubState): never the bank or the full game. */
export default function PublicScreen({ pub, theme, variant = "full", audio = null, style, id }) {
  const p = pub || EMPTY_PUB;
  const t = normalizeTheme(theme);
  const bigX = useScreenFx(pub, audio);
  return (
    <div id={id} className={`scrwrap ${variant}${t.tile ? " has-tile-img" : ""}`} style={{ ...screenVars(t), ...style }} data-testid="public-screen">
      <div className="scr">
        <header className="s-top">
          <TeamScore side="a" name={p.nameA} score={p.scoreA} />
          <PotDisplay logo={t.logo} title={t.title || THEME0.title} pot={p.pot} />
          <TeamScore side="b" name={p.nameB} score={p.scoreB} />
        </header>
        <section className="s-stage">
          <div className="s-meta">
            <span className="s-round">{roundLabel(p)}</span>
            <span className="s-status" aria-live="polite">{p.status || ""}</span>
            <StrikeIndicators count={p.strikes || 0} />
          </div>
          <h1 className="s-q">{p.has ? p.q : "Esperando la primera pregunta"}</h1>
          <Board key={p.has ? p.key + ":" + p.n : "none"} n={p.has ? p.n : 0} open={p.open || []} />
        </section>
      </div>
      <BigX count={bigX} />
    </div>
  );
}
