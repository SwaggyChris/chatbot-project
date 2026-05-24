"use client";

import {
  ArrowUp,
  AudioLines,
  BookOpen,
  BrainCircuit,
  Bot,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  Download,
  Folder,
  Gamepad2,
  Glasses,
  Globe2,
  ImageIcon,
  Menu,
  MessageSquarePlus,
  Mic,
  MicOff,
  Pencil,
  PencilLine,
  Plus,
  Rocket,
  Search,
  Settings,
  Star,
  Trash2,
  Upload,
  UserRound,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  KeyboardEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { loadMedia, removeMedia, saveMedia } from "@/lib/media-db";
import RichResponse from "./RichResponse";
import type {
  AppSettings,
  CustomTheme,
  Conversation,
  DisplayMedia,
  MediaKind,
  Message,
  ModelStatus,
  Profile,
  Project,
  ProjectColorId,
  ProjectIconId,
  StoredMedia,
  ThemeId,
  TrainingItem,
} from "@/lib/types";

type ViewId = "chat" | "library" | "training" | "settings";
type WebMode = "off" | "auto" | "on";
type SidebarSectionId = "projects" | "recents";
type SpeechResult = { results: ArrayLike<ArrayLike<{ transcript: string }>> };
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: SpeechResult) => void) | null;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

const STORAGE = {
  chats: "genesisai.chats.v4",
  projects: "genesisai.projects.v4",
  settings: "genesisai.settings.v4",
  profile: "genesisai.profile.v4",
  active: "genesisai.active.v4",
  previousGreeting: "genesisai.greeting.v4",
  sidebarSections: "swaggbot.sidebar-sections.v1",
  railExpanded: "swaggbot.rail-expanded.v1",
  training: "swaggbot.training.v1",
  webMode: "swaggbot.web-mode.v1",
};

const greetings = [
  "What’s on the agenda today?",
  "Where should we begin?",
  "What are we building today?",
  "Ready to create something new?",
  "What can I help you solve?",
  "What’s on your mind today?",
  "How can SWAGGBOT help?",
  "Let’s make progress today.",
];

const themes: Array<{ id: ThemeId; label: string; note: string }> = [
  { id: "dark", label: "Dark", note: "Pitch black" },
  { id: "light", label: "Light", note: "Bright workspace" },
  { id: "grey", label: "Grey", note: "Soft graphite" },
  { id: "retro", label: "Retro", note: "Terminal amber" },
  { id: "christmas", label: "Christmas", note: "Falling snow" },
  { id: "space", label: "Space", note: "Black starfield" },
  { id: "custom", label: "Custom", note: "Your palette" },
];

const colors: ProjectColorId[] = ["blue", "purple", "green", "orange", "pink", "red"];
const icons: ProjectIconId[] = ["folder", "code", "game", "work", "rocket", "star"];

const promptActions = [
  { label: "Create an image", Icon: ImageIcon, text: "Help me write a detailed prompt for an AI image." },
  { label: "Write or edit", Icon: PencilLine, text: "Help me write and improve a paragraph." },
  { label: "Look something up", Icon: Globe2, text: "Explain a useful topic clearly." },
];

const smartPromptPool = [
  "Design a modern React dashboard component",
  "Help me debug a TypeScript error",
  "Plan features for my local AI desktop app",
  "Organise a game wiki database structure",
  "Write a YouTube video description",
  "Explain an advanced database concept simply",
  "Create a responsive landing page idea",
  "Brainstorm an MMORPG feature system",
  "Review my web app UI and suggest improvements",
  "Create a step-by-step coding study plan",
];

function refreshedSuggestions() {
  return [...smartPromptPool]
    .sort(() => Math.random() - 0.5)
    .slice(0, 4);
}

function id() {
  return crypto.randomUUID();
}

function isoNow() {
  return new Date().toISOString();
}

function blankChat(projectId: string | null = null): Conversation {
  const now = isoNow();
  return { id: id(), title: "New chat", messages: [], createdAt: now, updatedAt: now, projectId };
}

function automaticSubjectTitle(text: string) {
  const clean = text
    .replace(/\s+/g, " ")
    .replace(/^(please\s+|can you\s+|could you\s+|help me\s+(?:with\s+|to\s+)?|i want to\s+|i need to\s+)/i, "")
    .replace(/[?.!,;:]+$/g, "")
    .trim();

  if (!clean) return "New conversation";

  const words = clean.split(" ").slice(0, 8);
  const title = words.join(" ");
  return title.charAt(0).toUpperCase() + title.slice(1);
}

function defaultCustomTheme(): CustomTheme {
  return {
    background: "#050505",
    panel: "#151515",
    text: "#f3f3f3",
    accent: "#d2a24d",
    gradientEnabled: false,
    gradientFrom: "#050505",
    gradientTo: "#151515",
  };
}

function defaultSettings(): AppSettings {
  return { theme: "dark", voiceOutput: true, customTheme: defaultCustomTheme() };
}

function defaultProfile(): Profile {
  return { name: "Chris", username: "@local-user", avatarDataUrl: null };
}

function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function rotatingGreeting() {
  const previous = localStorage.getItem(STORAGE.previousGreeting);
  const available = greetings.filter((item) => item !== previous);
  const choice = available[Math.floor(Math.random() * available.length)] ?? greetings[0];
  localStorage.setItem(STORAGE.previousGreeting, choice);
  return choice;
}

function time(createdAt: string) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date(createdAt));
}

function mediaKind(type: string): MediaKind | null {
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/")) return "audio";
  return null;
}

function ProjectIcon({ value, size = 16 }: { value: ProjectIconId; size?: number }) {
  const props = { size, strokeWidth: 1.9 };
  if (value === "code") return <Code2 {...props} />;
  if (value === "game") return <Gamepad2 {...props} />;
  if (value === "work") return <BriefcaseBusiness {...props} />;
  if (value === "rocket") return <Rocket {...props} />;
  if (value === "star") return <Star {...props} />;
  return <Folder {...props} />;
}

function SwaggGlyph({ large = false }: { large?: boolean }) {
  return (
    <img
      src="/swaggbot-logo.png"
      alt=""
      aria-hidden="true"
      className={`swaggbot-logo ${large ? "large" : ""}`}
    />
  );
}

function Stars() {
  return (
    <div className="space-sky" aria-hidden="true">
      <span className="space-stars" />
      <span className="space-twinkling" />
      <span className="space-clouds" />
      <span className="space-meteor meteor-one" />
      <span className="space-meteor meteor-two" />
    </div>
  );
}

function Snowfall() {
  const flakes = useMemo(
    () =>
      Array.from({ length: 86 }, (_, index) => ({
        id: index,
        left: `${(index * 41 + index * index * 3) % 100}%`,
        size: `${2 + (index % 6)}px`,
        blur: `${index % 4 === 0 ? 0.5 : 0}px`,
        delay: `${-((index * 2.23) % 28)}s`,
        duration: `${19 + (index % 18)}s`,
        opacity: `${0.2 + ((index % 7) * 0.085)}`,
        depth: index % 3 === 0 ? "far" : index % 3 === 1 ? "middle" : "near",
      })),
    [],
  );

  return (
    <div className="snow-layer" aria-hidden="true">
      {flakes.map((flake) => (
        <span
          key={flake.id}
          className={`snowflake ${flake.depth}`}
          style={{
            left: flake.left,
            width: flake.size,
            height: flake.size,
            filter: `blur(${flake.blur})`,
            opacity: flake.opacity,
            animationDelay: flake.delay,
            animationDuration: flake.duration,
          }}
        />
      ))}
    </div>
  );
}

function VoiceIndicator({ stop }: { stop: () => void }) {
  return (
    <div className="voice-listening" role="status" aria-live="polite">
      <span className="voice-live-dot" />
      <div className="voice-copy">
        <strong>Listening</strong>
        <small>Speak to SWAGGBOT</small>
      </div>
      <div className="voice-bars" aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => <i key={index} />)}
      </div>
      <button type="button" onClick={stop} aria-label="Stop microphone">
        <X size={16} />
      </button>
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="modal-layer">
      <button className="modal-backdrop" onClick={onClose} aria-label="Close modal" />
      <section className="modal-card">
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export default function GenesisWorkspace() {
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<ViewId>("chat");
  const [greeting, setGreeting] = useState(greetings[0]);
  const [chats, setChats] = useState<Conversation[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings());
  const [profile, setProfile] = useState<Profile>(defaultProfile());
  const [activeId, setActiveId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
  const [modelOpen, setModelOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [copiedId, setCopiedId] = useState("");
  const [firstToken, setFirstToken] = useState<number | null>(null);
  const [media, setMedia] = useState<DisplayMedia[]>([]);
  const [projectEditor, setProjectEditor] = useState<Project | null | "new">(null);
  const [chatMenuId, setChatMenuId] = useState<string | null>(null);
  const [draggedChatId, setDraggedChatId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [smartPrompts, setSmartPrompts] = useState<string[]>(smartPromptPool.slice(0, 4));
  const [training, setTraining] = useState<TrainingItem[]>([]);
  const [knowledgeTitle, setKnowledgeTitle] = useState("");
  const [knowledgeContent, setKnowledgeContent] = useState("");
  const [expandedSections, setExpandedSections] = useState<Record<SidebarSectionId, boolean>>({
    projects: true,
    recents: true,
  });
  const [railExpanded, setRailExpanded] = useState(false);
  const [temporaryChat, setTemporaryChat] = useState(false);
  const [temporaryConversation, setTemporaryConversation] = useState<Conversation | null>(null);
  const [webMode, setWebMode] = useState<WebMode>("auto");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchSelection, setSearchSelection] = useState<{ type: "chat" | "project"; id: string } | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const speechRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const composerMediaInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const storedChats = readLocal<Conversation[]>(STORAGE.chats, []);
    const storedProjects = readLocal<Project[]>(STORAGE.projects, []);
    const storedSettings = readLocal<AppSettings>(STORAGE.settings, defaultSettings());
    const storedProfile = readLocal<Profile>(STORAGE.profile, defaultProfile());
    const storedTraining = readLocal<TrainingItem[]>(STORAGE.training, []);
    const initialChats = storedChats.filter((chat) => chat.messages.length > 0);
    const savedActive = localStorage.getItem(STORAGE.active);

    setChats(initialChats);
    setProjects(storedProjects);
    setSettings({
      ...defaultSettings(),
      ...storedSettings,
      customTheme: {
        ...defaultCustomTheme(),
        ...(storedSettings.customTheme ?? {}),
      },
    });
    setProfile({
      ...defaultProfile(),
      ...storedProfile,
      username: storedProfile.username ?? "@local-user",
    });
    setTraining(storedTraining);
    setWebMode(readLocal<WebMode>(STORAGE.webMode, "auto"));
    setExpandedSections(
      readLocal<Record<SidebarSectionId, boolean>>(STORAGE.sidebarSections, {
        projects: true,
        recents: true,
      }),
    );
    setRailExpanded(readLocal<boolean>(STORAGE.railExpanded, false));
    setActiveId(
      savedActive && initialChats.some((chat) => chat.id === savedActive)
        ? savedActive
        : initialChats[0]?.id ?? "",
    );
    setGreeting(rotatingGreeting());
    setSmartPrompts(refreshedSuggestions());
    setReady(true);

    loadMedia()
      .then((items) =>
        setMedia(items.map((item) => ({ ...item, url: URL.createObjectURL(item.blob) }))),
      )
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE.chats, JSON.stringify(chats));
    localStorage.setItem(STORAGE.projects, JSON.stringify(projects));
    localStorage.setItem(STORAGE.settings, JSON.stringify(settings));
    localStorage.setItem(STORAGE.profile, JSON.stringify(profile));
    localStorage.setItem(STORAGE.training, JSON.stringify(training));
    localStorage.setItem(STORAGE.webMode, JSON.stringify(webMode));
    localStorage.setItem(STORAGE.active, activeId);
    localStorage.setItem(STORAGE.sidebarSections, JSON.stringify(expandedSections));
    localStorage.setItem(STORAGE.railExpanded, JSON.stringify(railExpanded));
  }, [activeId, chats, expandedSections, profile, projects, railExpanded, ready, settings, training, webMode]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = settings.theme;

    if (settings.theme === "custom") {
      const custom = settings.customTheme;
      root.style.setProperty("--custom-bg", custom.background);
      root.style.setProperty("--custom-panel", custom.panel);
      root.style.setProperty("--custom-text", custom.text);
      root.style.setProperty("--custom-accent", custom.accent);
      root.style.setProperty(
        "--custom-surface",
        custom.gradientEnabled
          ? `linear-gradient(135deg, ${custom.gradientFrom}, ${custom.gradientTo})`
          : custom.background,
      );
    } else {
      root.style.removeProperty("--custom-bg");
      root.style.removeProperty("--custom-panel");
      root.style.removeProperty("--custom-text");
      root.style.removeProperty("--custom-accent");
      root.style.removeProperty("--custom-surface");
    }

    return () => {
      delete root.dataset.theme;
    };
  }, [settings.theme, settings.customTheme]);

  const savedActiveChat = useMemo(() => chats.find((chat) => chat.id === activeId), [activeId, chats]);
  const activeChat = temporaryChat ? temporaryConversation : savedActiveChat;

  const shownChats = useMemo(
    () => [...chats].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
    [chats],
  );

  const unfiledChats = shownChats.filter((chat) => !chat.projectId);
  const chatsForProject = (projectId: string) =>
    shownChats.filter((chat) => chat.projectId === projectId);

  const normalisedSearch = searchQuery.trim().toLowerCase();
  const searchProjects = normalisedSearch
    ? projects.filter((project) => project.name.toLowerCase().includes(normalisedSearch))
    : projects;
  const searchChats = normalisedSearch
    ? shownChats.filter(
        (chat) =>
          chat.title.toLowerCase().includes(normalisedSearch) ||
          chat.messages.some((message) => message.content.toLowerCase().includes(normalisedSearch)),
      )
    : shownChats;

  const searchHistory = shownChats.slice(0, 10);
  const selectedSearchChat =
    searchSelection?.type === "chat"
      ? shownChats.find((chat) => chat.id === searchSelection.id) ?? null
      : null;
  const selectedSearchProject =
    searchSelection?.type === "project"
      ? projects.find((project) => project.id === searchSelection.id) ?? null
      : null;

  useEffect(() => {
    if (searchOpen) {
      requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;

    const handleKeydown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setSearchOpen(false);
        setSearchSelection(null);
        setSearchQuery("");
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [searchOpen]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeChat?.messages, loading]);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "0px";
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
  }, [input]);

  const refreshModelStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/genesis/health", { cache: "no-store" });
      setModelStatus((await response.json()) as ModelStatus);
    } catch {
      setModelStatus({ online: false, installed: false, model: "qwen3:8b", error: "Offline" });
    }
  }, []);

  useEffect(() => {
    void refreshModelStatus();
    const timer = window.setInterval(() => void refreshModelStatus(), 30000);
    return () => window.clearInterval(timer);
  }, [refreshModelStatus]);

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
      const text = event.results[0]?.[0]?.transcript ?? "";
      setInput((current) => `${current}${current ? " " : ""}${text}`);
    };
    speechRef.current = recognition;
    return () => recognition.stop();
  }, []);

  function speak(text: string) {
    if (!settings.voiceOutput || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const voice =
      voices.find((candidate) => candidate.lang.toLowerCase().startsWith("en-gb")) ??
      voices.find((candidate) => candidate.lang.toLowerCase().startsWith("en"));
    if (voice) utterance.voice = voice;
    utterance.lang = "en-GB";
    window.speechSynthesis.speak(utterance);
  }

  function updateChat(chatId: string, update: (chat: Conversation) => Conversation) {
    setChats((current) => current.map((chat) => (chat.id === chatId ? update(chat) : chat)));
  }

  function returnToHome() {
    setTemporaryChat(false);
    setTemporaryConversation(null);
    setView("chat");
    setActiveId("");
    setSelectedProjectId(null);
    setInput("");
    setModelOpen(false);
    setSearchOpen(false);
    setSearchQuery("");
    setSidebarOpen(false);
  }

  function createChat(projectId: string | null = selectedProjectId) {
    setTemporaryChat(false);
    setTemporaryConversation(null);
    setActiveId("");
    setSelectedProjectId(projectId);
    setInput("");
    setSearchOpen(false);
    setSearchQuery("");
    setView("chat");
    setSidebarOpen(false);
  }

  function toggleTemporaryChat() {
    if (temporaryChat) {
      returnToHome();
      return;
    }

    setTemporaryChat(true);
    setTemporaryConversation(null);
    setActiveId("");
    setSelectedProjectId(null);
    setInput("");
    setView("chat");
    setSidebarOpen(false);
  }

  function cycleWebMode() {
    setWebMode((current) => (current === "off" ? "auto" : current === "auto" ? "on" : "off"));
  }

  function deleteChat(chatId: string) {
    setChats((current) => {
      const remaining = current.filter((chat) => chat.id !== chatId);
      if (activeId === chatId) setActiveId(remaining[0]?.id ?? "");
      return remaining;
    });
    setChatMenuId(null);
  }

  function renameChat(chatId: string) {
    const chat = chats.find((item) => item.id === chatId);
    if (!chat) return;
    const title = window.prompt("Rename chat", chat.title)?.trim();
    if (!title) return;
    updateChat(chatId, (item) => ({ ...item, title, updatedAt: isoNow() }));
    setChatMenuId(null);
  }

  function moveChat(chatId: string, projectId: string | null) {
    updateChat(chatId, (chat) => ({ ...chat, projectId, updatedAt: isoNow() }));
    setChatMenuId(null);
  }

  function startChatDrag(event: DragEvent<HTMLDivElement>, chatId: string) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-swaggbot-chat", chatId);
    event.dataTransfer.setData("text/plain", chatId);
    setDraggedChatId(chatId);
  }

  function allowChatDrop(event: DragEvent<HTMLElement>, targetId: string) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (dropTargetId !== targetId) setDropTargetId(targetId);
  }

  function dropChatInto(event: DragEvent<HTMLElement>, projectId: string | null) {
    event.preventDefault();
    const chatId =
      event.dataTransfer.getData("application/x-swaggbot-chat") ||
      event.dataTransfer.getData("text/plain") ||
      draggedChatId;

    if (!chatId) return;

    moveChat(chatId, projectId);

    if (projectId) {
      setProjects((current) =>
        current.map((project) =>
          project.id === projectId ? { ...project, expanded: true } : project,
        ),
      );
      setExpandedSections((current) => ({ ...current, projects: true }));
      setSelectedProjectId(projectId);
    } else {
      setExpandedSections((current) => ({ ...current, recents: true }));
    }

    setDraggedChatId(null);
    setDropTargetId(null);
  }

  function stopChatDrag() {
    setDraggedChatId(null);
    setDropTargetId(null);
  }

  function toggleSidebarSection(section: SidebarSectionId) {
    setExpandedSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  }

  function saveProject(project: Project) {
    setProjects((current) => {
      const exists = current.some((item) => item.id === project.id);
      return exists
        ? current.map((item) => (item.id === project.id ? project : item))
        : [project, ...current];
    });
    setProjectEditor(null);
  }

  function deleteProject(projectId: string) {
    if (!window.confirm("Delete this project folder? Chats will move to Recents.")) return;
    setProjects((current) => current.filter((project) => project.id !== projectId));
    setChats((current) =>
      current.map((chat) =>
        chat.projectId === projectId ? { ...chat, projectId: null, updatedAt: isoNow() } : chat,
      ),
    );
    if (selectedProjectId === projectId) setSelectedProjectId(null);
    setProjectEditor(null);
  }

  function addTrainingItem() {
    const title = knowledgeTitle.trim();
    const content = knowledgeContent.trim();
    if (!title || !content) return;

    const item: TrainingItem = {
      id: id(),
      title,
      content,
      enabled: true,
      createdAt: isoNow(),
    };

    setTraining((current) => [item, ...current]);
    setKnowledgeTitle("");
    setKnowledgeContent("");
  }

  function toggleTrainingItem(itemId: string) {
    setTraining((current) =>
      current.map((item) => item.id === itemId ? { ...item, enabled: !item.enabled } : item),
    );
  }

  function deleteTrainingItem(itemId: string) {
    setTraining((current) => current.filter((item) => item.id !== itemId));
  }

  function downloadChatLogs() {
    const savedChats = [...chats]
      .filter((chat) => chat.messages.length > 0)
      .sort((first, second) => Date.parse(first.createdAt) - Date.parse(second.createdAt));

    const projectName = (projectId: string | null) =>
      projectId ? projects.find((project) => project.id === projectId)?.name ?? "Unknown Project" : "Recents";

    const text = savedChats.length
      ? savedChats
          .map((chat) => {
            const transcript = chat.messages
              .map((message) => {
                const speaker = message.role === "user" ? profile.name || "User" : "SWAGGBOT";
                return `[${new Date(message.createdAt).toLocaleString()}] ${speaker}:\n${message.content}`;
              })
              .join("\n\n");

            return [
              "============================================================",
              `CHAT: ${chat.title}`,
              `LOCATION: ${projectName(chat.projectId)}`,
              `CREATED: ${new Date(chat.createdAt).toLocaleString()}`,
              "============================================================",
              transcript,
            ].join("\n");
          })
          .join("\n\n\n")
      : "SWAGGBOT CHAT LOGS\n\nNo saved conversations are available.";

    const blob = new Blob([`SWAGGBOT CHAT LOG EXPORT\nExported: ${new Date().toLocaleString()}\n\n${text}`], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `swaggbot-chat-logs-${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function uploadMedia(event: ChangeEvent<HTMLInputElement>) {
    const fileList = event.target.files;
    if (!fileList) return;

    for (const file of Array.from(fileList)) {
      const kind = mediaKind(file.type);
      if (!kind) continue;

      const item: StoredMedia = {
        id: id(),
        name: file.name,
        mimeType: file.type,
        kind,
        size: file.size,
        createdAt: isoNow(),
        blob: file,
      };

      await saveMedia(item);
      setMedia((current) => [{ ...item, url: URL.createObjectURL(file) }, ...current]);
    }

    event.target.value = "";
  }

  async function deleteMedia(item: DisplayMedia) {
    await removeMedia(item.id);
    URL.revokeObjectURL(item.url);
    setMedia((current) => current.filter((mediaItem) => mediaItem.id !== item.id));
  }

  async function changeAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;

    const source = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(file);
    });

    const resized = await new Promise<string>((resolve) => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 160;
        canvas.height = 160;
        const context = canvas.getContext("2d");
        if (!context) return resolve(source);
        const crop = Math.min(image.width, image.height);
        const sx = (image.width - crop) / 2;
        const sy = (image.height - crop) / 2;
        context.drawImage(image, sx, sy, crop, crop, 0, 0, 160, 160);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      image.src = source;
    });

    setProfile((current) => ({ ...current, avatarDataUrl: resized }));
    event.target.value = "";
  }

  async function sendMessage(override?: string) {
    const text = (override ?? input).trim();
    if (!text || loading) return;

    const isTemporary = temporaryChat;
    const currentChat = isTemporary ? temporaryConversation : savedActiveChat;
    const chatId = currentChat?.id ?? id();
    const userMessage: Message = { id: id(), role: "user", content: text, createdAt: isoNow() };
    const requestHistory = currentChat ? [...currentChat.messages, userMessage] : [userMessage];

    const initialConversation: Conversation = {
      id: chatId,
      title: automaticSubjectTitle(text),
      messages: requestHistory,
      createdAt: currentChat?.createdAt ?? isoNow(),
      updatedAt: isoNow(),
      projectId: isTemporary ? null : selectedProjectId,
    };

    if (isTemporary) {
      setTemporaryConversation(initialConversation);
    } else if (!currentChat) {
      setChats((current) => [initialConversation, ...current]);
      setActiveId(chatId);
    } else {
      updateChat(chatId, (chat) => ({
        ...chat,
        title: chat.messages.length === 0 ? automaticSubjectTitle(text) : chat.title,
        messages: requestHistory,
        updatedAt: isoNow(),
      }));
    }

    setInput("");
    setLoading(true);
    setFirstToken(null);

    const responseId = id();
    const assistantMessage: Message = {
      id: responseId,
      role: "assistant",
      content: "",
      createdAt: isoNow(),
    };

    if (isTemporary) {
      setTemporaryConversation((current) =>
        current && current.id === chatId
          ? { ...current, messages: [...current.messages, assistantMessage] }
          : current,
      );
    } else {
      setChats((current) =>
        current.map((chat) =>
          chat.id === chatId
            ? { ...chat, messages: [...chat.messages, assistantMessage] }
            : chat,
        ),
      );
    }

    const controller = new AbortController();
    abortRef.current = controller;
    const started = performance.now();
    let completeText = "";
    let firstReceived = false;
    const trainingContext = training
      .filter((item) => item.enabled)
      .map((item) => `Knowledge: ${item.title}\n${item.content}`)
      .join("\n\n")
      .slice(0, 16000);

    function updateAssistant(content: string) {
      if (isTemporary) {
        setTemporaryConversation((current) =>
          current && current.id === chatId
            ? {
                ...current,
                messages: current.messages.map((message) =>
                  message.id === responseId ? { ...message, content } : message,
                ),
                updatedAt: isoNow(),
              }
            : current,
        );
      } else {
        updateChat(chatId, (chat) => ({
          ...chat,
          messages: chat.messages.map((message) =>
            message.id === responseId ? { ...message, content } : message,
          ),
          updatedAt: isoNow(),
        }));
      }
    }

    try {
      const response = await fetch("/api/genesis/chat", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: requestHistory.map(({ role, content }) => ({ role, content })),
          trainingContext,
          webMode,
        }),
      });

      if (!response.ok || !response.body) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Model request failed.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        completeText += decoder.decode(value, { stream: true });

        if (!firstReceived && completeText.trim()) {
          firstReceived = true;
          setFirstToken((performance.now() - started) / 1000);
        }

        updateAssistant(completeText);
      }

      if (!completeText.trim()) throw new Error("The model returned an empty response.");
      speak(completeText);
    } catch (error) {
      if (controller.signal.aborted) return;
      const detail = error instanceof Error ? error.message : "Unable to generate a response.";
      updateAssistant(`${detail}\n\nCheck Ollama and the installed local model.`);
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  function toggleSpeechInput() {
    if (!speechRef.current) {
      setInput("Speech recognition is not available in this browser. Use Chrome or Edge.");
      return;
    }
    if (listening) speechRef.current.stop();
    else speechRef.current.start();
  }

  async function copyMessage(message: Message) {
    await navigator.clipboard.writeText(message.content);
    setCopiedId(message.id);
    setTimeout(() => setCopiedId(""), 1000);
  }

  function replaceCodeBlock(source: string, blockIndex: number, nextCode: string) {
    let currentBlock = -1;
    const safeCode = nextCode.replace(/```/g, "``\\`");

    return source.replace(/```([^\r\n]*)\r?\n([\s\S]*?)```/g, (full, language: string) => {
      currentBlock += 1;
      if (currentBlock !== blockIndex) return full;
      return `\`\`\`${language}\n${safeCode}\n\`\`\``;
    });
  }

  function editAssistantCode(messageId: string, blockIndex: number, nextCode: string) {
    if (temporaryChat) {
      setTemporaryConversation((current) =>
        current
          ? {
              ...current,
              messages: current.messages.map((message) =>
                message.id === messageId
                  ? { ...message, content: replaceCodeBlock(message.content, blockIndex, nextCode) }
                  : message,
              ),
              updatedAt: isoNow(),
            }
          : current,
      );
      return;
    }

    if (!activeChat) return;

    updateChat(activeChat.id, (chat) => ({
      ...chat,
      messages: chat.messages.map((message) =>
        message.id === messageId
          ? { ...message, content: replaceCodeBlock(message.content, blockIndex, nextCode) }
          : message,
      ),
      updatedAt: isoNow(),
    }));
  }

  function composerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  }

  function ProjectEditor({ value }: { value: Project | "new" }) {
    const initial: Project =
      value === "new"
        ? {
            id: id(),
            name: "New project",
            icon: "folder",
            color: "blue",
            expanded: true,
            createdAt: isoNow(),
          }
        : value;
    const [draft, setDraft] = useState<Project>(initial);

    return (
      <Modal title={value === "new" ? "Create project" : "Edit project"} onClose={() => setProjectEditor(null)}>
        <label className="field-label">Project name</label>
        <input
          className="text-field"
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          autoFocus
        />

        <label className="field-label">Icon</label>
        <div className="picker-row">
          {icons.map((icon) => (
            <button
              key={icon}
              className={`icon-pick ${draft.icon === icon ? "selected" : ""}`}
              onClick={() => setDraft({ ...draft, icon })}
              type="button"
            >
              <ProjectIcon value={icon} size={18} />
            </button>
          ))}
        </div>

        <label className="field-label">Colour</label>
        <div className="picker-row">
          {colors.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={color}
              data-color={color}
              className={`colour-pick ${draft.color === color ? "selected" : ""}`}
              onClick={() => setDraft({ ...draft, color })}
            />
          ))}
        </div>

        <div className="modal-actions">
          {value !== "new" && (
            <button className="danger-btn" onClick={() => deleteProject(draft.id)}>
              Delete
            </button>
          )}
          <button className="secondary-btn" onClick={() => setProjectEditor(null)}>
            Cancel
          </button>
          <button
            className="primary-btn"
            onClick={() => draft.name.trim() && saveProject({ ...draft, name: draft.name.trim() })}
          >
            Save
          </button>
        </div>
      </Modal>
    );
  }

  function Sidebar() {
    const expanded = railExpanded || sidebarOpen;

    return (
      <aside className={`sidebar grok-sidebar ${expanded ? "expanded open" : "compact"}`}>
        <div className="rail-header">
          <button className="rail-logo" onClick={returnToHome} aria-label="Return to SWAGGBOT home chat">
            <SwaggGlyph />
          </button>
          {expanded && <span className="rail-wordmark">SWAGGBOT</span>}
          {expanded && (
            <button
              className="collapse-control"
              onClick={() => (sidebarOpen ? setSidebarOpen(false) : setRailExpanded(false))}
              aria-label="Collapse sidebar"
            >
              <ChevronRight size={16} className="collapse-arrow" />
            </button>
          )}
        </div>

        <nav className="rail-actions">
          <button
            className={`rail-action ${view === "chat" && !activeChat?.messages.length && !searchOpen ? "selected" : ""}`}
            onClick={() => createChat(selectedProjectId)}
            title="New chat"
          >
            <MessageSquarePlus size={18} />
            {expanded && <span>New chat</span>}
          </button>

          <button
            className={`rail-action ${searchOpen ? "selected" : ""}`}
            onClick={() => {
              setRailExpanded(true);
              setSearchOpen(true);
              setSearchSelection(null);
              setView("chat");
            }}
            title="Search chats and projects"
          >
            <Search size={18} />
            {expanded && <span>Search</span>}
          </button>

          <button
            className={`rail-action ${view === "library" ? "selected" : ""}`}
            onClick={() => {
              setSearchOpen(false);
              setView("library");
            }}
            title="Library"
          >
            <BookOpen size={18} />
            {expanded && <span>Library</span>}
          </button>

          <button
            className={`rail-action ${view === "training" ? "selected" : ""}`}
            onClick={() => {
              setSearchOpen(false);
              setView("training");
            }}
            title="Knowledge Training"
          >
            <BrainCircuit size={18} />
            {expanded && <span>Knowledge Training</span>}
          </button>
        </nav>

        {expanded ? (
          <div className="sidebar-scroll">
            <div className="section-title expandable-title">
              <button className="section-toggle" onClick={() => toggleSidebarSection("projects")} aria-expanded={expandedSections.projects}>
                <ChevronRight size={14} className={expandedSections.projects ? "expanded" : ""} />
                <span>Projects</span><small>{projects.length}</small>
              </button>
              <button onClick={() => setProjectEditor("new")} aria-label="Create project"><Plus size={15} /></button>
            </div>

            {expandedSections.projects && (
              <div className="project-list collapsible-content">
                {projects.length === 0 && (
                  <button className="empty-section-action" onClick={() => setProjectEditor("new")}>
                    <Plus size={14} /> New Project
                  </button>
                )}
                {projects.map((project) => (
                  <div
                    className={`project-block drop-folder ${dropTargetId === project.id ? "drag-over" : ""}`}
                    key={project.id}
                    onDragOver={(event) => allowChatDrop(event, project.id)}
                    onDrop={(event) => dropChatInto(event, project.id)}
                  >
                    <div className="project-line">
                      <button
                        className={`project-btn ${selectedProjectId === project.id ? "active" : ""}`}
                        onClick={() => {
                          setSelectedProjectId(project.id);
                          setProjects((current) => current.map((item) => item.id === project.id ? { ...item, expanded: !item.expanded } : item));
                        }}
                      >
                        <ChevronRight size={13} className={`folder-chevron ${project.expanded ? "expanded" : ""}`} />
                        <span className="project-colour" data-color={project.color} />
                        <ProjectIcon value={project.icon} />
                        <span>{project.name}</span>
                      </button>
                      <button className="inline-edit" onClick={() => setProjectEditor(project)}><Pencil size={13} /></button>
                    </div>
                    {project.expanded && (
                      <div className="nested-chats">
                        {chatsForProject(project.id).map((chat) => (
                          <div className="chat-render-slot" key={chat.id}>{ChatRow({ chat })}</div>
                        ))}
                        <button className="nested-new" onClick={() => createChat(project.id)}><Plus size={13} /> New chat</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div
              className={`recents-dropzone ${dropTargetId === "recents" ? "drag-over" : ""}`}
              onDragOver={(event) => allowChatDrop(event, "recents")}
              onDrop={(event) => dropChatInto(event, null)}
            >
              <div className="section-title expandable-title recents-title">
                <button className="section-toggle" onClick={() => toggleSidebarSection("recents")} aria-expanded={expandedSections.recents}>
                  <ChevronRight size={14} className={expandedSections.recents ? "expanded" : ""} />
                  <span>Recents</span><small>{unfiledChats.length}</small>
                </button>
              </div>
              {expandedSections.recents && (
                <div className="chat-list collapsible-content">
                  {unfiledChats.map((chat) => (
                    <div className="chat-render-slot" key={chat.id}>{ChatRow({ chat })}</div>
                  ))}
                  {draggedChatId && unfiledChats.length === 0 && (
                    <p className="drop-hint">Drop chat here</p>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : null}

        <div className="rail-footer">
          {!expanded && (
            <button className="expand-control" onClick={() => setRailExpanded(true)} aria-label="Expand sidebar"><ChevronRight size={18} /></button>
          )}
          <button
            className="rail-profile"
            onClick={() => {
              setSearchOpen(false);
              setView("settings");
            }}
            title="Settings"
          >
            {profile.avatarDataUrl ? (
              <img src={profile.avatarDataUrl} className="avatar" alt="Profile avatar" />
            ) : (
              <span className="avatar fallback"><UserRound size={16} /></span>
            )}
            {expanded && (
              <>
                <span className="profile-rail-copy">
                  <strong>{profile.name || "Your name"}</strong>
                  <small>{profile.username || "@username"}</small>
                </span>
                <Settings size={16} />
              </>
            )}
          </button>
        </div>
      </aside>
    );
  }

  function ChatRow({ chat }: { chat: Conversation }) {
    return (
      <div
        className={`chat-row draggable-chat ${draggedChatId === chat.id ? "is-dragging" : ""}`}
        draggable
        onDragStart={(event) => startChatDrag(event, chat.id)}
        onDragEnd={stopChatDrag}
        title="Drag this chat into a project folder"
      >
        <span className="drag-handle" aria-hidden="true"><span /><span /><span /></span>
        <button
          className={`chat-open ${chat.id === activeId && view === "chat" ? "active" : ""}`}
          onClick={() => {
            setTemporaryChat(false);
            setTemporaryConversation(null);
            setActiveId(chat.id);
            setView("chat");
            setSidebarOpen(false);
          }}
        >
          {chat.title}
        </button>
        <button className="chat-more" onClick={() => setChatMenuId(chatMenuId === chat.id ? null : chat.id)}>
          <ChevronDown size={14} />
        </button>
        {chatMenuId === chat.id && (
          <div className="chat-menu">
            <button onClick={() => renameChat(chat.id)}><Pencil size={14} /> Rename</button>
            <label>
              Move to
              <select
                value={chat.projectId ?? ""}
                onChange={(event) => moveChat(chat.id, event.target.value || null)}
              >
                <option value="">Recents</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
            </label>
            <button className="danger" onClick={() => deleteChat(chat.id)}><Trash2 size={14} /> Delete</button>
          </div>
        )}
      </div>
    );
  }

  function Composer({ landing = false }: { landing?: boolean }) {
    return (
      <form
        className={`composer ${landing ? "landing-composer" : ""}`}
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          void sendMessage();
        }}
      >
        <textarea
          ref={textareaRef}
          value={input}
          rows={1}
          placeholder={landing ? greeting : "What do you want to know?"}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={composerKeyDown}
        />
        <div className="composer-actions">
          <button
            type="button"
            className="round-tool"
            onClick={() => composerMediaInputRef.current?.click()}
            aria-label="Upload media"
            title="Upload media to Library"
          >
            <Plus size={19} />
          </button>
          <input
            ref={composerMediaInputRef}
            className="hidden-input"
            type="file"
            accept="image/*,video/*,audio/*"
            multiple
            onChange={(event) => void uploadMedia(event)}
          />
          <div className="right-tools">
            <button type="button" className="thinking-btn" onClick={() => setModelOpen((open) => !open)}>
              Fast <ChevronDown size={14} />
            </button>
            <button type="button" className={`round-tool ${listening ? "active" : ""}`} onClick={toggleSpeechInput}>
              {listening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            <button
              className={`send-btn ${input.trim() && !loading ? "ready-to-send" : ""} ${loading ? "generating" : ""}`}
              type={input.trim() && !loading ? "submit" : "button"}
              aria-label={loading ? "Stop generating" : input.trim() ? "Send message" : "Start voice chat"}
              title={loading ? "Stop generating" : input.trim() ? "Send message" : "Start voice chat"}
              onClick={() =>
                loading
                  ? (abortRef.current?.abort(), setLoading(false))
                  : !input.trim() && toggleSpeechInput()
              }
            >
              {loading ? <X size={18} /> : input.trim() ? <ArrowUp size={19} /> : <AudioLines size={19} />}
            </button>
          </div>
        </div>
        {modelOpen && (
          <div className="model-card">
            <div><strong>{modelStatus?.model ?? "qwen3:8b"}</strong><span className={modelStatus?.online ? "online" : "offline"}>{modelStatus?.online ? "Online" : "Offline"}</span></div>
            {firstToken !== null && <p>Latest response started in {firstToken.toFixed(1)}s.</p>}
          </div>
        )}
      </form>
    );
  }

  function ChatView() {
    if (!activeChat || activeChat.messages.length === 0) {
      return (
        <section className="landing grok-landing">
          <div className="reference-wordmark">
            <SwaggGlyph large />
            <span>SWAGGBOT</span>
          </div>
          {temporaryChat && (
            <div className="temporary-landing-note">
              <Glasses size={15} /> Temporary chat — not saved
            </div>
          )}
          {Composer({ landing: true })}
          <div className="local-status-card">
            <strong>Local AI</strong>
            <span>{modelStatus?.model ?? "qwen3:8b"}</span>
            <small className={modelStatus?.online && modelStatus?.installed ? "ready" : ""}>
              {modelStatus?.online && modelStatus?.installed ? "Ready" : "Setup required"}
            </small>
          </div>
        </section>
      );
    }

    return (
      <>
        <section className="conversation-scroll">
          <div className="conversation">
            {activeChat.messages.map((message) => (
              <article key={message.id} className={`message ${message.role}`}>
                {message.role === "assistant" && <span className="assistant-mark"><Bot size={16} /></span>}
                <div className="message-body">
                  <div className="message-text">
                    {message.content ? (
                      message.role === "assistant" ? (
                        <RichResponse
                          content={message.content}
                          onEditCode={(blockIndex, nextCode) => editAssistantCode(message.id, blockIndex, nextCode)}
                        />
                      ) : (
                        <p className="user-message-copy">{message.content}</p>
                      )
                    ) : (
                      loading && <span className="typing"><i /><i /><i /></span>
                    )}
                  </div>
                  {message.role === "assistant" && message.content && (
                    <div className="message-tools">
                      <button onClick={() => void copyMessage(message)}>
                        {copiedId === message.id ? <Check size={15} /> : <Copy size={15} />}
                      </button>
                      <button onClick={() => speak(message.content)}><Volume2 size={15} /></button>
                      <span>{time(message.createdAt)}</span>
                    </div>
                  )}
                </div>
              </article>
            ))}
            <div ref={bottomRef} />
          </div>
        </section>
        <div className="bottom-composer">
          {temporaryChat && (
            <p className="temporary-thread-note">
              <Glasses size={13} /> Temporary chat — not saved after refresh
            </p>
          )}
          {Composer({ landing: false })}
          <p>SWAGGBOT can make mistakes. Check important information.</p>
        </div>
      </>
    );
  }

  function LibraryView() {
    return (
      <section className="page-view library-view">
        <div className="subpage-header">
          <div className="subpage-title">
            <span className="subpage-icon"><BookOpen size={20} /></span>
            <div>
              <h1>Library</h1>
              <p>Images, videos and audio uploaded through SWAGGBOT and saved on this browser.</p>
            </div>
          </div>
          <div className="subpage-actions">
            <button className="secondary-btn export-log-btn" onClick={downloadChatLogs}>
              <Download size={16} /> Download chat logs
            </button>
            <button className="primary-btn" onClick={() => mediaInputRef.current?.click()}>
              <Upload size={16} /> Upload media
            </button>
            <button className="close-page-btn" onClick={returnToHome} aria-label="Close Library">
              <X size={19} />
            </button>
          </div>
          <input
            ref={mediaInputRef}
            className="hidden-input"
            type="file"
            accept="image/*,video/*,audio/*"
            multiple
            onChange={(event) => void uploadMedia(event)}
          />
        </div>

        {media.length === 0 ? (
          <div className="empty-library">
            <span className="empty-symbol"><ImageIcon size={27} /></span>
            <h2>Your media library is empty</h2>
            <p>Upload images, video or audio using the + button in chat or the upload button above.</p>
            <button className="secondary-upload-btn" onClick={() => mediaInputRef.current?.click()}>
              <Upload size={16} /> Choose media
            </button>
          </div>
        ) : (
          <div className="media-grid">
            {media.map((item) => (
              <figure className="media-card" key={item.id}>
                {item.kind === "image" && <img src={item.url} alt={item.name} />}
                {item.kind === "video" && <video src={item.url} controls />}
                {item.kind === "audio" && (
                  <div className="audio-media">
                    <AudioLines size={34} />
                    <audio src={item.url} controls />
                  </div>
                )}
                <figcaption>
                  <span title={item.name}>{item.name}</span>
                  <button onClick={() => void deleteMedia(item)} aria-label="Delete media">
                    <Trash2 size={15} />
                  </button>
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </section>
    );
  }

  function TrainingView() {
    const activeTrainingCount = training.filter((item) => item.enabled).length;

    return (
      <section className="page-view training-view">
        <div className="subpage-header">
          <div className="subpage-title">
            <span className="subpage-icon gold"><BrainCircuit size={21} /></span>
            <div>
              <h1>Knowledge Training</h1>
              <p>Give SWAGGBOT local knowledge, project details and behaviour preferences.</p>
            </div>
          </div>
          <button className="close-page-btn" onClick={returnToHome} aria-label="Close Knowledge Training">
            <X size={19} />
          </button>
        </div>

        <div className="knowledge-banner">
          <BrainCircuit size={18} />
          <div>
            <strong>Context-powered learning</strong>
            <p>Saved knowledge is securely included with relevant requests. It improves responses without changing Qwen3 model weights.</p>
          </div>
          <span>{activeTrainingCount} active</span>
        </div>

        <div className="training-layout">
          <div className="settings-panel training-form refined-panel">
            <h2>Train with new knowledge</h2>
            <label className="field-label">Title</label>
            <input
              className="text-field"
              value={knowledgeTitle}
              onChange={(event) => setKnowledgeTitle(event.target.value)}
              placeholder="Example: Frontend development preferences"
            />
            <label className="field-label">Knowledge or instructions</label>
            <textarea
              className="knowledge-textarea"
              value={knowledgeContent}
              onChange={(event) => setKnowledgeContent(event.target.value)}
              placeholder="Example: Prefer Next.js App Router, TypeScript, responsive UI and full working file examples."
            />
            <button
              className="primary-btn save-knowledge-btn"
              disabled={!knowledgeTitle.trim() || !knowledgeContent.trim()}
              onClick={addTrainingItem}
            >
              <BrainCircuit size={16} /> Save training knowledge
            </button>
          </div>

          <div className="settings-panel training-items refined-panel">
            <div className="panel-title-row">
              <h2>Saved knowledge</h2>
              <span className="active-pill">{activeTrainingCount} enabled</span>
            </div>
            {training.length === 0 ? (
              <div className="training-empty">
                <BrainCircuit size={24} />
                <strong>No knowledge saved yet</strong>
                <span>Add project facts or response preferences to improve SWAGGBOT.</span>
              </div>
            ) : (
              training.map((item) => (
                <article className="training-item" key={item.id}>
                  <div className="training-item-head">
                    <strong>{item.title}</strong>
                    <button
                      className={`knowledge-toggle ${item.enabled ? "enabled" : ""}`}
                      onClick={() => toggleTrainingItem(item.id)}
                    >
                      {item.enabled ? "Enabled" : "Disabled"}
                    </button>
                    <button className="delete-knowledge" onClick={() => deleteTrainingItem(item.id)} aria-label="Delete training item">
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <p>{item.content}</p>
                </article>
              ))
            )}
          </div>
        </div>
      </section>
    );
  }

  function SettingsView() {
    return (
      <section className="page-view settings-view">
        <div className="subpage-header">
          <div className="subpage-title">
            <span className="subpage-icon"><Settings size={21} /></span>
            <div>
              <h1>Settings</h1>
              <p>Personalise your SWAGGBOT profile, visual theme and voice behaviour.</p>
            </div>
          </div>
          <button className="close-page-btn" onClick={returnToHome} aria-label="Close Settings">
            <X size={19} />
          </button>
        </div>

        <div className="settings-grid">
          <div className="settings-panel profile-panel refined-panel">
            <div className="panel-title-row">
              <h2>Profile</h2>
              <span className="panel-badge">Local</span>
            </div>
            <div className="profile-editor upgraded-profile">
              <button className="avatar-large" onClick={() => avatarInputRef.current?.click()} aria-label="Upload avatar image">
                {profile.avatarDataUrl ? <img src={profile.avatarDataUrl} alt="Avatar" /> : <UserRound size={30} />}
                <span><Pencil size={13} /></span>
              </button>
              <div className="profile-controls">
                <div className="identity-fields">
                  <label className="profile-name">
                    Display name
                    <input
                      value={profile.name}
                      onChange={(event) => setProfile({ ...profile, name: event.target.value })}
                      placeholder="Your display name"
                    />
                  </label>
                  <label className="profile-name">
                    Username
                    <input
                      value={profile.username}
                      onChange={(event) =>
                        setProfile({
                          ...profile,
                          username: event.target.value,
                        })
                      }
                      onBlur={() =>
                        setProfile((current) => ({
                          ...current,
                          username: current.username.trim()
                            ? current.username.trim().startsWith("@")
                              ? current.username.trim()
                              : `@${current.username.trim()}`
                            : "@local-user",
                        }))
                      }
                      placeholder="@username"
                    />
                  </label>
                </div>
                <div className="profile-buttons">
                  <button className="secondary-btn" onClick={() => avatarInputRef.current?.click()}>
                    <Upload size={15} /> Upload avatar
                  </button>
                  {profile.avatarDataUrl && (
                    <button className="remove-avatar-btn" onClick={() => setProfile({ ...profile, avatarDataUrl: null })}>
                      Remove
                    </button>
                  )}
                </div>
              </div>
              <input
                ref={avatarInputRef}
                className="hidden-input"
                type="file"
                accept="image/*"
                onChange={(event) => void changeAvatar(event)}
              />
            </div>
          </div>

          <div className="settings-panel refined-panel">
            <div className="panel-title-row">
              <h2>Voice replies</h2>
              <button
                className={`toggle ${settings.voiceOutput ? "enabled" : ""}`}
                onClick={() => setSettings({ ...settings, voiceOutput: !settings.voiceOutput })}
                aria-label="Toggle automatic voice replies"
              >
                <span />
              </button>
            </div>
            <p className="setting-description">Read SWAGGBOT assistant answers aloud automatically when a response finishes.</p>
          </div>
        </div>

        <div className="settings-panel theme-panel refined-panel">
          <div className="panel-title-row">
            <h2>Appearance</h2>
            <span className="panel-badge">{themes.find((theme) => theme.id === settings.theme)?.label}</span>
          </div>
          <div className="theme-grid">
            {themes.map((theme) => (
              <button
                key={theme.id}
                className={`theme-card ${settings.theme === theme.id ? "selected" : ""}`}
                data-preview={theme.id}
                onClick={() => setSettings({ ...settings, theme: theme.id })}
              >
                <span className="theme-preview" />
                <strong>{theme.label}</strong>
                <small>{theme.note}</small>
              </button>
            ))}
          </div>

          {settings.theme === "custom" && (
            <div className="custom-theme-editor">
              <div className="custom-theme-heading">
                <div>
                  <strong>Custom theme</strong>
                  <p>Build a personal palette and optional gradient background.</p>
                </div>
                <label className="gradient-toggle">
                  <input
                    type="checkbox"
                    checked={settings.customTheme.gradientEnabled}
                    onChange={(event) =>
                      setSettings({
                        ...settings,
                        customTheme: { ...settings.customTheme, gradientEnabled: event.target.checked },
                      })
                    }
                  />
                  Gradient
                </label>
              </div>

              <div className="colour-fields">
                {[
                  ["Background", "background"],
                  ["Panels", "panel"],
                  ["Text", "text"],
                  ["Accent", "accent"],
                ].map(([label, key]) => (
                  <label className="colour-field" key={key}>
                    {label}
                    <input
                      type="color"
                      value={settings.customTheme[key as keyof CustomTheme] as string}
                      onChange={(event) =>
                        setSettings({
                          ...settings,
                          customTheme: { ...settings.customTheme, [key]: event.target.value },
                        })
                      }
                    />
                  </label>
                ))}
                {settings.customTheme.gradientEnabled && (
                  <>
                    <label className="colour-field">
                      Gradient from
                      <input
                        type="color"
                        value={settings.customTheme.gradientFrom}
                        onChange={(event) =>
                          setSettings({
                            ...settings,
                            customTheme: { ...settings.customTheme, gradientFrom: event.target.value },
                          })
                        }
                      />
                    </label>
                    <label className="colour-field">
                      Gradient to
                      <input
                        type="color"
                        value={settings.customTheme.gradientTo}
                        onChange={(event) =>
                          setSettings({
                            ...settings,
                            customTheme: { ...settings.customTheme, gradientTo: event.target.value },
                          })
                        }
                      />
                    </label>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    );
  }

  function SearchOverlay() {
    const projectPreviewChats = selectedSearchProject
      ? shownChats.filter((chat) => chat.projectId === selectedSearchProject.id).slice(0, 8)
      : [];
    const hasQuery = normalisedSearch.length > 0;

    return (
      <div className="search-overlay" onClick={() => { setSearchOpen(false); setSearchSelection(null); }}>
        <section className="search-command" onClick={(event) => event.stopPropagation()}>
          <div className="search-command-top">
            <label className="command-searchbar">
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search..."
              />
              <Search size={19} />
            </label>
          </div>

          <div className="search-command-body">
            <aside className="search-command-left">
              <div className="search-command-section">
                <div className="search-command-heading">
                  <span>Actions</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setSearchSelection(null);
                    }}
                  >
                    Show All
                  </button>
                </div>

                <button
                  className="command-action-card"
                  onClick={() => {
                    toggleTemporaryChat();
                    setSearchOpen(false);
                    setSearchSelection(null);
                  }}
                >
                  <Glasses size={17} />
                  <span>Create New Temporary Chat</span>
                </button>
              </div>

              <div className="search-command-section">
                <div className="search-command-heading">
                  <span>{hasQuery ? "Results" : "History"}</span>
                </div>

                <div className="command-results-list">
                  {hasQuery && searchProjects.map((project) => (
                    <button
                      key={`project-${project.id}`}
                      className={`command-result-item drop-folder ${searchSelection?.type === "project" && searchSelection.id === project.id ? "active" : ""} ${dropTargetId === project.id ? "drag-over" : ""}`}
                      onClick={() => setSearchSelection({ type: "project", id: project.id })}
                      onDragOver={(event) => allowChatDrop(event, project.id)}
                      onDrop={(event) => dropChatInto(event, project.id)}
                    >
                      <span className="project-colour" data-color={project.color} />
                      <ProjectIcon value={project.icon} />
                      <div>
                        <strong>{project.name}</strong>
                        <small>Project</small>
                      </div>
                    </button>
                  ))}

                  {(hasQuery ? searchChats : searchHistory).map((chat) => (
                    <button
                      key={`chat-${chat.id}`}
                      className={`command-result-item ${searchSelection?.type === "chat" && searchSelection.id === chat.id ? "active" : ""}`}
                      onClick={() => setSearchSelection({ type: "chat", id: chat.id })}
                    >
                      <MessageSquarePlus size={16} />
                      <div>
                        <strong>{chat.title}</strong>
                        <small>
                          {chat.projectId
                            ? projects.find((project) => project.id === chat.projectId)?.name ?? "Project"
                            : "Recent"}
                        </small>
                      </div>
                    </button>
                  ))}

                  {(hasQuery ? searchProjects.length + searchChats.length === 0 : searchHistory.length === 0) && (
                    <div className="command-empty-history">
                      {hasQuery ? "No results found" : "History is empty"}
                    </div>
                  )}
                </div>
              </div>
            </aside>

            <div className="search-command-preview">
              {selectedSearchChat ? (
                <div className="command-preview-card">
                  <div className="command-preview-head">
                    <div>
                      <h3>{selectedSearchChat.title}</h3>
                      <p>
                        {selectedSearchChat.projectId
                          ? projects.find((project) => project.id === selectedSearchChat.projectId)?.name ?? "Project"
                          : "Recent"}
                      </p>
                    </div>
                    <button
                      className="command-open-btn"
                      onClick={() => {
                        setTemporaryChat(false);
                        setTemporaryConversation(null);
                        setActiveId(selectedSearchChat.id);
                        setSearchOpen(false);
                        setSearchSelection(null);
                        setSidebarOpen(false);
                        setView("chat");
                      }}
                    >
                      Open
                    </button>
                  </div>

                  <div className="command-preview-thread">
                    {selectedSearchChat.messages.slice(-8).map((message) => (
                      <article key={message.id} className={`command-preview-message ${message.role}`}>
                        <strong>{message.role === "user" ? profile.name || "You" : "SWAGGBOT"}</strong>
                        <p>{message.content}</p>
                      </article>
                    ))}
                  </div>
                </div>
              ) : selectedSearchProject ? (
                <div className="command-preview-card">
                  <div className="command-preview-head">
                    <div className="command-project-title">
                      <span className="project-colour" data-color={selectedSearchProject.color} />
                      <ProjectIcon value={selectedSearchProject.icon} />
                      <h3>{selectedSearchProject.name}</h3>
                    </div>
                    <button
                      className="command-open-btn"
                      onClick={() => {
                        setSelectedProjectId(selectedSearchProject.id);
                        setExpandedSections((current) => ({ ...current, projects: true }));
                        setProjects((current) =>
                          current.map((item) =>
                            item.id === selectedSearchProject.id ? { ...item, expanded: true } : item,
                          ),
                        );
                        setSearchOpen(false);
                        setSearchSelection(null);
                      }}
                    >
                      Open
                    </button>
                  </div>

                  <div className="command-preview-project">
                    {projectPreviewChats.length ? (
                      projectPreviewChats.map((chat) => (
                        <button
                          key={chat.id}
                          className="project-preview-chat"
                          onClick={() => {
                            setActiveId(chat.id);
                            setTemporaryChat(false);
                            setTemporaryConversation(null);
                            setSearchOpen(false);
                            setSearchSelection(null);
                            setView("chat");
                          }}
                        >
                          <MessageSquarePlus size={15} />
                          <span>{chat.title}</span>
                        </button>
                      ))
                    ) : (
                      <div className="command-empty-history">This project has no chats yet.</div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="command-empty-preview">
                  <span>Select a conversation to preview</span>
                </div>
              )}
            </div>
          </div>

          <div className="search-command-bottom">
            <button
              type="button"
              className="command-close-corner"
              onClick={() => {
                setSearchOpen(false);
                setSearchSelection(null);
              }}
              aria-label="Close search"
            >
              <X size={16} />
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (!ready) return <main className="app-shell" />;

  return (
    <main className="app-shell">
      {settings.theme === "space" && <Stars />}
      {settings.theme === "christmas" && <Snowfall />}
      {listening && <VoiceIndicator stop={toggleSpeechInput} />}

      <button className="mobile-menu mobile-only" onClick={() => { setSidebarOpen(true); setRailExpanded(true); }}>
        <Menu size={21} />
      </button>

      {Sidebar()}

      <section className="workspace">
        <header className="workspace-header reference-header">
          <div />
          <div className="header-actions">
            <button
              className={`web-mode-toggle ${webMode !== "off" ? "active" : ""}`}
              onClick={cycleWebMode}
              aria-label={`Internet research mode: ${webMode}. Click to change mode.`}
              title="Off: local only · Auto: search current/web questions · On: search every message"
            >
              <Globe2 size={16} />
              Web
              <span>{webMode === "off" ? "Off" : webMode === "auto" ? "Auto" : "On"}</span>
            </button>
            <button
              className={`temporary-toggle ${temporaryChat ? "active" : ""}`}
              onClick={toggleTemporaryChat}
              aria-pressed={temporaryChat}
            >
              <Glasses size={16} />
              Temporary
            </button>
          </div>
        </header>

        {view === "chat" && ChatView()}
        {view === "library" && LibraryView()}
        {view === "training" && TrainingView()}
        {view === "settings" && SettingsView()}
      </section>

      {searchOpen && SearchOverlay()}
      {projectEditor && <ProjectEditor value={projectEditor} />}
    </main>
  );
}
