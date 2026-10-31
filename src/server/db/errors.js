/* Engine-neutral errors: adapters translate their own failures to these codes. */
export class DatabaseError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "DatabaseError";
    this.code = code;
  }
}
