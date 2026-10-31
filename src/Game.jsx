import GameApp from "./GameApp";
import { createServices } from "./adapters";

// One set of services per page, like the old main.jsx: Strict Mode must not open a second bus or channel.
let services = null;

export default function Game(props) {
  services ??= createServices(window);
  return <GameApp services={services} {...props} />;
}
