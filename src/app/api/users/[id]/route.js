import { handleUsers } from "../../../../server/http/users.js";
import { getAuth } from "../../../../server/runtime.js";

// Next 16: params is a Promise.
const handle = async (request, { params }) => handleUsers(request, { auth: getAuth(), id: (await params).id });
export const PATCH = handle;
export const DELETE = handle;
