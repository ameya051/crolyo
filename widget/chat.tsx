/** @jsxImportSource preact */

import { RealtimeClient } from "@supabase/realtime-js";
import { render } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";

type WidgetConfig = {
  siteId: string;
  name: string;
  primaryColor: string;
  welcomeMessage: string;
  realtime: { url: string; publishableKey: string };
};

type WidgetSession = {
  conversationId: string;
  token: string;
  topic: string;
};

type WidgetMessage = {
  id: string;
  senderType: "visitor" | "agent";
  content: string;
  createdAt: string;
};

type MountOptions = {
  shadow: ShadowRoot;
  apiBase: string;
  config: WidgetConfig;
  onClose: () => void;
};

const SESSION_PREFIX = "crolyo:widget:";

function sessionKey(siteId: string) {
  return `${SESSION_PREFIX}${siteId}`;
}

function readSession(siteId: string): WidgetSession | null {
  try {
    const value = sessionStorage.getItem(sessionKey(siteId));
    if (!value) return null;
    const session = JSON.parse(value) as WidgetSession;
    return session.conversationId && session.token && session.topic ? session : null;
  } catch {
    return null;
  }
}

function saveSession(siteId: string, session: WidgetSession) {
  sessionStorage.setItem(sessionKey(siteId), JSON.stringify(session));
}

function appendMessage(messages: WidgetMessage[], incoming: WidgetMessage): WidgetMessage[] {
  if (messages.some((message) => message.id === incoming.id)) return messages;
  return [...messages, incoming];
}

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? ""
    : new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
}

const styles = `
  :host { all: initial; }
  * { box-sizing:border-box; }
  .chat { background:#fff; border:1px solid rgba(15,23,42,.12); border-radius:18px; box-shadow:0 20px 55px rgba(15,23,42,.22); color:#172033; font:14px/1.45 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; overflow:hidden; width:min(360px,calc(100vw - 32px)); }
  .header { align-items:center; color:#fff; display:flex; gap:10px; min-height:64px; padding:12px 14px; }
  .avatar { align-items:center; background:rgba(255,255,255,.2); border-radius:999px; display:flex; height:34px; justify-content:center; width:34px; }
  .title { font-size:14px; font-weight:700; margin:0; } .subtitle { color:rgba(255,255,255,.82); font-size:11px; margin:1px 0 0; }
  .close { background:transparent; border:0; color:#fff; cursor:pointer; font-size:24px; line-height:1; margin-left:auto; padding:4px; }
  .messages { background:#f8fafc; display:flex; flex-direction:column; gap:10px; height:290px; overflow:auto; padding:16px; }
  .bubble { border-radius:15px; max-width:84%; padding:9px 11px; white-space:pre-wrap; word-break:break-word; }
  .agent { align-self:flex-start; background:#e9edf3; border-top-left-radius:4px; }
  .visitor { align-self:flex-end; border-bottom-right-radius:4px; color:#fff; }
  .time { display:block; font-size:10px; margin-top:4px; opacity:.65; }
  .state { color:#64748b; font-size:12px; margin:auto; text-align:center; }
  form { align-items:flex-end; border-top:1px solid rgba(15,23,42,.1); display:flex; gap:8px; padding:11px; }
  textarea { border:1px solid rgba(15,23,42,.16); border-radius:10px; color:#172033; flex:1; font:inherit; max-height:92px; min-height:38px; outline:none; padding:9px 10px; resize:none; }
  textarea:focus { border-color:var(--crolyo-color); box-shadow:0 0 0 3px color-mix(in srgb,var(--crolyo-color) 18%,transparent); }
  .send { border:0; border-radius:10px; color:#fff; cursor:pointer; height:38px; padding:0 12px; } .send:disabled { cursor:not-allowed; opacity:.55; }
  .error { color:#b42318; font-size:11px; margin:0 12px 8px; }
`;

function ChatApp({ apiBase, config, onClose }: Omit<MountOptions, "shadow">) {
  const [session, setSession] = useState<WidgetSession | null>(null);
  const [messages, setMessages] = useState<WidgetMessage[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("Connecting…");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);
  const storedSession = useMemo(() => readSession(config.siteId), [config.siteId]);

  useEffect(() => {
    let active = true;

    async function createOrRestoreSession() {
      if (storedSession) return storedSession;
      const response = await fetch(`${apiBase}/api/widget/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId: config.siteId }),
      });
      if (!response.ok) throw new Error("Could not start the chat session.");
      const created = (await response.json()) as WidgetSession;
      saveSession(config.siteId, created);
      return created;
    }

    async function load() {
      try {
        const nextSession = await createOrRestoreSession();
        if (!active) return;
        setSession(nextSession);
      } catch (caught) {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Could not open chat.");
          setStatus("Offline");
        }
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [apiBase, config.siteId, storedSession]);

  useEffect(() => {
    if (!session) return;
    let active = true;
    const headers = { "X-Crolyo-Session": session.token };

    async function refreshMessages() {
      const response = await fetch(`${apiBase}/api/widget/messages`, { headers });
      if (!response.ok) throw new Error("Could not load chat history.");
      const payload = (await response.json()) as { messages: WidgetMessage[] };
      if (active) setMessages(payload.messages);
    }

    const realtime = new RealtimeClient(config.realtime.url, {
      params: { apikey: config.realtime.publishableKey },
    });
    const channel = realtime
      .channel(session.topic, { config: { broadcast: { ack: false, self: false } } })
      .on("broadcast", { event: "message" }, (payload) => {
        if (active) setMessages((current) => appendMessage(current, payload.payload as WidgetMessage));
      })
      .subscribe((nextStatus) => {
        if (!active) return;
        if (nextStatus === "SUBSCRIBED") {
          setStatus("Typically replies in a few minutes");
          void refreshMessages().catch(() => setError("Could not refresh chat history."));
        } else if (nextStatus === "CHANNEL_ERROR" || nextStatus === "TIMED_OUT") {
          setStatus("Reconnecting…");
        }
      });

    void refreshMessages().catch(() => setError("Could not load chat history."));
    return () => {
      active = false;
      void realtime.removeChannel(channel);
      realtime.disconnect();
    };
  }, [apiBase, config.realtime.publishableKey, config.realtime.url, session]);

  useEffect(() => {
    const container = messagesRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [messages]);

  async function sendMessage(event: Event) {
    event.preventDefault();
    if (!session || !input.trim() || sending) return;
    const content = input.trim();
    setSending(true);
    setError(null);
    try {
      const response = await fetch(`${apiBase}/api/widget/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Crolyo-Session": session.token },
        body: JSON.stringify({ content }),
      });
      const payload = (await response.json()) as { message?: WidgetMessage; error?: string };
      if (!response.ok || !payload.message) throw new Error(payload.error ?? "Could not send message.");
      setMessages((current) => appendMessage(current, payload.message!));
      setInput("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send message.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section class="chat" style={{ "--crolyo-color": config.primaryColor } as Record<string, string>} aria-label={`Chat with ${config.name}`}>
      <header class="header" style={{ backgroundColor: config.primaryColor }}>
        <span class="avatar" aria-hidden="true">⌁</span>
        <div><p class="title">{config.name}</p><p class="subtitle">{status}</p></div>
        <button class="close" type="button" aria-label="Close chat" onClick={onClose}>×</button>
      </header>
      <div class="messages" ref={messagesRef} aria-live="polite">
        {messages.length === 0 ? <div class="bubble agent">{config.welcomeMessage}</div> : null}
        {messages.map((message) => (
          <div key={message.id} class={`bubble ${message.senderType}`} style={message.senderType === "visitor" ? { backgroundColor: config.primaryColor } : undefined}>
            {message.content}<time class="time">{formatTime(message.createdAt)}</time>
          </div>
        ))}
      </div>
      {error ? <p class="error" role="alert">{error}</p> : null}
      <form onSubmit={sendMessage}>
        <textarea value={input} onInput={(event) => setInput((event.target as HTMLTextAreaElement).value)} maxLength={2000} placeholder="Type a message…" aria-label="Message" disabled={!session || sending} />
        <button class="send" type="submit" style={{ backgroundColor: config.primaryColor }} disabled={!session || sending || !input.trim()}>{sending ? "…" : "Send"}</button>
      </form>
    </section>
  );
}

export function mountChat({ shadow, apiBase, config, onClose }: MountOptions) {
  const root = document.createElement("div");
  const style = document.createElement("style");
  style.textContent = styles;
  shadow.append(style, root);

  render(<ChatApp apiBase={apiBase} config={config} onClose={() => { render(null, root); onClose(); }} />, root);
}
