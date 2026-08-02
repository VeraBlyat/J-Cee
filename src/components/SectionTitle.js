// Título de sección del mockup: punto de color de la marca + texto en Baloo.
export default function SectionTitle({ children, action }) {
  return (
    <div className="mb-[18px] flex items-center justify-between gap-4">
      <h2 className="flex items-center gap-2 font-display text-[15px] font-bold text-text">
        <span className="h-[7px] w-[7px] rounded-full bg-brand" />
        {children}
      </h2>
      {action}
    </div>
  );
}
