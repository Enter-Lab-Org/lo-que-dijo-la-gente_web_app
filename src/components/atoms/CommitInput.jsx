import { useEffect, useRef } from "react";

// Input that reports its value on the native "change" event (blur, Enter or spinner), like the original score fields.
export default function CommitInput({ value, onCommit, ...rest }) {
  const ref = useRef(null), cb = useRef(onCommit);
  cb.current = onCommit;
  useEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el) el.value = value ?? "";
  }, [value]);
  useEffect(() => {
    const el = ref.current, h = (e) => cb.current(e.target.value);
    el.addEventListener("change", h);
    return () => el.removeEventListener("change", h);
  }, []);
  return <input {...rest} ref={ref} defaultValue={value} />;
}
