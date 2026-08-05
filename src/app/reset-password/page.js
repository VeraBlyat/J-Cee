import ResetPasswordForm from "@/components/ResetPasswordForm";

// El token viaja en la query del enlace de recuperación
// (/reset-password?token=...). Lo resolvemos acá, en el servidor, y se lo
// pasamos al formulario de cliente, así no hace falta useSearchParams (que en
// Next 15 obligaría a envolver todo en <Suspense>).
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({ searchParams }) {
  const { token } = await searchParams;
  return <ResetPasswordForm token={typeof token === "string" ? token : ""} />;
}
