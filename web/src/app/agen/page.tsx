import digest from "@/data/digest.json";
import track from "@/data/track.json";
import { AgentView } from "@/views/agent";

export const metadata = { title: "Agen & Telegram · Arus" };

export default function Page() {
  return <AgentView digest={digest} track={track as Parameters<typeof AgentView>[0]["track"]} />;
}
