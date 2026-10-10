/* ------------------------------------------------------------------ */
/*  AIStore — data layer                                               */
/* ------------------------------------------------------------------ */

export type ViewId =
  | "discover"
  | "categories"
  | "category"
  | "trending"
  | "browse"
  | "submit"
  | "admin"
  | "tool"
  | "wanted";

export type Platform = "web" | "mac" | "win" | "linux" | "ios" | "android";

export const PLATFORM_LABEL: Record<Platform, string> = {
  web: "Web",
  mac: "macOS",
  win: "Windows",
  linux: "Linux",
  ios: "iOS",
  android: "Android",
};

export interface Category {
  id: string;
  label: string;
  short: string;
  blurb: string;
}

export const CATEGORIES: Category[] = [
  { id: "assistants", label: "AI Assistants", short: "Chat", blurb: "Chat frontends and daily drivers for talking to models." },
  { id: "coding", label: "Coding", short: "Coding", blurb: "Agents and copilots that write code with you." },
  { id: "images", label: "Image Generation", short: "Images", blurb: "Studios and pipelines for generating images." },
  { id: "video", label: "Video & Audio", short: "Video & Audio", blurb: "Editing, motion, and media tooling with AI inside." },
  { id: "voice", label: "Voice", short: "Voice", blurb: "Speech-to-text, text-to-speech, and voice cloning." },
  { id: "agents", label: "Agents", short: "Agents", blurb: "Autonomous and semi-autonomous agent frameworks." },
  { id: "research", label: "Research", short: "Research", blurb: "Answer engines, notebooks, and retrieval over your knowledge." },
  { id: "writing", label: "Writing", short: "Writing", blurb: "Notes and long-form writing with AI assistance." },
  { id: "automation", label: "Automation", short: "Automation", blurb: "Workflows and pipelines that connect everything." },
  { id: "productivity", label: "Productivity", short: "Productivity", blurb: "Workspaces and thinking tools with AI built in." },
  { id: "privacy", label: "Privacy", short: "Privacy", blurb: "Tools that keep your data local and private." },
  { id: "devtools", label: "Developer Tools", short: "Dev Tools", blurb: "Serve, observe, and ship models in production." },
];

export interface Tool {
  id: string;
  name: string;
  repo: string;
  desc: string;
  replaces: string;
  cat: string;
  stars: number;
  platforms: Platform[];
  selfHosted?: boolean;
  sourceAvailable?: boolean;
  weeklyGain?: number;
  createdAt: string;
  emoji: string;
  glyph?: string;
  /* editorial extras */
  rating?: { score: number; reviews: number; source: string; highlight: string; feedbackNotes?: number };
  featuredArt?: "terminal" | "chat" | "nodes" | "wave" | "flow";
  featured?: boolean;
  /* live/API extras (populated by the tools provider) */
  votes?: number;
  status?: "curated" | "community" | string;
  submitter?: string | null;
}

const T = (
  id: string,
  name: string,
  repo: string,
  desc: string,
  replaces: string,
  cat: string,
  stars: number,
  platforms: Platform[],
  createdAt: string,
  emoji: string,
  extra: Partial<Tool> = {},
): Tool => ({ id, name, repo, desc, replaces, cat, stars, platforms, createdAt, emoji, ...extra });

export const TOOLS: Tool[] = [
  T("opencode", "OpenCode", "sst/opencode", "An AI coding agent that feels at home in your terminal.", "Claude Code", "coding", 211_900, ["mac", "win", "linux"], "2025-03-14", "🧑‍💻", { featuredArt: "terminal", featured: true }),
  T("openclaw", "OpenClaw", "openclaw/openclaw", "Your assistant, on your devices and in your chats.", "ChatGPT personal assistant workflows", "agents", 391_400, ["mac", "win", "linux", "web", "ios", "android"], "2025-11-02", "🦞"),
  T("paperclip", "Paperclip", "paperclipai/paperclip", "Bring your agents, tasks, and work into one place.", "Devin team workflows", "agents", 97_500, ["mac", "win", "linux"], "2024-12-09", "📎", { selfHosted: true, weeklyGain: 8_700, featuredArt: "flow" }),
  T("open-webui", "Open WebUI", "open-webui/open-webui", "A beautiful, self-hosted home for your AI conversations.", "ChatGPT interface", "assistants", 154_000, ["web", "mac", "win", "linux"], "2023-08-21", "💬", { selfHosted: true, sourceAvailable: true, featuredArt: "chat", rating: { score: 4.6, reviews: 214, source: "G2", highlight: "Reviewers highlight multi-model support and effortless self-hosting for teams that need data control." } }),
  T("ollama", "Ollama", "ollama/ollama", "Run open models locally with one command.", "Hosted LLM APIs", "devtools", 145_000, ["mac", "win", "linux"], "2023-06-26", "🦙", { selfHosted: true }),
  T("sd-webui", "Stable Diffusion WebUI", "AUTOMATIC1111/stable-diffusion-webui", "The classic toolbox for Stable Diffusion.", "DALL·E web", "images", 151_000, ["web", "linux", "mac", "win"], "2022-08-22", "🖼️", { selfHosted: true }),
  T("autogpt", "AutoGPT", "Significant-Gravitas/AutoGPT", "Give a goal. Watch it work.", "Automation consultants", "agents", 174_000, ["linux", "mac", "win", "web"], "2023-03-30", "♾️", { selfHosted: true }),
  T("n8n", "n8n", "n8n-io/n8n", "Automate anything with AI-native workflows.", "Zapier", "automation", 104_400, ["web", "linux", "mac", "win"], "2019-07-11", "🪢", { selfHosted: true, featuredArt: "flow" }),
  T("librechat", "LibreChat", "danny-avila/LibreChat", "One chat for every model your team uses.", "ChatGPT Teams", "assistants", 84_300, ["web"], "2023-02-18", "🗨️", { selfHosted: true, rating: { score: 4.5, reviews: 168, source: "G2", highlight: "Reviewers value multi-provider routing, SSO, and a familiar ChatGPT-style UX they can host themselves." }, featuredArt: "chat" }),
  T("difys", "Dify", "langgenius/dify", "Ship LLM apps without the glue code.", "OpenAI platform", "devtools", 92_100, ["web", "linux"], "2023-04-11", "🚀", { selfHosted: true }),
  T("opencut", "OpenCut", "OpenCut-app/OpenCut", "Your stories. Your editor. No subscription required.", "CapCut", "video", 92_600, ["web", "mac", "win", "linux"], "2025-01-17", "✂️", { selfHosted: true }),
  T("openhands", "OpenHands", "All-Hands-AI/OpenHands", "AI agents that help bring your software ideas to life.", "Devin", "agents", 90_000, ["web", "linux"], "2024-03-12", "🙌", { selfHosted: true }),
  T("comfyui", "ComfyUI", "comfyanonymous/ComfyUI", "A node-based studio for AI image generation.", "Midjourney workflows", "images", 78_900, ["web", "linux", "mac", "win"], "2023-01-24", "🎨", { selfHosted: true, featuredArt: "nodes", featured: true }),
  T("gpt4all", "GPT4All", "nomic-ai/gpt4all", "Local chat models for everyday hardware.", "ChatGPT offline", "assistants", 73_400, ["mac", "win", "linux"], "2023-04-02", "💻", { selfHosted: true }),
  T("whisper", "Whisper", "openai/whisper", "Robust speech recognition from open models.", "Otter.ai", "voice", 81_200, ["linux", "mac", "win"], "2022-09-21", "🎧", { selfHosted: true }),
  T("hyperframes", "HyperFrames", "heygen-com/hyperframes", "Write HTML. Render video. Bring ideas into motion.", "After Effects motion workflows", "video", 57_200, ["mac", "win", "linux"], "2024-10-03", "🎞️", { weeklyGain: 3_100 }),
  T("voicestudio", "VoiceStudio", "debpalash/VoiceStudio", "A local-first studio for voice, speech, and storytelling.", "ElevenLabs", "voice", 53_600, ["mac", "win", "linux"], "2024-11-20", "🎙️", { selfHosted: true, weeklyGain: 14_700, featuredArt: "wave", featured: true }),
  T("ragflow", "RAGFlow", "infiniflow/ragflow", "Deep retrieval for your team's knowledge.", "Glean", "research", 54_300, ["web", "linux"], "2024-02-27", "🧲", { selfHosted: true }),
  T("privategpt", "privateGPT", "zylon-ai/private-gpt", "Ask questions to your documents. 100% private.", "ChatGPT for docs", "assistants", 54_300, ["linux", "mac", "win"], "2023-05-07", "🔏", { selfHosted: true }),
  T("anythingllm", "AnythingLLM", "Mintplex-Labs/anything-llm", "Chat with your documents, anywhere.", "ChatGPT + Dropbox AI", "assistants", 45_200, ["mac", "win", "linux", "web"], "2023-06-15", "📚", { selfHosted: true, rating: { score: 4.3, reviews: 176, source: "Capterra", highlight: "Reviewers value simple document chat, desktop apps, and workspaces that keep private data on private hardware.", feedbackNotes: 62 } }),
  T("fooocus", "Fooocus", "lllyasviel/Fooocus", "Image generation with zero fiddling.", "Midjourney", "images", 42_700, ["linux", "win", "mac"], "2023-09-18", "🪄", { selfHosted: true }),
  T("coqui", "Coqui TTS", "coqui-ai/TTS", "Deep learning text-to-speech for every language.", "ElevenLabs API", "voice", 40_100, ["linux", "mac", "win"], "2022-08-05", "🐸", { selfHosted: true }),
  T("open-notebook", "Open Notebook", "open-notebook/open-notebook", "Your research, connected. Your models, your choice.", "Google NotebookLM", "research", 39_800, ["web"], "2025-02-08", "📓", { selfHosted: true }),
  T("fastchat", "FastChat", "lm-sys/FastChat", "Serve and evaluate open chat models.", "Managed inference", "devtools", 38_400, ["web", "linux"], "2023-03-08", "🏎️", { selfHosted: true }),
  T("bark", "Bark", "suno-ai/bark", "Text-prompted generative audio.", "TTS APIs", "voice", 37_200, ["linux"], "2023-04-20", "🐶", { selfHosted: true }),
  T("openvoice", "OpenVoice", "myshell-ai/OpenVoice", "Instant voice cloning in multiple languages.", "Resemble AI", "voice", 34_200, ["linux"], "2023-12-04", "🎚️", { selfHosted: true }),
  T("aider", "Aider", "Aider-AI/aider", "AI pair programming in your terminal.", "GitHub Copilot", "coding", 34_200, ["mac", "win", "linux"], "2023-06-01", "⌨️"),
  T("jan", "Jan", "menloresearch/jan", "Offline AI that runs on your machine.", "ChatGPT desktop", "assistants", 32_400, ["mac", "win", "linux"], "2023-11-13", "🧿", { selfHosted: true, rating: { score: 4.3, reviews: 153, source: "Capterra", highlight: "Reviewers highlight true offline mode and an open, local-first format that keeps models on their own machines." } }),
  T("crewai", "CrewAI", "crewAIInc/crewAI", "Role-playing agent crews for real tasks.", "Agent SaaS", "agents", 31_400, ["linux", "mac", "win"], "2023-11-01", "👥"),
  T("flowise", "Flowise", "FlowiseAI/Flowise", "Build agents visually, deploy anywhere.", "Enterprise RAG platforms", "agents", 30_100, ["web", "linux", "mac", "win"], "2023-04-28", "🌊", { selfHosted: true, weeklyGain: 1_900 }),
  T("khoj", "Khoj", "khoj-ai/khoj", "Your second brain, on your own server.", "Notion AI search", "research", 29_400, ["web", "mac", "win", "linux"], "2022-03-16", "🧠", { selfHosted: true }),
  T("open-lovable", "Open Lovable", "firecrawl/open-lovable", "Turn a website idea into a React app.", "Lovable", "coding", 28_600, ["web"], "2025-07-22", "🔥", { selfHosted: true }),
  T("vllm", "vLLM", "vllm-project/vllm", "High-throughput, memory-efficient LLM serving.", "Managed inference", "devtools", 47_500, ["linux"], "2023-05-22", "⚡", { selfHosted: true }),
  T("cline", "Cline", "cline/cline", "An open coding agent in your editor.", "Copilot Workspace", "coding", 45_700, ["mac", "win", "linux"], "2024-07-09", "🧩"),
  T("lobechat", "LobeChat", "lobehub/lobe-chat", "A design-driven AI chat framework.", "ChatGPT plugins", "assistants", 60_400, ["web", "mac", "win", "linux"], "2023-08-10", "🪐", { selfHosted: true }),
  T("langflow", "Langflow", "langflow-ai/langflow", "Visual builder for multi-agent apps.", "Enterprise agent platforms", "agents", 51_300, ["web", "linux", "mac"], "2023-08-24", "🧱", { selfHosted: true }),
  T("invokeai", "InvokeAI", "invoke-ai/InvokeAI", "A pro studio for diffusion workflows.", "Adobe Firefly", "images", 25_100, ["win", "mac", "linux"], "2022-10-25", "🎛️", { selfHosted: true }),
  T("t3code", "T3 Code", "pingdotgg/t3code", "One thoughtful interface for the coding agents you use.", "Conductor", "coding", 25_500, ["mac", "win", "linux", "web", "ios", "android"], "2024-09-05", " ", { glyph: "T3", weeklyGain: 1_300 }),
  T("perplexica", "Perplexica", "ItzCrazyKns/Perplexica", "An open, self-hosted answer engine.", "Perplexity", "research", 22_400, ["web"], "2024-04-16", "🔎", { selfHosted: true }),
  T("qdrant", "Qdrant", "qdrant/qdrant", "Vector search at scale.", "Pinecone", "devtools", 23_800, ["linux", "mac", "win"], "2021-05-11", "🛰️", { selfHosted: true }),
  T("continue", "Continue", "continuedev/continue", "The open-source autopilot in your IDE.", "Copilot", "coding", 25_400, ["mac", "win", "linux"], "2023-05-30", "🔁"),
  T("localai", "LocalAI", "mudler/LocalAI", "A drop-in OpenAI-compatible API that runs local.", "OpenAI API", "privacy", 33_600, ["linux", "mac", "win"], "2023-05-18", "🦾", { selfHosted: true }),
  T("frigate", "Frigate", "blakeblackshear/frigate", "Local NVR with real-time object detection.", "Ring", "privacy", 24_900, ["linux"], "2021-01-30", "📹", { selfHosted: true }),
  T("chroma", "Chroma", "chroma-core/chroma", "The AI-native vector database.", "Pinecone", "devtools", 19_500, ["linux", "mac"], "2023-04-06", "🧬", { selfHosted: true }),
  T("openwork", "OpenWork", "openwork-dev/openwork", "A desktop workspace for agents doing real work.", "Claude Cowork", "agents", 23_900, ["mac", "win", "linux"], "2025-10-12", "🧰", { selfHosted: true }),
  T("litellm", "LiteLLM", "BerriAI/litellm", "One API for 100+ models.", "Provider SDKs", "devtools", 21_400, ["web", "linux"], "2023-07-19", "🔀", { selfHosted: true }),
  T("langfuse", "Langfuse", "langfuse/langfuse", "Open LLM engineering platform: traces, evals, prompts.", "LangSmith", "devtools", 15_400, ["web", "linux"], "2023-07-03", "🚦", { selfHosted: true }),
  T("maxkb", "MaxKB", "1Panel-dev/MaxKB", "A knowledge-base QA bot your team can actually use.", "Intercom Fin", "assistants", 14_900, ["web", "linux"], "2023-09-08", "📖", { selfHosted: true }),
  T("onyx", "Onyx", "onyx-dot-app/onyx", "Chat with your company docs, with citations.", "Glean", "assistants", 13_800, ["web", "linux"], "2023-06-21", "📮", { selfHosted: true }),
  T("weaviate", "Weaviate", "weaviate/weaviate", "An open-source vector database.", "Pinecone", "devtools", 13_400, ["linux", "mac", "win"], "2020-04-09", "🧭", { selfHosted: true }),
  T("windmill", "Windmill", "windmill-labs/windmill", "Turn scripts into workflows and internal UIs.", "Retool + Airflow", "automation", 12_800, ["web", "linux"], "2022-11-15", "🌀", { selfHosted: true }),
  T("libretranslate", "LibreTranslate", "LibreTranslate/LibreTranslate", "A free, self-hosted translation API.", "Google Translate API", "privacy", 11_200, ["web", "linux"], "2020-12-21", "🌍", { selfHosted: true }),
  T("openwhispr", "OpenWhispr", "openwhispr/openwhispr", "Turn a thought into text. In any app.", "Wispr Flow", "voice", 9_100, ["mac", "win", "linux"], "2025-04-19", "🗣️"),
  T("morphic", "Morphic", "miurla/morphic", "A generative UI answer engine.", "Perplexity", "research", 7_800, ["web"], "2024-05-25", "💎", { selfHosted: true }),
  T("reor", "Reor", "reorproject/reor", "An AI note app that organizes itself.", "Mem.ai", "writing", 7_700, ["mac", "win", "linux"], "2023-12-19", "🗒️", { selfHosted: true }),
  T("sillytavern", "SillyTavern", "SillyTavern/SillyTavern", "A character-driven writing and roleplay studio.", "Character.AI", "writing", 25_900, ["web", "mac", "win", "linux"], "2023-02-26", "🎭", { selfHosted: true }),
  T("activepieces", "Activepieces", "activepieces/activepieces", "Open no-code automation with AI steps.", "Zapier", "automation", 15_400, ["web", "linux"], "2023-06-30", "🫀", { selfHosted: true }),
  T("huginn", "Huginn", "huginn/huginn", "Agents that watch the web and act for you.", "IFTTT", "automation", 45_900, ["linux"], "2013-01-25", "🕷️", { selfHosted: true }),
  T("appflowy", "AppFlowy", "AppFlowy-IO/AppFlowy", "A workspace that works the way you think.", "Notion", "productivity", 61_400, ["mac", "win", "linux"], "2021-04-08", "🌼", { sourceAvailable: true }),
  T("excalidraw", "Excalidraw", "excalidraw/excalidraw", "Ideas and diagrams, end-to-end encrypted.", "Miro", "productivity", 96_400, ["web"], "2020-01-15", "✏️"),
  T("tg-webui", "Text Generation WebUI", "oobabooga/text-generation-webui", "A Gradio web UI for local LLMs.", "Chatbot UIs", "devtools", 43_800, ["linux", "mac", "win"], "2023-03-14", "🖥️", { selfHosted: true }),
  T("helicone", "Helicone", "Helicone/helicone", "Logging, caching, and evals for LLM apps.", "LangSmith", "devtools", 8_900, ["web"], "2023-10-02", "📊", { selfHosted: true }),
  T("yoinks", "Yoinks", "pablostanley/yoinks", "A simple way to download video from your terminal.", "4K Video Downloader", "video", 4_600, ["mac", "win", "linux"], "2025-05-11", "📼", { weeklyGain: 2_400 }),
  T("openscreen", "OpenScreen", "openscreen/openscreen", "Record your screen and turn it into a polished demo.", "Screen Studio", "video", 3_700, ["mac", "win", "linux"], "2025-09-01", "📽️"),
];

/* ------------------------------ helpers ------------------------------ */

export const fmtK = (n: number): string => {
  if (n >= 1000) {
    const k = n / 1000;
    const s = k >= 100 ? k.toFixed(0) : k.toFixed(1);
    return `${s.replace(/\.0$/, "")}K`;
  }
  return `${n}`;
};

export const catById = (id: string): Category =>
  CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0];

export const catLabel = (id: string): string => catById(id).label;

export const countByCat = (id: string, list: Tool[] = TOOLS): number =>
  list.filter((t) => t.cat === id).length;

export const platformLabel = (t: Tool): string =>
  PLATFORM_LABEL[t.platforms[0] ?? "web"];

export const trendingTools = (list: Tool[] = TOOLS): Tool[] =>
  list.filter((t) => typeof t.weeklyGain === "number").sort(
    (a, b) => (b.weeklyGain ?? 0) - (a.weeklyGain ?? 0),
  );

export const byId = (id: string, list: Tool[] = TOOLS): Tool | undefined =>
  list.find((t) => t.id === id);

export const EDITORS_PICKS = (list: Tool[] = TOOLS): Tool[] =>
  ["opencode", "voicestudio", "comfyui"]
    .map((id) => byId(id, list))
    .filter((t): t is Tool => Boolean(t));

export const OPEN_FAMILY = (list: Tool[] = TOOLS): Tool[] =>
  [
    "open-notebook",
    "openhands",
    "openwhispr",
    "openclaw",
    "openwork",
    "open-lovable",
  ]
    .map((id) => byId(id, list))
    .filter((t): t is Tool => Boolean(t));

export const GOOD_STARTS = (list: Tool[] = TOOLS): Tool[] =>
  [
    "opencode",
    "open-webui",
    "comfyui",
    "librechat",
    "openhands",
    "appflowy",
  ]
    .map((id) => byId(id, list))
    .filter((t): t is Tool => Boolean(t));

export const POPULAR_CARDS = (list: Tool[] = TOOLS): Tool[] =>
  ["comfyui", "n8n", "librechat"]
    .map((id) => byId(id, list))
    .filter((t): t is Tool => Boolean(t));

export const WELL_REVIEWED = (list: Tool[] = TOOLS): Tool[] =>
  ["open-webui", "anythingllm", "jan"]
    .map((id) => byId(id, list))
    .filter((t): t is Tool => Boolean(t));

export const STACK_LIST = (list: Tool[] = TOOLS): Tool[] =>
  ["ollama", "open-webui", "comfyui", "flowise"]
    .map((id) => byId(id, list))
    .filter((t): t is Tool => Boolean(t));

export const PAGE_SEEDS = ["ChatGPT", "Midjourney", "GitHub Copilot", "ElevenLabs"];

export const HERO_CHIPS: { label: string; cat: string | null }[] = [
  { label: "All apps", cat: null },
  { label: "Chat", cat: "assistants" },
  { label: "Coding", cat: "coding" },
  { label: "Images", cat: "images" },
  { label: "Video & Audio", cat: "video" },
  { label: "Voice", cat: "voice" },
  { label: "Agents", cat: "agents" },
  { label: "More...", cat: "__more" },
];

export const VIEW_PAGES: { label: string; view: ViewId; hint: string }[] = [
  { label: "Discover", view: "discover", hint: "Editor's picks and highlights" },
  { label: "Categories", view: "categories", hint: "Browse by what tools help you do" },
  { label: "Trending", view: "trending", hint: "GitHub momentum this week" },
  { label: "New", view: "browse", hint: "Every tool in the collection" },
  { label: "Submit a project", view: "submit", hint: "Add a tool to AIStore" },
];

export function matchTool(t: Tool, qRaw: string): boolean {
  const q = qRaw.trim().toLowerCase();
  if (!q) return true;
  return (
    t.name.toLowerCase().includes(q) ||
    t.replaces.toLowerCase().includes(q) ||
    t.desc.toLowerCase().includes(q) ||
    catLabel(t.cat).toLowerCase().includes(q)
  );
}
