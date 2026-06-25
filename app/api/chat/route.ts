import Groq from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const POCKET_ENDPOINTS: Record<string, string> = {
  ethereum: process.env.POCKET_RPC_ETH!,
  polygon: process.env.POCKET_RPC_POLYGON!,
};

function hexToETH(hex: string): string {
  const wei = BigInt(hex);
  const eth = Number(wei) / 1e18;
  return eth.toFixed(4);
}

function hexToGwei(hex: string): string {
  const wei = BigInt(hex);
  const gwei = Number(wei) / 1e9;
  return gwei.toFixed(4);
}

async function callPocketRPC(chain: string, method: string, params: unknown[]) {
  const endpoint = POCKET_ENDPOINTS[chain.toLowerCase()];
  if (!endpoint) throw new Error(`Chain ${chain} not supported`);

  const response = await axios.post(endpoint, {
    jsonrpc: "2.0",
    id: 1,
    method,
    params,
  });

  return response.data.result;
}

export async function POST(req: NextRequest) {
  const { message } = await req.json();

  const planResponse = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: `You are a blockchain RPC expert. When given a question, respond ONLY with a JSON object like this:
{
  "chain": "ethereum",
  "method": "eth_getBalance",
  "params": ["0x123...", "latest"],
  "explanation": "Getting the balance of wallet 0x123 on Ethereum"
}
Supported chains: ethereum, polygon.
Never add any text outside the JSON.`,
      },
      { role: "user", content: message },
    ],
  });

  const planText = planResponse.choices[0].message.content || "{}";

  let plan;
  try {
    plan = JSON.parse(planText);
  } catch {
    return NextResponse.json({
      answer: "I couldn't understand your question. Please try rephrasing it.",
    });
  }

  let rpcResult;
  try {
    rpcResult = await callPocketRPC(plan.chain, plan.method, plan.params);
  } catch (err) {
    return NextResponse.json({
      answer: `RPC Error: ${err instanceof Error ? err.message : "Unknown error"}`,
      plan,
    });
  }

  // Convert hex results to human-readable values
  let formattedResult = rpcResult;
  if (typeof rpcResult === "string" && rpcResult.startsWith("0x")) {
    if (plan.method === "eth_getBalance") {
      formattedResult = `${hexToETH(rpcResult)} ETH`;
    } else if (plan.method === "eth_gasPrice") {
      formattedResult = `${hexToGwei(rpcResult)} Gwei`;
    } else if (plan.method === "eth_blockNumber") {
      formattedResult = `Block ${parseInt(rpcResult, 16)}`;
    }
  }

  const finalResponse = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content:
          "You are a helpful blockchain assistant. Explain results in simple, clear language. Be concise and accurate.",
      },
      {
        role: "user",
        content: `Question: ${message}\nRPC Result: ${JSON.stringify(formattedResult)}\nExplain this result clearly.`,
      },
    ],
  });

  return NextResponse.json({
    answer: finalResponse.choices[0].message.content,
    plan,
    raw: rpcResult,
  });
}