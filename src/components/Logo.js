import Image from "next/image";

// Marca de J-Cee: el pez-play verde. Ahora es el PNG de la marca (public/
// logoP.png, sólo el ícono) en vez del SVG dibujado a mano. El fondo del
// archivo es transparente, así que se ve igual sobre el header oscuro y sobre
// la página clara.
//
// El PNG mide 618x702, así que lo escalamos por alto y calculamos el ancho
// para no deformarlo.
const MARK_RATIO = 618 / 702;

export function LogoMark({ size = 30, className = "" }) {
  const height = Math.round(size);
  const width = Math.round(size * MARK_RATIO);
  return (
    <Image
      src="/logoP.png"
      alt=""
      width={width}
      height={height}
      className={className}
      priority
    />
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
