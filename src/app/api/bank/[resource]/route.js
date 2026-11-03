import { handleBank } from "../../../../server/http/bank.js";
import { getAuth, getBank } from "../../../../server/runtime.js";

// /api/bank/questions and /api/bank/categories. Next 16: params is a Promise.
const handle = async (request, { params }) => handleBank(request, { auth: getAuth(), bank: getBank(), resource: (await params).resource });
export const GET = handle;
export const POST = handle;
