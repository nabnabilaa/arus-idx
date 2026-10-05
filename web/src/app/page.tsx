import { bundle } from "@/lib/data";
import { HomeView } from "@/views/home";

export default function Page() {
  return <HomeView ranking={bundle.ranking} meta={bundle.meta} market={bundle.market} models={bundle.models} sectors={bundle.sectors} />;
}
