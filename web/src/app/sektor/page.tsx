import { bundle } from "@/lib/data";
import { SectorsView } from "@/views/sectors";

export const metadata = { title: "Arus sektor · Arus" };

export default function Page() {
  return <SectorsView sectors={bundle.sectors} sectorTs={bundle.sectorTs} />;
}
