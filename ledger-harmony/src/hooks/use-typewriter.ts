import { useEffect, useState } from "react";

export function useTypewriter(text: string, active: boolean, speedMs = 32) {
  const [out, setOut] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!active) return;
    setOut("");
    setDone(false);
    let i = 0;
    const id = window.setInterval(() => {
      i++;
      setOut(text.slice(0, i));
      if (i >= text.length) {
        window.clearInterval(id);
        setDone(true);
      }
    }, speedMs);
    return () => window.clearInterval(id);
  }, [text, active, speedMs]);

  return { out, done };
}
