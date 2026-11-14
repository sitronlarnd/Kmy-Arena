import "katex/dist/katex.min.css";
import { paneliKoru } from "@/lib/yetki";
import { Ekran } from "./Ekran";

export const dynamic = "force-dynamic";

export default async function CanliEkran({ params }: { params: Promise<{ id: string }> }) {
  await paneliKoru("ogretmen");
  const { id } = await params;
  return <Ekran id={id} />;
}
