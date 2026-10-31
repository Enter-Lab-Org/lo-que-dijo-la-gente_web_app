import { handleLogin } from "../../../../server/http/handlers.js";
import { getAuth, httpConfig } from "../../../../server/runtime.js";

export const POST = (request) => handleLogin(request, { auth: getAuth(), ...httpConfig() });
