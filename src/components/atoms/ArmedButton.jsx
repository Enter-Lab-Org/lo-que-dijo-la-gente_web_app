import { useEffect, useRef, useState } from "react";

// Two-step confirmation: the first click arms the button, a second click within 3 s runs the action.
export default function ArmedButton({ className = "btn", armedLabel, onConfirm, children, ...rest }) {
  const [armed, setArmed] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const click = () => {
    clearTimeout(timer.current);
    if (armed) { setArmed(false); onConfirm(); return; }
    setArmed(true);
    timer.current = setTimeout(() => setArmed(false), 3000);
  };
  return (
    <button type="button" {...rest} className={className + (armed ? " armed" : "")} onClick={click}>
      {armed ? armedLabel : children}
    </button>
  );
}
