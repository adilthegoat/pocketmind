"use client";
import { useState } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
  plan?: { chain: string; method: string; explanation: string };
  raw?: string;
}

const EXAMPLES = [
  "What's the ETH balance of 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045?",
  "What's the latest block number on Ethereum?",
  "What's the gas price on Ethereum right now?",
  "What's the MATIC balance of 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 on Polygon?",
];

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendMessage(text?: string) {
    const question = text || input;
    if (!question.trim()) return;

    const userMsg: Message = { role: "user", content: question };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer,
          plan: data.plan,
          raw: data.raw,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Connection error. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center font-bold text-sm">
          PM
        </div>
        <div>
          <h1 className="font-semibold text-white">PocketMind</h1>
          <p className="text-xs text-gray-400">
            Natural language blockchain queries via Pocket Network
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-xs text-gray-400">Pocket RPC Connected</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 max-w-3xl mx-auto w-full">
        {messages.length === 0 && (
          <div className="text-center mt-16">
            <div className="w-16 h-16 bg-purple-600 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4">
              ⛓️
            </div>
            <h2 className="text-xl font-semibold mb-2">
              Ask anything about the blockchain
            </h2>
            <p className="text-gray-400 text-sm mb-8">
              Powered by Pocket Network decentralized RPC
            </p>
            <div className="grid grid-cols-1 gap-3 max-w-lg mx-auto">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => sendMessage(ex)}
                  className="text-left px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm text-gray-300 transition-colors border border-gray-700"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`mb-4 flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-xl rounded-2xl px-4 py-3 text-sm ${
                msg.role === "user"
                  ? "bg-purple-600 text-white"
                  : "bg-gray-800 text-gray-100"
              }`}
            >
              <p>{msg.content}</p>
              {msg.plan && (
                <div className="mt-2 pt-2 border-t border-gray-700 text-xs text-gray-400">
                  <span className="bg-gray-700 px-2 py-0.5 rounded mr-2">
                    {msg.plan.chain}
                  </span>
                  <span>{msg.plan.method}</span>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start mb-4">
            <div className="bg-gray-800 rounded-2xl px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce delay-100" />
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce delay-200" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-gray-800 px-4 py-4">
        <div className="max-w-3xl mx-auto flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Ask anything about Ethereum, Polygon..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-500 placeholder-gray-500"
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading}
            className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 px-5 py-3 rounded-xl text-sm font-medium transition-colors"
          >
            Send
          </button>
        </div>
        <p className="text-center text-xs text-gray-600 mt-2">
          Queries routed through Pocket Network decentralized RPC
        </p>
      </div>
    </main>
  );
}