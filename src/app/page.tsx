"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, QrCode } from "lucide-react";

export default function Home() {
  const router = useRouter();

  const handleStartSession = () => {
    // Generate a random 6-character session ID
    const sessionId = Math.random().toString(36).substring(2, 8).toUpperCase();
    router.push(`/session/${sessionId}`);
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-6 text-white font-sans">
      <div className="max-w-md w-full flex flex-col items-center text-center space-y-8">
        <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center mb-4 shadow-lg shadow-blue-500/20">
          <QrCode className="w-10 h-10 text-white" />
        </div>
        
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white">
          SAY IT. WE WON'T KNOW IT'S YOU.
        </h1>
        
        <p className="text-lg text-neutral-400">
          The ultimate anonymous live audience messaging tool. No logins, no names, no limits.
        </p>

        <button
          onClick={handleStartSession}
          className="mt-8 flex items-center gap-3 bg-white text-black px-8 py-4 rounded-full font-semibold text-lg hover:bg-neutral-200 transition-colors shadow-xl"
        >
          Start New Session
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
