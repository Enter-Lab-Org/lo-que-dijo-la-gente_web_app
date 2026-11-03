import { handleBank } from "../../../../../server/http/bank.js";
import { getAuth, getBank } from "../../../../../server/runtime.js";

// DELETE /api/bank/<questions|categories>/:id. Next 16: params is a Promise.
const handle = async (request, { params }) => {
  const { resource, id } = await params;
  return handleBank(request, { auth: getAuth(), bank: getBank(), resource, id });
};
export const DELETE = handle;
