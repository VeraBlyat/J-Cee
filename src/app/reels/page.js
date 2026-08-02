import { serverFetch } from "@/lib/api";
import ReelsFeed from "@/components/ReelsFeed";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Reels · J-Cee",
};

export default async function ReelsPage() {
  // La primera tanda se resuelve en el servidor para que el primer reel esté
  // listo apenas carga la página; las siguientes las pide el cliente al ir
  // scrolleando.
  const res = await serverFetch("/videos/reels");
  const reels = res.ok ? await res.json() : [];

  return <ReelsFeed initialReels={reels} />;
}
