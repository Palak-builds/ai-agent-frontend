"use client";

import { useState } from "react";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setReply("");

    try {
      const res = await fetch("http://localhost:5678/webhook/ai-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      setReply(data.reply || "No response received");
    } catch (err) {
      setReply("Error: could not reach the AI agent");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 gap-6 bg-zinc-50">
      <h1 className="text-2xl font-semibold">Ask the AI Agent</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 w-full max-w-md">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Type your prompt here..."
          className="border rounded p-3 w-full h-24"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-black text-white rounded py-2 px-4 disabled:opacity-50"
        >
          {loading ? "Asking..." : "Ask"}
        </button>
      </form>

      {reply && (
        <div className="border rounded p-4 w-full max-w-md bg-white">
          <p className="text-sm text-zinc-500 mb-1">Response:</p>
          <p>{reply}</p>
        </div>
      )}
    </main>
  );
}