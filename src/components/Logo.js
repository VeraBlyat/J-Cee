// Marca de J-Cee: un cuerpo en forma de play (el triángulo) con cola de pez y
// un ojo. Es el mismo SVG de los mockups.
//
// Los colores salen de las variables del tema, así que la marca acompaña el
// cambio de claro a oscuro sin tener dos versiones del archivo.
export function LogoMark({ size = 30, className = "" }) {
  return (
    <svg
      viewBox="0 0 60 46"
      width={size}
      height={size * 0.77}
      className={className}
      aria-hidden="true"
    >
      {/* Cuerpo: el triángulo de "play" */}
      <path d="M4 6 L44 23 L4 40 Z" fill="var(--jc-brand-2)" />
      {/* Velo claro encima, para que el cuerpo no quede plano */}
      <path d="M4 6 L44 23 L4 40 Z" fill="rgba(255,255,255,0.1)" />
      {/* Cola */}
      <path d="M36 17 L56 8 L52 23 L56 38 L36 29 Z" fill="var(--jc-brand-3)" />
      {/* Ojo */}
      <circle cx="16" cy="19" r="5.5" fill="#fff" />
      <circle cx="17.6" cy="19.8" r="2.6" fill="#101a0c" />
      <circle cx="18.5" cy="18.2" r="1" fill="#fff" />
    </svg>
  );
}

// Marca completa: logo + nombre. `tone` decide el color del texto según viva
// sobre el header oscuro o sobre el fondo de la página.
export default function Logo({ size = 30, tone = "header", className = "" }) {
  return (
    <span
      className={`flex shrink-0 items-center gap-2.5 font-display text-[21px] font-extrabold tracking-[0.4px] ${
        tone === "header" ? "text-header-text" : "text-text"
      } ${className}`}
    >
      <LogoMark size={size} />
      J-Cee
    </span>
  );
}
