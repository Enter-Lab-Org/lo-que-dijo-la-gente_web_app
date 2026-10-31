import { handleLogout } from "../../../../server/http/handlers.js";
import { getAuth } from "../../../../server/runtime.js";

export const POST = (request) => handleLogout(request, { auth: getAuth() });
