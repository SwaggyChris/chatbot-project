export type ChatRole = "user" | "assistant";
export type ThemeId = "dark" | "light" | "grey" | "retro" | "christmas" | "space" | "custom";
export type ProjectIconId = "folder" | "code" | "game" | "work" | "rocket" | "star";
export type ProjectColorId = "blue" | "purple" | "green" | "orange" | "pink" | "red";
export type MediaKind = "image" | "video" | "audio";

export type Message = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
};

export type Conversation = {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
  projectId: string | null;
};

export type Project = {
  id: string;
  name: string;
  icon: ProjectIconId;
  color: ProjectColorId;
  expanded: boolean;
  createdAt: string;
};

export type Profile = {
  name: string;
  username: string;
  avatarDataUrl: string | null;
};

export type CustomTheme = {
  background: string;
  panel: string;
  text: string;
  accent: string;
  gradientEnabled: boolean;
  gradientFrom: string;
  gradientTo: string;
};

export type AppSettings = {
  theme: ThemeId;
  voiceOutput: boolean;
  customTheme: CustomTheme;
};

export type StoredMedia = {
  id: string;
  name: string;
  mimeType: string;
  kind: MediaKind;
  size: number;
  createdAt: string;
  blob: Blob;
};

export type DisplayMedia = StoredMedia & {
  url: string;
};

export type ModelStatus = {
  online: boolean;
  installed: boolean;
  model: string;
  availableModels?: string[];
  error?: string;
};


export type TrainingItem = {
  id: string;
  title: string;
  content: string;
  enabled: boolean;
  createdAt: string;
};
