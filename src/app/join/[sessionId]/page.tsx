"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Send, CheckCircle2, MessageSquareOff, Pause, Square } from "lucide-react";
import { socket } from "@/lib/socket";

type SessionState = {
  status: "active" | "paused" | "ended";
  createdAt: Date;
};

export default function AudiencePage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const [session, setSession] = useState<SessionState | null>(null);
  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    socket.connect();
    socket.emit("join-audience", sessionId);

    socket.on("session-state", (state: SessionState) => {
      setSession(state);
    });

    socket.on("error", (err: string) => {
      setError(err);
      setIsSending(false);
    });

    socket.on("message-sent", () => {
      setIsSending(false);
      setSentSuccess(true);
      setContent("");
    });

    return () => {
      socket.off("session-state");
      socket.off("error");
      socket.off("message-sent");
      socket.disconnect();
    };
  }, [sessionId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || session?.status !== "active") return;
    
    setIsSending(true);
    socket.emit("send-message", { sessionId, content: content.trim() });
  };

  if (error && !session) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-6 text-center">
        <MessageSquareOff className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-white mb-2">Oops</h1>
        <p className="text-neutral-400">{error}</p>
      </div>
    );
  }

  if (!session) {
    return <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white">Connecting...</div>;
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans flex flex-col p-4 sm:p-6">
      <div className="max-w-xl w-full mx-auto flex-1 flex flex-col">
        <div className="mb-8 mt-4 text-center">
          <h1 className="text-3xl font-bold tracking-tight mb-2">ANONYMOUS LIVE</h1>
          <p className="text-neutral-400">You're in. Say whatever you wanted to say.</p>
        </div>

        {session.status === "active" && !sentSuccess && (
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col relative">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Ask a question, suggest something, or say anything..."
              className="flex-1 w-full bg-neutral-900 border border-neutral-800 rounded-3xl p-6 text-xl sm:text-2xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-neutral-600 shadow-inner"
              maxLength={500}
              required
            />
            <div className="absolute bottom-6 right-6 text-sm text-neutral-500 font-medium">
              {content.length}/500
            </div>
            
            <button
              type="submit"
              disabled={isSending || !content.trim()}
              className="mt-6 flex items-center justify-center gap-3 w-full bg-blue-600 text-white p-5 rounded-full font-bold text-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-900/20 active:scale-95"
            >
              {isSending ? "SENDING..." : "SEND ANONYMOUSLY"}
              {!isSending && <Send className="w-5 h-5" />}
            </button>
          </form>
        )}

        {session.status === "active" && sentSuccess && (
          <div className="flex-1 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
            <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 className="w-12 h-12 text-green-500" />
            </div>
            <h2 className="text-3xl font-bold mb-8">Sent anonymously</h2>
            
            <button
              onClick={() => setSentSuccess(false)}
              className="w-full sm:w-auto px-10 py-5 rounded-full border-2 border-neutral-700 font-bold text-lg hover:bg-neutral-800 transition-colors active:scale-95"
            >
              SEND ANOTHER
            </button>
          </div>
        )}

        {session.status === "paused" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-yellow-500/10 rounded-3xl border border-yellow-500/20">
            <Pause className="w-16 h-16 text-yellow-500 mb-6" />
            <h2 className="text-2xl font-bold text-yellow-500 mb-2">Responses Paused</h2>
            <p className="text-neutral-400">The presenter has temporarily paused incoming responses. Hold that thought!</p>
          </div>
        )}

        {session.status === "ended" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-red-500/10 rounded-3xl border border-red-500/20">
            <Square className="w-16 h-16 text-red-500 mb-6" />
            <h2 className="text-2xl font-bold text-red-500 mb-2">Session Ended</h2>
            <p className="text-neutral-400">This session has been closed by the presenter. Thanks for participating!</p>
          </div>
        )}
      </div>
    </div>
  );
}
