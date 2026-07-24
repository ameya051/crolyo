type WidgetConfig = {
  siteId: string;
  name: string;
  primaryColor: string;
  welcomeMessage: string;
  realtime: { url: string; publishableKey: string };
};

type ChatModule = {
  mountChat: (options: {
    shadow: ShadowRoot;
    apiBase: string;
    config: WidgetConfig;
    onClose: () => void;
  }) => void;
};

const bootScript = document.currentScript instanceof HTMLScriptElement ? document.currentScript : null;

function currentScript(): HTMLScriptElement | null {
  if (bootScript) return bootScript;
  if (document.currentScript instanceof HTMLScriptElement) return document.currentScript;
  const scripts = document.querySelectorAll<HTMLScriptElement>("script[data-site-id]");
  return scripts[scripts.length - 1] ?? null;
}

function renderLauncher(shadow: ShadowRoot, color: string, label: string): HTMLButtonElement {
  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; }
    button { align-items:center; background:${color}; border:0; border-radius:999px; box-shadow:0 12px 28px rgba(0,0,0,.2); color:#fff; cursor:pointer; display:flex; font:600 14px/1.2 system-ui,sans-serif; gap:9px; min-height:52px; padding:0 20px; transition:transform .15s ease,box-shadow .15s ease; }
    button:hover { box-shadow:0 16px 34px rgba(0,0,0,.25); transform:translateY(-1px); }
    button:focus-visible { outline:3px solid rgba(255,255,255,.9); outline-offset:3px; }
    svg { height:20px; width:20px; }
  `;
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", `Open chat with ${label}`);
  button.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-9 8.5 9.5 9.5 0 0 1-4.5-1.1L3 20l1.2-3.5A8.4 8.4 0 0 1 3 12a8.5 8.5 0 0 1 8.5-8.5h.5A8.5 8.5 0 0 1 21 11.5Z"/></svg><span>Chat with us</span>';
  shadow.append(style, button);
  return button;
}

async function initialize() {
  const script = currentScript();
  const siteId = script?.dataset.siteId;
  if (!script || !siteId) return;

  const apiBase = new URL(script.src).origin;
  let config: WidgetConfig;
  try {
    const response = await fetch(`${apiBase}/api/widget/config?site_id=${encodeURIComponent(siteId)}`);
    if (!response.ok) throw new Error("Widget configuration request failed");
    config = (await response.json()) as WidgetConfig;
  } catch (error) {
    console.warn("Crolyo chat could not initialize.", error);
    return;
  }

  const host = document.createElement("div");
  host.style.cssText = "bottom:20px;position:fixed;right:20px;z-index:2147483647";
  host.setAttribute("data-crolyo-widget", "");
  const shadow = host.attachShadow({ mode: "open" });
  document.body.append(host);

  let opening = false;
  let launcher: HTMLButtonElement;
  const showLauncher = () => {
    shadow.replaceChildren();
    launcher = renderLauncher(shadow, config.primaryColor, config.name);
    launcher.addEventListener("click", () => void openChat());
  };
  const openChat = async () => {
    if (opening) return;
    opening = true;
    launcher.disabled = true;
    try {
      const runtimeUrl = new URL("widget-chat.js", script.src).href;
      const chat = (await import(runtimeUrl)) as ChatModule;
      launcher.remove();
      chat.mountChat({
        shadow,
        apiBase,
        config,
        onClose: () => {
          opening = false;
          showLauncher();
        },
      });
    } catch (error) {
      opening = false;
      launcher.disabled = false;
      console.warn("Crolyo chat could not open.", error);
    }
  };
  showLauncher();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => void initialize(), { once: true });
} else {
  void initialize();
}
