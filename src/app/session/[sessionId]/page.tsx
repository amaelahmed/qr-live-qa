"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { Play, Pause, Square, Trash2, EyeOff, CheckCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Message = {
  id: string;
  session_id: string;
  content: string;
  created_at: string;
  status: "visible" | "hidden" | "deleted" | "answered";
};

type SessionState = {
  id: string;
  status: "active" | "paused" | "ended";
};

export default function PresenterPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const [session, setSession] = useState<SessionState | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Generate join URL dynamically
  const [joinUrl, setJoinUrl] = useState("");
  useEffect(() => {
    if (typeof window !== "undefined") {
      setJoinUrl(`${window.location.origin}/join/${sessionId}`);
    }
  }, [sessionId]);

  useEffect(() => {
    // 1. Fetch initial session state or create if not exists
    const initSession = async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .single();
      
      if (data) {
        setSession(data);
      } else {
        const { data: newData } = await supabase
          .from('sessions')
          .insert({ id: sessionId, status: 'active' })
          .select()
          .single();
        if (newData) setSession(newData);
      }

      // Fetch initial messages
      const { data: initialMessages } = await supabase
        .from('messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });
      
      if (initialMessages) {
        setMessages(initialMessages);
      }
    };
    initSession();

    // 2. Subscribe to realtime changes
    const channel = supabase.channel(`room_${sessionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setMessages((prev) => [...prev, payload.new as Message]);
            setTimeout(() => {
              messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
            }, 100);
          } else if (payload.eventType === 'UPDATE') {
            setMessages((prev) => 
              prev.map(m => m.id === payload.new.id ? (payload.new as Message) : m)
            );
          } else if (payload.eventType === 'DELETE') {
            setMessages((prev) => prev.filter(m => m.id !== payload.old.id));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` },
        (payload) => {
          setSession(payload.new as SessionState);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  const updateSessionStatus = async (status: "active" | "paused" | "ended") => {
    const { data } = await supabase
      .from('sessions')
      .update({ status })
      .eq('id', sessionId)
      .select()
      .single();
    if (data) setSession(data);
  };

  const updateMessageStatus = async (messageId: string, status: "hidden" | "deleted" | "answered") => {
    if (status === 'deleted') {
       await supabase.from('messages').delete().eq('id', messageId);
    } else {
       await supabase.from('messages').update({ status }).eq('id', messageId);
    }
  };

  const clearFeed = async () => {
    if(confirm("Are you sure you want to clear all messages?")) {
      await supabase.from('messages').delete().eq('session_id', sessionId);
    }
  };

  if (!session) {
    return <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">Loading session...</div>;
  }

  const visibleMessages = messages.filter(m => m.status === "visible" || m.status === "answered");

  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans flex flex-col md:flex-row h-screen overflow-hidden">
      {/* Left Panel - QR Code & Info */}
      <div className="md:w-1/3 bg-neutral-900 border-r border-neutral-800 p-8 flex flex-col justify-between overflow-y-auto">
        <div>
          <h1 className="text-3xl font-bold mb-2">SAY IT. WE WON'T KNOW IT'S YOU.</h1>
          <p className="text-neutral-400 mb-8">Scan the QR. Ask anything. Send as much as you want.</p>
          
          <div className="bg-white p-6 rounded-2xl w-fit mx-auto mb-6 shadow-2xl">
            {joinUrl && (
              <QRCodeSVG 
                value={joinUrl} 
                size={200}
                level="H"
                includeMargin={true}
              />
            )}
          </div>
          
          <div className="text-center mb-8">
            <p className="font-bold text-xl mb-1">SCAN TO JOIN</p>
            <p className="text-sm text-neutral-500 mb-4">No login · No name · No limit</p>
            <div className="bg-neutral-800 rounded-lg p-3 text-sm font-mono truncate text-neutral-300 select-all cursor-pointer" onClick={() => navigator.clipboard.writeText(joinUrl)}>
              {joinUrl}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-3">
          <div className="flex justify-between items-center bg-neutral-800 p-4 rounded-xl">
            <span className="font-medium text-neutral-300">Status</span>
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${session.status === 'active' ? 'bg-green-500/20 text-green-400' : session.status === 'paused' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
              {session.status}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {session.status !== 'active' && session.status !== 'ended' && (
              <button onClick={() => updateSessionStatus('active')} className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 p-3 rounded-lg font-medium transition-colors">
                <Play className="w-4 h-4" /> Resume
              </button>
            )}
            {session.status === 'active' && (
              <button onClick={() => updateSessionStatus('paused')} className="flex items-center justify-center gap-2 bg-yellow-600 hover:bg-yellow-500 p-3 rounded-lg font-medium transition-colors">
                <Pause className="w-4 h-4" /> Pause
              </button>
            )}
            <button onClick={() => updateSessionStatus('ended')} className="flex items-center justify-center gap-2 bg-neutral-700 hover:bg-red-600 p-3 rounded-lg font-medium transition-colors" disabled={session.status === 'ended'}>
              <Square className="w-4 h-4" /> End
            </button>
          </div>
          <button onClick={clearFeed} className="w-full flex items-center justify-center gap-2 bg-neutral-800 hover:bg-neutral-700 p-3 rounded-lg font-medium transition-colors text-neutral-400 hover:text-white">
            <Trash2 className="w-4 h-4" /> Clear Feed
          </button>
        </div>
      </div>

      {/* Right Panel - Live Feed */}
      <div className="md:w-2/3 flex flex-col bg-neutral-950 h-full relative overflow-hidden">
        {/* Header */}
        <div className="p-8 border-b border-neutral-900 bg-neutral-950 z-10 flex justify-between items-center shrink-0">
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              {session.status === 'active' && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>}
              <span className={`relative inline-flex rounded-full h-3 w-3 ${session.status === 'active' ? 'bg-red-500' : 'bg-neutral-600'}`}></span>
            </span>
            LIVE RESPONSES
          </h2>
          <span className="text-neutral-500 font-medium">
            {visibleMessages.length} anonymous responses
          </span>
        </div>

        {/* Feed */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {visibleMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-neutral-600">
              <p className="text-xl font-medium mb-2">WAITING FOR YOU.</p>
              <p>The room is suspiciously quiet.</p>
            </div>
          ) : (
            visibleMessages.map((msg) => (
              <div key={msg.id} className={`bg-neutral-900 border border-neutral-800 p-6 rounded-2xl shadow-lg transition-all animate-in slide-in-from-bottom-4 fade-in duration-300 ${msg.status === 'answered' ? 'opacity-50' : ''}`}>
                <div className="flex justify-between items-start mb-3">
                  <span className="text-blue-400 font-semibold text-lg">Anonymous</span>
                  <div className="flex gap-2">
                    <button onClick={() => updateMessageStatus(msg.id, 'answered')} className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-500 hover:text-green-400 transition-colors" title="Mark Answered">
                      <CheckCircle className="w-5 h-5" />
                    </button>
                    <button onClick={() => updateMessageStatus(msg.id, 'hidden')} className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-500 hover:text-yellow-400 transition-colors" title="Hide">
                      <EyeOff className="w-5 h-5" />
                    </button>
                    <button onClick={() => updateMessageStatus(msg.id, 'deleted')} className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-500 hover:text-red-400 transition-colors" title="Delete">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl font-medium leading-tight whitespace-pre-wrap break-words">
                  {msg.content}
                </p>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
        
        {session.status === 'paused' && (
          <div className="absolute inset-0 bg-neutral-950/60 backdrop-blur-sm flex items-center justify-center z-20">
            <div className="bg-yellow-600 text-black px-6 py-4 rounded-2xl font-bold text-2xl shadow-2xl">
              RESPONSES PAUSED
            </div>
          </div>
        )}
        
        {session.status === 'ended' && (
          <div className="absolute inset-0 bg-neutral-950/80 backdrop-blur-md flex items-center justify-center z-20">
            <div className="bg-red-600 text-white px-8 py-6 rounded-3xl font-bold text-4xl shadow-2xl">
              SESSION ENDED
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
