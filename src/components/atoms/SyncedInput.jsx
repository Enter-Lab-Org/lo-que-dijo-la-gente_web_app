import { useEffect, useRef } from "react";

// Text input that follows `value` except while the user is typing in it. Reports every keystroke.
export default function SyncedInput({ value, onInput, normalize, ...rest }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el) el.value = value ?? "";
  }, [value]);
  return (
    <input
      type="text" {...rest} ref={ref} defaultValue={value}
      onChange={(e) => onInput(e.target.value)}
      onBlur={(e) => { if (normalize) e.target.value = normalize(e.target.value); }}
    />
  );
}
