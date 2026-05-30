import { ChatShell } from "@/components/chat/chat-shell";

export const metadata = {
  title: "MCP Tool Generator — Chat",
};

export default async function ChatSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <ChatShell initialSessionId={sessionId} />;
}
