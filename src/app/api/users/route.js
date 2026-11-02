import { handleUsers } from "../../../server/http/users.js";
import { getAuth } from "../../../server/runtime.js";

export const GET = (request) => handleUsers(request, { auth: getAuth() });
export const POST = (request) => handleUsers(request, { auth: getAuth() });
