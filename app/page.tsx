"use client";
import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
  plan?: { chain: string; method: string; explanation: string };
  raw?: string;
  formatted?: string;
  responseTime?: number;
}

interface Stats {
  totalQueries: number;
  chainsUsed: Set<string>;
  avgResponseTime: number;
  totalResponseTime: number;
}

const CHAINS = [
  { id: "ethereum", label: "Ethereum", emoji: "⟠" },
  { id: "polygon", label: "Polygon", emoji: "⬡" },
  { id: "arbitrum", label: "Arbitrum", emoji: "🔵" },
  { id: "base", label: "Base", emoji: "🔷" },
  { id: "bnb", label: "BNB Chain", emoji: "🟡" },
];

const EXAMPLES: Record<string, string[]> = {
  ethereum: [
    "What's the gas price on Ethereum right now?",
    "What's the ETH balance of 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045?",
    "What's the latest block number on Ethereum?",
    "How many transactions has 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 made?",
  ],
  polygon: [
    "What's the gas price on Polygon?",
    "What's the MATIC balance of 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045?",
    "What's the latest block on Polygon?",
  ],
  arbitrum: [
    "What's the gas price on Arbitrum?",
    "What's the latest block on Arbitrum?",
    "What's the ETH balance of 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 on Arbitrum?",
  ],
  base: [
    "What's the gas price on Base?",
    "What's the latest block on Base?",
    "What's the ETH balance of 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 on Base?",
  ],
  bnb: [
    "What's the gas price on BNB Chain?",
    "What's the latest block on BNB?",
    "What's the BNB balance of 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045?",
  ],
};

const SUGGESTIONS: Record<string, string[]> = {
  eth_getBalance: [
    "What's the gas price right now?",
    "What's the latest block number?",
    "How many transactions has this wallet made?",
  ],
  eth_gasPrice: [
    "What's the latest block number?",
    "Check a wallet balance",
    "What's the gas price on Polygon?",
  ],
  eth_blockNumber: [
    "What's the gas price?",
    "Check a wallet balance",
    "What's the block number on Base?",
  ],
  default: [
    "What's the gas price on Ethereum?",
    "What's the latest block on Base?",
    "Check a wallet balance",
  ],
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedChain, setSelectedChain] = useState("ethereum");
  const [history, setHistory] = useState<string[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalQueries: 0,
    chainsUsed: new Set(),
    avgResponseTime: 0,
    totalResponseTime: 0,
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(text?: string) {
    const question = text || input;
    if (!question.trim() || loading) return;

    const userMsg: Message = { role: "user", content: question };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    const startTime = Date.now();

    // Add to history
    setHistory((prev) => {
      const updated = [question, ...prev.filter((h) => h !== question)];
      return updated.slice(0, 10);
    });

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question, chain: selectedChain }),
      });
      const data = await res.json();
      const responseTime = Date.now() - startTime;

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer,
          plan: data.plan,
          raw: data.raw,
          formatted: data.formatted,
          responseTime,
        },
      ]);

      // Update stats
      setStats((prev) => {
        const newTotal = prev.totalQueries + 1;
        const newTotalTime = prev.totalResponseTime + responseTime;
        const newChainsUsed = new Set(prev.chainsUsed);
        if (data.plan?.chain) newChainsUsed.add(data.plan.chain);
        return {
          totalQueries: newTotal,
          chainsUsed: newChainsUsed,
          avgResponseTime: Math.round(newTotalTime / newTotal),
          totalResponseTime: newTotalTime,
        };
      });
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Connection error. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const currentChain = CHAINS.find((c) => c.id === selectedChain);
  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant");
  const suggestions = lastAssistantMsg?.plan?.method
    ? SUGGESTIONS[lastAssistantMsg.plan.method] || SUGGESTIONS.default
    : null;

  return (
    <main className="min-h-screen bg-gray-950 text-white flex">
      {/* Sidebar */}
      <div className="w-64 border-r border-gray-800 flex flex-col hidden md:flex">
        {/* Logo */}
        <div className="px-4 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-purple-600 rounded-lg flex items-center justify-center font-bold text-xs">
              PM
            </div>
            <span className="font-semibold text-sm">PocketMind</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Powered by Pocket Network</p>
        </div>

        {/* Stats */}
        {stats.totalQueries > 0 && (
          <div className="px-4 py-3 border-b border-gray-800">
            <p className="text-xs text-gray-400 font-medium mb-2 uppercase tracking-wide">
              Session Stats
            </p>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Queries via Pocket</span>
                <span className="text-purple-400 font-medium">{stats.totalQueries}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Chains used</span>
                <span className="text-purple-400 font-medium">{stats.chainsUsed.size}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Avg response</span>
                <span className="text-purple-400 font-medium">{stats.avgResponseTime}ms</span>
              </div>
            </div>
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div className="px-4 py-3 flex-1 overflow-y-auto">
            <p className="text-xs text-gray-400 font-medium mb-2 uppercase tracking-wide">
              Recent Queries
            </p>
            <div className="space-y-1">
              {history.map((h, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(h)}
                  className="w-full text-left text-xs text-gray-400 hover:text-white px-2 py-1.5 rounded-lg hover:bg-gray-800 transition-colors truncate"
                >
                  {h}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Pocket Badge */}
        <div className="px-4 py-3 border-t border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-xs text-gray-400">Pocket RPC Connected</span>
          </div>
          <p className="text-xs text-gray-600 mt-1">5 chains • 60+ available</p>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-800 px-4 py-3 flex items-center gap-3">
          <div className="w-7 h-7 bg-purple-600 rounded-lg flex items-center justify-center font-bold text-xs md:hidden">
            PM
          </div>
          <div className="flex-1">
            <h1 className="font-semibold text-sm">PocketMind</h1>
            <p className="text-xs text-gray-400 hidden md:block">
              Natural language blockchain queries via Pocket Network
            </p>
          </div>

          {/* Chain Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 hidden md:block">Chain:</span>
            <select
              value={selectedChain}
              onChange={(e) => setSelectedChain(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-purple-500 cursor-pointer"
            >
              {CHAINS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6 max-w-3xl mx-auto w-full">
          {messages.length === 0 && (
            <div className="text-center mt-8">
              <div className="w-16 h-16 bg-purple-600 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">
                ⛓️
              </div>
              <h2 className="text-xl font-semibold mb-1">Ask anything about the blockchain</h2>
              <p className="text-gray-400 text-sm mb-2">
                Powered by Pocket Network decentralized RPC
              </p>
              <p className="text-gray-600 text-xs mb-8">
                Currently querying:{" "}
                <span className="text-purple-400">
                  {currentChain?.emoji} {currentChain?.label}
                </span>
              </p>
              <div className="grid grid-cols-1 gap-2 max-w-lg mx-auto">
                {EXAMPLES[selectedChain]?.map((ex) => (
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
                  <div className="mt-2 pt-2 border-t border-gray-700 text-xs text-gray-400 flex items-center gap-2 flex-wrap">
                    <span className="bg-gray-700 px-2 py-0.5 rounded-full">
                      {CHAINS.find((c) => c.id === msg.plan?.chain)?.emoji}{" "}
                      {msg.plan.chain}
                    </span>
                    <span className="bg-gray-700 px-2 py-0.5 rounded-full">
                      {msg.plan.method}
                    </span>
                    {msg.responseTime && (
                      <span className="text-gray-600">{msg.responseTime}ms</span>
                    )}
                  </div>
                )}
                {msg.formatted && msg.formatted !== msg.raw && (
                  <div className="mt-1 text-xs text-purple-400 font-mono">
                    Raw: {String(msg.raw).substring(0, 20)}...
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Smart Suggestions */}
          {suggestions && !loading && (
            <div className="mb-4">
              <p className="text-xs text-gray-500 mb-2">Suggested queries:</p>
              <div className="flex gap-2 flex-wrap">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-purple-500 rounded-full text-gray-300 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {loading && (
            <div className="flex justify-start mb-4">
              <div className="bg-gray-800 rounded-2xl px-4 py-3">
                <div className="flex gap-1 items-center">
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce delay-100" />
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce delay-200" />
                  <span className="text-xs text-gray-500 ml-2">
                    Querying Pocket Network...
                  </span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-800 px-4 py-4">
          <div className="max-w-3xl mx-auto flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder={`Ask anything about ${currentChain?.label}...`}
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
            All queries routed through Pocket Network decentralized RPC •{" "}
            {currentChain?.emoji} {currentChain?.label}
          </p>
        </div>
      </div>
    </main>
  );
}