import { getChatGPTUser } from "./chatgpt-auth";
import { ModelLab } from "@/components/model-lab";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();
  return <ModelLab signedIn={Boolean(user)} />;
}
