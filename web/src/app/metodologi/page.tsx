import { bundle } from "@/lib/data";
import { MethodView } from "@/views/method";

export const metadata = { title: "Cara kerja · Arus" };

export default function Page() {
  return <MethodView meta={bundle.meta} />;
}
