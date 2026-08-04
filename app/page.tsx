import { HackathonPortal } from "./portal";
import { getChatGPTUser } from "./chatgpt-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const identity = await getChatGPTUser();
  return <HackathonPortal identity={identity} />;
}
