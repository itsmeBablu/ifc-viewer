"use client";

import { useState } from "react";
import { SessionProvider, signIn, signOut, useSession } from "next-auth/react";

function AssistantPanel({ close }: { close: () => void }) {
  const { data: session, status } = useSession();
  const [error, setError] = useState("");
  return (
    <section aria-label="AI modeling assistant" className="fixed bottom-16 right-3 z-[100] max-h-[75dvh] w-[min(390px,calc(100vw-24px))] overflow-auto rounded-2xl border border-zinc-600 bg-zinc-950 p-4 text-sm text-white shadow-xl">
      <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">AI modeling assistant</h2><button onClick={close} aria-label="Close AI assistant">Close</button></div>
      {status === "loading" ? <p>Checking sign-in…</p> : !session?.user ? <>
        <p className="mb-3">Sign in to create and edit your model with AI. Manual modeling is available without signing in.</p>
        <button className="rounded-lg bg-white px-4 py-2 text-black" onClick={() => { void signIn("google").catch(() => setError("Could not start Google sign-in. Please try again.")); }}>Sign in with Google</button>
      </> : <><p>Signed in as {session.user.name ?? session.user.email}.</p><button className="mt-2 underline" onClick={() => void signOut()}>Sign out</button></>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}

export default function AiAssistant() {
  const [open, setOpen] = useState(false);
  return <>
    <button onClick={() => setOpen(!open)} aria-expanded={open} className="fixed bottom-3 right-3 z-[100] rounded-full bg-yellow-400 px-4 py-2 text-sm font-semibold text-black shadow-lg">AI assistant</button>
    {open && <SessionProvider><AssistantPanel close={() => setOpen(false)} /></SessionProvider>}
  </>;
}
