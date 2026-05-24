"use client";

import {
  AudioLines,
  BookOpen,
  Bot,
  Check,
  ChevronDown,
  Copy,
  Globe2,
  ImageIcon,
  Menu,
  MessageSquarePlus,
  Mic,
  PanelLeftClose,
  PencilLine,
  Plus,
  Search,
  Settings2,
  SlidersHorizontal,
  Square,
  Trash2,
  Volume2,
  X,
} from "lucide-react";
import {
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Conversation, Message, ModelStatus } from "@/lib/types";

type SpeechRecognitionResultEvent = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

const STORAGE_KEYS = [
  "genesisai-conversations-v3",
  "genesisai-conversations-v2",
  "genesisai-conversations-v1",
];
const ACTIVE_KEYS = [
  "genesisai-active-v3",
  "genesisai-active-v2",
  "genesisai-active-v1",
];

const actionPrompts = [
  {
    title: "Create an image",
    message: "Help me write a detailed prompt for a cinematic AI image.",
    Icon: ImageIcon,
  },
  {
    title: "Write or edit",
    message: "Help me write and improve a professional paragraph.",
    Icon: PencilLine,
  },
  {
    title: "Look something up",
    message: "Explain a useful new technology topic clearly.",
    Icon: Globe2,
  },
];

function makeId() {
  return crypto.randomUUID();
}

function newConversation(): Conversation {
  const createdAt = new Date().toISOString();
  return {
    id: makeId(),
    title: "New chat",
    createdAt,
    messages: [],
  };
}

function formatTime(createdAt: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(createdAt));
}

function GenesisLogo() {
  return (
    <div className="text-[21px] font-semibold tracking-tight text-white">
      Genesis<span className="text-neutral-400">AI</span>
    </div>
  );
}

function AssistantAvatar() {
  return (
    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/10 bg-[#171717]">
      <Bot size={16} className="text-white" />
    </div>
  );
}

export default function GenesisChat() {
  const [chats, setChats] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceOutput, setVoiceOutput] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [status, setStatus] = useState<ModelStatus | null>(null);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [copiedId, setCopiedId] = useState("");
  const [firstTokenTime, setFirstTokenTime] = useState<number | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let restoredChats: Conversation[] = [];
    let restoredActive = "";

    for (const key of STORAGE_KEYS) {
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          restoredChats = JSON.parse(saved) as Conversation[];
          break;
        } catch {
          // Ignore damaged browser history and create a new chat.
        }
      }
    }

    for (const key of ACTIVE_KEYS) {
      const saved = localStorage.getItem(key);
      if (saved) {
        restoredActive = saved;
        break;
      }
    }

    const initial = restoredChats.length ? restoredChats : [newConversation()];
    setChats(initial);
    setActiveId(
      restoredActive && initial.some((chat) => chat.id === restoredActive)
        ? restoredActive
        : initial[0].id,
    );
  }, []);

  useEffect(() => {
    if (!chats.length) return;
    localStorage.setItem(STORAGE_KEYS[0], JSON.stringify(chats));
    localStorage.setItem(ACTIVE_KEYS[0], activeId);
  }, [chats, activeId]);

  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === activeId),
    [chats, activeId],
  );

  const hasConversation = Boolean(activeChat?.messages.length);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeChat?.messages, loading]);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "0px";
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 170)}px`;
  }, [input]);

  const checkStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/genesis/health", { cache: "no-store" });
      const modelStatus = (await response.json()) as ModelStatus;
      setStatus(modelStatus);
    } catch {
      setStatus({
        online: false,
        installed: false,
        model: "qwen3:8b",
        error: "The local model server is offline.",
      });
    }
  }, []);

  useEffect(() => {
    void checkStatus();
    const timer = window.setInterval(() => void checkStatus(), 30000);
    return () => window.clearInterval(timer);
  }, [checkStatus]);

  useEffect(() => {
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) return;

    const recognition = new Recognition();
    recognition.lang = "en-GB";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.onresult = (event) => {
      const speech = event.results[0]?.[0]?.transcript ?? "";
      setInput((current) => `${current}${current ? " " : ""}${speech}`);
    };

    recognitionRef.current = recognition;
    return () => recognition.stop();
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!voiceOutput || !("speechSynthesis" in window)) return;

      window.speechSynthesis.cancel();
      const speech = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      const preferred =
        voices.find((voice) => voice.lang.toLowerCase().startsWith("en-gb")) ??
        voices.find((voice) => voice.lang.toLowerCase().startsWith("en"));

      if (preferred) speech.voice = preferred;
      speech.lang = "en-GB";
      speech.rate = 1;
      window.speechSynthesis.speak(speech);
    },
    [voiceOutput],
  );

  function updateChat(
    id: string,
    updater: (conversation: Conversation) => Conversation,
  ) {
    setChats((current) =>
      current.map((chat) => (chat.id === id ? updater(chat) : chat)),
    );
  }

  async function sendMessage(override?: string) {
    const text = (override ?? input).trim();
    if (!text || loading || !activeChat) return;

    const chatId = activeChat.id;
    const userMessage: Message = {
      id: makeId(),
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    const requestHistory = [...activeChat.messages, userMessage];

    updateChat(chatId, (chat) => ({
      ...chat,
      title: chat.messages.length === 0 ? text.slice(0, 36) : chat.title,
      messages: requestHistory,
    }));

    setInput("");
    setLoading(true);
    setFirstTokenTime(null);

    const responseId = makeId();
    updateChat(chatId, (chat) => ({
      ...chat,
      messages: [
        ...chat.messages,
        {
          id: responseId,
          role: "assistant",
          content: "",
          createdAt: new Date().toISOString(),
        },
      ],
    }));

    const abortController = new AbortController();
    abortRef.current = abortController;
    const startedAt = performance.now();
    let fullResponse = "";
    let receivedFirstText = false;

    try {
      const response = await fetch("/api/genesis/chat", {
        method: "POST",
        signal: abortController.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: requestHistory.map(({ role, content }) => ({ role, content })),
        }),
      });

      if (!response.ok || !response.body) {
        const result = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(result.error ?? "GenesisAI could not receive a model response.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        fullResponse += decoder.decode(value, { stream: true });

        if (!receivedFirstText && fullResponse.trim()) {
          receivedFirstText = true;
          setFirstTokenTime((performance.now() - startedAt) / 1000);
        }

        updateChat(chatId, (chat) => ({
          ...chat,
          messages: chat.messages.map((message) =>
            message.id === responseId
              ? { ...message, content: fullResponse }
              : message,
          ),
        }));
      }

      if (!fullResponse.trim()) {
        throw new Error("The model finished but returned an empty answer.");
      }

      speak(fullResponse);
    } catch (error) {
      if (abortController.signal.aborted) return;

      const details =
        error instanceof Error ? error.message : "Unable to generate a response.";

      updateChat(chatId, (chat) => ({
        ...chat,
        messages: chat.messages.map((message) =>
          message.id === responseId
            ? {
                ...message,
                content: `${details}\n\nCheck that Ollama is running and the configured model is installed.`,
              }
            : message,
        ),
      }));
      void checkStatus();
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  function createChat() {
    const conversation = newConversation();
    setChats((current) => [conversation, ...current]);
    setActiveId(conversation.id);
    setInput("");
    setSidebarOpen(false);
  }

  function deleteChat(id: string) {
    setChats((current) => {
      const remaining = current.filter((chat) => chat.id !== id);
      if (!remaining.length) {
        const empty = newConversation();
        setActiveId(empty.id);
        return [empty];
      }
      if (activeId === id) setActiveId(remaining[0].id);
      return remaining;
    });
  }

  async function copyResponse(message: Message) {
    await navigator.clipboard.writeText(message.content);
    setCopiedId(message.id);
    setTimeout(() => setCopiedId(""), 1000);
  }

  function toggleMicrophone() {
    if (!recognitionRef.current) {
      setInput("Speech recognition is unavailable in this browser. Use Chrome or Edge.");
      return;
    }
    if (listening) recognitionRef.current.stop();
    else recognitionRef.current.start();
  }

  function keyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  }

  function Sidebar({ mobile = false }: { mobile?: boolean }) {
    return (
      <aside className="flex h-full w-[264px] flex-col border-r border-[#202020] bg-black">
        <div className="flex items-center justify-between px-5 pb-4 pt-5">
          <GenesisLogo />
          <button
            onClick={() => setSidebarOpen(false)}
            className={`${mobile ? "" : "hidden"} rounded-lg p-2 text-neutral-400 hover:bg-[#202020] hover:text-white`}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
          {!mobile && (
            <button
              className="rounded-lg p-2 text-neutral-400 hover:bg-[#202020] hover:text-white"
              aria-label="Sidebar"
            >
              <PanelLeftClose size={17} />
            </button>
          )}
        </div>

        <nav className="px-3">
          <button
            onClick={createChat}
            className="flex h-11 w-full items-center gap-3 rounded-xl bg-[#282828] px-3 text-sm font-medium text-white hover:bg-[#303030]"
          >
            <MessageSquarePlus size={17} /> New chat
          </button>
          <button className="mt-1 flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm text-neutral-200 hover:bg-[#171717]">
            <Search size={17} /> Search chats
          </button>
          <button className="flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm text-neutral-200 hover:bg-[#171717]">
            <BookOpen size={17} /> Library
          </button>
        </nav>

        <div className="custom-scroll mt-20 flex-1 overflow-y-auto px-3">
          <p className="mb-3 px-2 text-xs font-semibold text-neutral-200">Projects</p>
          <button className="mb-16 flex h-10 w-full items-center gap-3 rounded-lg px-2 text-sm text-neutral-400 hover:bg-[#171717] hover:text-neutral-200">
            <Plus size={15} /> New project
          </button>

          <p className="mb-3 px-2 text-xs font-semibold text-neutral-200">Recents</p>
          <div className="space-y-1">
            {chats
              .filter((chat) => chat.title !== "New chat" || chat.id === activeId)
              .map((chat) => (
                <div key={chat.id} className="group relative">
                  <button
                    onClick={() => {
                      setActiveId(chat.id);
                      setSidebarOpen(false);
                    }}
                    className={`flex h-10 w-full min-w-0 items-center rounded-lg px-2 pr-9 text-left text-sm ${
                      chat.id === activeId
                        ? "bg-[#212121] text-white"
                        : "text-neutral-300 hover:bg-[#171717]"
                    }`}
                  >
                    <span className="truncate">{chat.title}</span>
                  </button>
                  <button
                    onClick={() => deleteChat(chat.id)}
                    aria-label="Delete conversation"
                    className="absolute right-2 top-2 hidden rounded p-1 text-neutral-500 hover:text-white group-hover:block"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
          </div>
        </div>

        <div className="border-t border-[#202020] p-3">
          <button className="flex h-12 w-full items-center gap-3 rounded-xl px-2 text-sm text-white hover:bg-[#171717]">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-[#222] text-xs">
              C
            </div>
            <span className="flex-1 text-left">Chris</span>
            <Settings2 size={16} className="text-neutral-500" />
          </button>
        </div>
      </aside>
    );
  }

  function Composer({ welcome = false }: { welcome?: boolean }) {
    return (
      <div className={welcome ? "w-full max-w-[640px]" : "w-full max-w-[768px]"}>
        <form
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            void sendMessage();
          }}
          className="rounded-[28px] border border-[#333] bg-[#202020] px-3 pb-2.5 pt-2 shadow-[0_1px_0_rgba(255,255,255,.03)]"
        >
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={keyDown}
            placeholder="Ask anything"
            className="max-h-[170px] min-h-[45px] w-full resize-none bg-transparent px-3 py-3 text-[15px] text-white outline-none placeholder:text-neutral-500"
          />

          <div className="flex items-center justify-between px-1">
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-full text-neutral-400 hover:bg-[#303030] hover:text-white"
              aria-label="Add attachment"
            >
              <Plus size={20} />
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setModelMenuOpen((open) => !open)}
                className="flex h-9 items-center gap-1 rounded-full px-3 text-sm text-neutral-300 hover:bg-[#303030]"
              >
                Thinking <ChevronDown size={14} />
              </button>
              <button
                type="button"
                onClick={toggleMicrophone}
                className={`grid h-9 w-9 place-items-center rounded-full transition ${
                  listening
                    ? "bg-white text-black"
                    : "text-neutral-300 hover:bg-[#303030] hover:text-white"
                }`}
                aria-label="Use microphone"
              >
                <Mic size={18} />
              </button>
              {loading ? (
                <button
                  type="button"
                  onClick={() => {
                    abortRef.current?.abort();
                    setLoading(false);
                  }}
                  className="grid h-10 w-10 place-items-center rounded-full bg-[#1670df] text-white hover:bg-[#287fea]"
                  aria-label="Stop generating"
                >
                  <Square size={15} fill="currentColor" />
                </button>
              ) : input.trim() ? (
                <button
                  type="submit"
                  className="grid h-10 w-10 place-items-center rounded-full bg-[#1670df] text-white hover:bg-[#287fea]"
                  aria-label="Send message"
                >
                  <AudioLines size={19} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={toggleMicrophone}
                  className="grid h-10 w-10 place-items-center rounded-full bg-[#1670df] text-white hover:bg-[#287fea]"
                  aria-label="Voice conversation"
                >
                  <AudioLines size={19} />
                </button>
              )}
            </div>
          </div>
        </form>

        {modelMenuOpen && (
          <div className="relative">
            <div className="absolute bottom-2 right-14 w-64 rounded-xl border border-[#333] bg-[#202020] p-2 shadow-2xl">
              <div className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-white">
                <span>{status?.model ?? "qwen3:8b"}</span>
                <span className={`text-xs ${status?.online ? "text-emerald-400" : "text-amber-300"}`}>
                  {status?.online && status.installed ? "Online" : "Offline"}
                </span>
              </div>
              {firstTokenTime !== null && (
                <p className="px-3 pb-2 text-xs text-neutral-400">
                  Last response started in {firstTokenTime.toFixed(1)}s
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!activeChat) {
    return <main className="h-dvh bg-black" />;
  }

  return (
    <main className="flex h-dvh overflow-hidden bg-black text-[#ececec]">
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {sidebarOpen && (
        <>
          <button
            className="fixed inset-0 z-30 bg-black/70 md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar overlay"
          />
          <div className="fixed inset-y-0 left-0 z-40 md:hidden">
            <Sidebar mobile />
          </div>
        </>
      )}

      <section className="relative flex min-w-0 flex-1 flex-col bg-black">
        <header className="absolute inset-x-0 top-0 z-10 flex h-14 items-center justify-between px-3 md:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-neutral-400 hover:bg-[#171717] hover:text-white md:hidden"
            aria-label="Open sidebar"
          >
            <Menu size={21} />
          </button>

          <div className="hidden md:block" />

          <button
            onClick={() => {
              setVoiceOutput((enabled) => !enabled);
              speechSynthesis?.cancel();
            }}
            className="rounded-full p-2.5 text-neutral-400 hover:bg-[#171717] hover:text-white"
            aria-label="Toggle spoken responses"
          >
            {voiceOutput ? <Volume2 size={18} /> : <SlidersHorizontal size={18} />}
          </button>
        </header>

        {!hasConversation ? (
          <div className="flex flex-1 flex-col items-center justify-center px-4 pb-[10vh]">
            <h1 className="mb-11 text-center text-[29px] font-normal tracking-tight text-[#f3f3f3] sm:text-[32px]">
              What&apos;s on the agenda today?
            </h1>

            <Composer welcome />

            <div className="mt-6 flex max-w-[680px] flex-wrap justify-center gap-3">
              {actionPrompts.map(({ title, message, Icon }) => (
                <button
                  key={title}
                  onClick={() => void sendMessage(message)}
                  className="flex h-11 items-center gap-2 rounded-full border border-[#303030] px-4 text-sm text-[#ededed] transition hover:bg-[#171717]"
                >
                  <Icon size={16} />
                  {title}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="custom-scroll flex-1 overflow-y-auto pb-40 pt-16">
              <div className="mx-auto w-full max-w-[768px] space-y-8 px-4 sm:px-6">
                {activeChat.messages.map((message) => (
                  <article
                    key={message.id}
                    className={message.role === "user" ? "flex justify-end" : "flex gap-4"}
                  >
                    {message.role === "assistant" && <AssistantAvatar />}

                    <div
                      className={
                        message.role === "user"
                          ? "max-w-[80%] rounded-3xl bg-[#202020] px-5 py-3.5"
                          : "min-w-0 max-w-[calc(100%-48px)] flex-1 pt-1"
                      }
                    >
                      <div className="whitespace-pre-wrap text-[15px] leading-7 text-[#f2f2f2]">
                        {message.content ||
                          (loading && message.role === "assistant" && (
                            <div className="flex gap-1.5 py-2">
                              <span className="h-2 w-2 animate-pulse rounded-full bg-neutral-400" />
                              <span className="h-2 w-2 animate-pulse rounded-full bg-neutral-400 [animation-delay:120ms]" />
                              <span className="h-2 w-2 animate-pulse rounded-full bg-neutral-400 [animation-delay:240ms]" />
                            </div>
                          ))}
                      </div>

                      {message.role === "assistant" && message.content && (
                        <div className="mt-2 flex items-center gap-1 text-neutral-500">
                          <button
                            onClick={() => void copyResponse(message)}
                            className="rounded-lg p-2 hover:bg-[#171717] hover:text-white"
                            aria-label="Copy response"
                          >
                            {copiedId === message.id ? <Check size={15} /> : <Copy size={15} />}
                          </button>
                          <button
                            onClick={() => speak(message.content)}
                            className="rounded-lg p-2 hover:bg-[#171717] hover:text-white"
                            aria-label="Speak response"
                          >
                            <Volume2 size={15} />
                          </button>
                          <span className="ml-2 text-xs">{formatTime(message.createdAt)}</span>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
                <div ref={bottomRef} />
              </div>
            </div>

            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black to-transparent px-4 pb-5 pt-10">
              <div className="mx-auto max-w-[768px]">
                <Composer />
                <p className="mt-3 text-center text-xs text-neutral-600">
                  GenesisAI can make mistakes. Check important information.
                </p>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
