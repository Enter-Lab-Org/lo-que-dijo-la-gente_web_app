import { useCallback, useRef, useState } from "react";
import { KEYS } from "../domain/constants";
import { sanitizeBank } from "../domain/bank";

/* Bank container: keeps the sorted bank and saves every change. */
export function useBank({ storage, initial }) {
  const ref = useRef(initial);
  const [bank, setState] = useState(initial);
  const setBank = useCallback((items) => {
    const next = sanitizeBank(items);
    ref.current = next;
    storage.set(KEYS.bank, next);
    setState(next);
    return next;
  }, [storage]);
  const current = useCallback(() => ref.current, []);
  return { bank, setBank, current };
}
