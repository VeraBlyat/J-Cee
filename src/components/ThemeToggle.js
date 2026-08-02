"use client";

import { useCallback, useSyncExternalStore } from "react";

// El tema NO vive en el estado de React: la fuente de verdad es el atributo
// data-theme del <html>, que ThemeScript escribe antes del primer pintado.
// useSyncExternalStore es la forma de leer un sistema externo así, y además
// resuelve el render del servidor sin desincronizarse al hidratar.

function subscribe(onChange) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}

const getSnapshot = () => document.documentElement.dataset.theme || "light";

// En el servidor no hay tema resuelto todavía; devolvemos null para no
// dibujar el ícono equivocado durante un frame.
const getServerSnapshot = () => null;

export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback(() => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    // Alcanza con tocar el atributo: el MutationObserver de arriba avisa y el
    // componente se vuelve a renderizar solo.
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("jcee-theme", next);
    } catch {
      // Si el storage está bloqueado, el tema igual cambia en esta sesión.
    }
  }, []);

  return (
    <button
      onClick={toggle}
      aria-label={theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
      className="grid h-[34px] w-[34px] place-items-center rounded-full border border-white/10 bg-white/[0.08] text-[15px] transition hover:bg-white/[0.15]"
    >
      {theme === null ? null : theme === "dark" ? (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        </svg>
      )}
    </button>
  );
}
