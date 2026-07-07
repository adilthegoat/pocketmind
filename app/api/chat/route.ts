import Groq from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Official Pocket Network public RPC endpoints — no API key required
const POCKET_ENDPOINTS: Record<string, string> = {
  ethereum: "https://eth.api.pocket.network",
  polygon: "https://polygon.api.pocket.network",
  arbitrum: "https://arbitrum-one.api.pocket.network",
  base: "https://base.api.pocket.network",
  bnb: "https://bsc.api.pocket.network",
};

// Convert hex Wei to ETH
function hexToETH(hex: string): string {
  const wei = BigInt(hex);
  const eth = Number(wei) / 1e18;
  return eth.toFixed(4);
}

// Convert hex Wei to Gwei
function hexToGwei(hex: string): string {
  const wei = BigInt(hex);
  const gwei = Number(wei) / 1e9;
  return gwei.toFixed(4);
}

// Send RPC call through Pocket Network
async function callPocketRPC(chain: string, method: string, params: unknown[]) {
  const endpoint = POCKET_ENDPOINTS[chain.toLowerCase()];
  if (!endpoint) {
    throw new Error(
      `Chain "${chain}" not supported. Supported chains: ${Object.keys(POCKET_ENDPOINTS).join(", ")}`
    );
  }

  try {
    const response = await axios.post(
      endpoint,
      { jsonrpc: "2.0", id: 1, method, params },
      { timeout: 10000, headers: { "Content-Type": "application/json" } }
    );

    if (response.data.error) {
      throw new Error(response.data.error.message || "RPC returned an error");
    }

    return response.data.result;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      throw new Error(`Pocket Network connection failed: ${err.message}`);
    }
    throw err;
  }
}

// Convert raw RPC result to human-readable format
function formatResult(method: string, result: unknown): string {
  if (typeof result !== "string" || !result.startsWith("0x")) {
    return JSON.stringify(result);
  }

  switch (method) {
    case "eth_getBalance":
      return `${hexToETH(result)} ETH`;
    case "eth_gasPrice":
    case "eth_maxPriorityFeePerGas":
      return `${hexToGwei(result)} Gwei`;
    case "eth_blockNumber":
      return `Block #${parseInt(result, 16).toLocaleString()}`;
    case "eth_getTransactionCount":
      return `${parseInt(result, 16)} transactions`;
    case "eth_chainId":
      return `Chain ID: ${parseInt(result, 16)}`;
    default:
      return result;
  }
}

export async function POST(req: NextRequest) {
  const { message } = await req.json();

  if (!message || message.trim().length === 0) {
    return NextResponse.json({
      answer: "Please enter a question about the blockchain.",
    });
  }

  // Step 1 — Understand the question and generate the RPC call
  let plan;
  try {
    const planResponse = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `You are a blockchain RPC expert. When given a question, respond ONLY with a valid JSON object like this:
{
  "chain": "ethereum",
  "method": "eth_getBalance",
  "params": ["0x123...", "latest"],
  "explanation": "Getting the balance of wallet 0x123 on Ethereum"
}
Supported chains: ethereum, polygon, arbitrum, base, bnb.
If the user does not specify a chain, default to ethereum.
Never add any text outside the JSON. Never wrap in markdown or code blocks.`,
        },
        { role: "user", content: message },
      ],
    });

    const planText = planResponse.choices[0].message.content || "{}";
    // Clean any accidental markdown wrapping
    const cleanText = planText.replace(/```json|```/g, "").trim();
    plan = JSON.parse(cleanText);
  } catch {
    return NextResponse.json({
      answer:
        "I couldn't understand your question. Try asking something like: 'What is the gas price on Ethereum?' or 'What is the balance of 0x123...?'",
    });
  }

  // Step 2 — Call Pocket Network RPC
  let rpcResult;
  try {
    rpcResult = await callPocketRPC(plan.chain, plan.method, plan.params);
  } catch (err) {
    return NextResponse.json({
      answer: `⚠️ ${err instanceof Error ? err.message : "Unknown RPC error"}. Please try again.`,
      plan,
    });
  }

  // Step 3 — Format the result
  const formattedResult = formatResult(plan.method, rpcResult);

  // Step 4 — Explain in plain English
  const finalResponse = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content:
          "You are a helpful blockchain assistant. Explain blockchain data in simple, clear English. Be concise, accurate, and friendly. Do not mention hex values unless relevant.",
      },
      {
        role: "user",
        content: `User question: ${message}\nBlockchain data from Pocket Network: ${formattedResult}\nExplain this result clearly in 1-3 sentences.`,
      },
    ],
  });

  return NextResponse.json({
    answer: finalResponse.choices[0].message.content,
    plan,
    raw: rpcResult,
    formatted: formattedResult,
  });
}