"use client";

import NextImage from "next/image";
import {
  Archive,
  BedDouble,
  Box,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  ChefHat,
  Cloud,
  CloudOff,
  Download,
  Focus,
  Film,
  Images,
  Warehouse,
  Grid2X2,
  Home,
  LogOut,
  MapPin,
  Mic,
  Minus,
  Package,
  Plus,
  RefreshCw,
  Rotate3D,
  ScanLine,
  Search,
  Settings,
  ShieldCheck,
  Sofa,
  Sparkles,
  Trash2,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type PointerEvent } from "react";

type SpaceKind = "living" | "kitchen" | "bedroom" | "garage" | "storage" | "other";

type StorageHotspot = {
  id: string;
  label: string;
  x: number;
  y: number;
  confidence: number;
};

type Space = {
  id: string;
  name: string;
  kind: SpaceKind;
  x: number;
  y: number;
  width: number;
  depth: number;
  color: string;
  photo?: string;
  panorama?: string;
  hotspots?: StorageHotspot[];
};

type InventoryItem = {
  id: string;
  name: string;
  spaceId: string;
  container: string;
  category: string;
  quantity: number;
  note: string;
  createdAt: string;
};

type HomeState = {
  spaces: Space[];
  items: InventoryItem[];
  updatedAt: string;
};

type SyncState = "checking" | "local" | "saving" | "cloud" | "error";

type ScanMode = "room" | "floor-plan";

type VisionItem = {
  name: string;
  category: string;
  suggestedStorage: string;
  quantity: number;
  confidence: number;
};

type VisionRoom = {
  name: string;
  kind: SpaceKind;
  confidence: number;
  x: number;
  y: number;
  width: number;
  depth: number;
  storageSpaces: Array<Omit<StorageHotspot, "id"> & { type: string }>;
  visibleItems: VisionItem[];
};

type HomeAnalysis = {
  summary: string;
  rooms: VisionRoom[];
};

const COLORS = ["#dce8cb", "#f0d9bd", "#d7e3ea", "#e5d5dc", "#e8dfb8", "#cddfd9"];
const LOCAL_DB = "nook-home-memory";
const LOCAL_STORE = "home";
const LOCAL_KEY = "primary";

const INITIAL_HOME: HomeState = {
  spaces: [
    { id: "living-room", name: "Living room", kind: "living", x: 0.2, y: 0.2, width: 4.7, depth: 3.2, color: "#dce8cb" },
    { id: "kitchen", name: "Kitchen", kind: "kitchen", x: 5.15, y: 0.2, width: 3.4, depth: 3.2, color: "#f0d9bd" },
    { id: "bedroom", name: "Bedroom", kind: "bedroom", x: 0.2, y: 3.7, width: 4.1, depth: 3.1, color: "#d7e3ea" },
    { id: "garage", name: "Garage", kind: "garage", x: 4.55, y: 3.7, width: 4, depth: 3.1, color: "#e5d5dc" },
  ],
  items: [
    { id: "item-1", name: "Diwali lights", spaceId: "garage", container: "Blue bin · top shelf", category: "Decor", quantity: 2, note: "Warm white string lights", createdAt: "2026-08-12T10:00:00.000Z" },
    { id: "item-2", name: "Spare batteries", spaceId: "kitchen", container: "Utility drawer", category: "Electronics", quantity: 12, note: "AA and AAA", createdAt: "2026-08-11T10:00:00.000Z" },
    { id: "item-3", name: "Guest bedding", spaceId: "bedroom", container: "Bed storage · left side", category: "Linens", quantity: 1, note: "Queen sheet set and blanket", createdAt: "2026-08-09T10:00:00.000Z" },
    { id: "item-4", name: "Board games", spaceId: "living-room", container: "TV console · lower cabinet", category: "Leisure", quantity: 6, note: "", createdAt: "2026-08-07T10:00:00.000Z" },
  ],
  updatedAt: "2026-08-12T10:00:00.000Z",
};

const SPACE_OPTIONS: Array<{ kind: SpaceKind; label: string; icon: LucideIcon }> = [
  { kind: "living", label: "Living", icon: Sofa },
  { kind: "kitchen", label: "Kitchen", icon: ChefHat },
  { kind: "bedroom", label: "Bedroom", icon: BedDouble },
  { kind: "garage", label: "Garage", icon: Warehouse },
  { kind: "storage", label: "Storage", icon: Archive },
  { kind: "other", label: "Other", icon: Box },
];

const CATEGORIES = ["Everyday", "Decor", "Electronics", "Kitchen", "Linens", "Tools", "Documents", "Leisure"];

function iconForSpace(kind: SpaceKind): LucideIcon {
  return SPACE_OPTIONS.find((option) => option.kind === kind)?.icon ?? Box;
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function openLocalDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(LOCAL_DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(LOCAL_STORE)) request.result.createObjectStore(LOCAL_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadLocalState(): Promise<HomeState | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await openLocalDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(LOCAL_STORE, "readonly").objectStore(LOCAL_STORE).get(LOCAL_KEY);
    request.onsuccess = () => resolve((request.result as HomeState | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

async function saveLocalState(state: HomeState) {
  if (typeof indexedDB === "undefined") return;
  const db = await openLocalDb();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(LOCAL_STORE, "readwrite").objectStore(LOCAL_STORE).put(state, LOCAL_KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function loadImage(source: string) {
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Could not read image"));
    image.src = source;
  });
  return image;
}

async function imageToDataUrl(file: File, max = 1200): Promise<string> {
  const source = URL.createObjectURL(file);
  try {
    const image = await loadImage(source);
    const scale = Math.min(1, max / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image processing is unavailable");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.7);
  } finally {
    URL.revokeObjectURL(source);
  }
}

function waitForMedia(video: HTMLVideoElement, event: "loadedmetadata" | "seeked") {
  return new Promise<void>((resolve, reject) => {
    const done = () => { cleanup(); resolve(); };
    const failed = () => { cleanup(); reject(new Error("The video could not be read")); };
    const cleanup = () => {
      video.removeEventListener(event, done);
      video.removeEventListener("error", failed);
    };
    video.addEventListener(event, done, { once: true });
    video.addEventListener("error", failed, { once: true });
  });
}

async function videoToFrames(file: File): Promise<string[]> {
  const source = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "metadata";
  video.src = source;
  try {
    await waitForMedia(video, "loadedmetadata");
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    if (!duration) throw new Error("The video has no readable duration");
    const moments = [0.08, 0.29, 0.5, 0.71, 0.92].map((point) => Math.min(duration - 0.05, Math.max(0, duration * point)));
    const frames: string[] = [];
    for (const moment of moments) {
      video.currentTime = moment;
      await waitForMedia(video, "seeked");
      const scale = Math.min(1, 1100 / Math.max(video.videoWidth, video.videoHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Video processing is unavailable");
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(canvas.toDataURL("image/jpeg", 0.62));
    }
    return frames;
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(source);
  }
}

async function photosToFrames(files: File[]) {
  return Promise.all(files.slice(0, 6).map((file) => imageToDataUrl(file, 1100)));
}

async function stitchPanorama(files: File[]) {
  const sources = files.map((file) => URL.createObjectURL(file));
  try {
    const images = await Promise.all(sources.map(loadImage));
    const targetHeight = 900;
    const widths = images.map((image) => Math.round(image.width * targetHeight / image.height));
    const overlap = Math.round(Math.min(...widths) * 0.08);
    const canvas = document.createElement("canvas");
    canvas.width = widths.reduce((sum, width) => sum + width, 0) - overlap * (images.length - 1);
    canvas.height = targetHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Panorama processing is unavailable");
    let offset = 0;
    images.forEach((image, index) => {
      context.drawImage(image, offset, 0, widths[index], targetHeight);
      offset += widths[index] - overlap;
    });
    return canvas.toDataURL("image/jpeg", 0.78);
  } finally {
    sources.forEach(URL.revokeObjectURL);
  }
}

async function stitchPanoramaFrames(frames: string[]) {
  const images = await Promise.all(frames.map(loadImage));
  const targetHeight = 720;
  const widths = images.map((image) => Math.round(image.width * targetHeight / image.height));
  const overlap = Math.round(Math.min(...widths) * 0.06);
  const canvas = document.createElement("canvas");
  canvas.width = widths.reduce((sum, width) => sum + width, 0) - overlap * (images.length - 1);
  canvas.height = targetHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Video panorama processing is unavailable");
  let offset = 0;
  images.forEach((image, index) => {
    context.drawImage(image, offset, 0, widths[index], targetHeight);
    offset += widths[index] - overlap;
  });
  return canvas.toDataURL("image/jpeg", 0.72);
}

function formatDay(value: string) {
  const date = new Date(value);
  const today = new Date();
  const difference = Math.floor((today.getTime() - date.getTime()) / 86400000);
  if (difference <= 0) return "Today";
  if (difference === 1) return "Yesterday";
  if (difference < 7) return `${difference} days ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

async function responseMessage(response: Response, fallback: string) {
  try {
    const payload = await response.json() as { message?: string; error?: string };
    return payload.message || payload.error || fallback;
  } catch {
    return fallback;
  }
}

export default function InventoryApp() {
  const [home, setHome] = useState<HomeState>(INITIAL_HOME);
  const [selectedSpaceId, setSelectedSpaceId] = useState("living-room");
  const [query, setQuery] = useState("");
  const [zoom, setZoom] = useState(0.82);
  const [rotation, setRotation] = useState(-42);
  const [is3d, setIs3d] = useState(true);
  const [spaceModal, setSpaceModal] = useState(false);
  const [itemModal, setItemModal] = useState(false);
  const [syncModal, setSyncModal] = useState(false);
  const [scanModal, setScanModal] = useState(false);
  const [scanMode, setScanMode] = useState<ScanMode>("room");
  const [scanStatus, setScanStatus] = useState<"idle" | "preparing" | "analyzing">("idle");
  const [analysis, setAnalysis] = useState<HomeAnalysis | null>(null);
  const [analysisPanorama, setAnalysisPanorama] = useState<string | undefined>();
  const [selectedSuggestions, setSelectedSuggestions] = useState<string[]>([]);
  const [analysisError, setAnalysisError] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraPhotos, setCameraPhotos] = useState<string[]>([]);
  const [interiorView, setInteriorView] = useState(false);
  const [panoramaYaw, setPanoramaYaw] = useState(0);
  const [activeHotspotId, setActiveHotspotId] = useState<string | undefined>();
  const [itemLocation, setItemLocation] = useState("");
  const [pendingPhoto, setPendingPhoto] = useState<string | undefined>();
  const [syncState, setSyncState] = useState<SyncState>("checking");
  const [syncError, setSyncError] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [toast, setToast] = useState("");
  const captureInput = useRef<HTMLInputElement>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const panoramaInput = useRef<HTMLInputElement>(null);
  const panoramaCameraInput = useRef<HTMLInputElement>(null);
  const walkthroughVideoInput = useRef<HTMLInputElement>(null);
  const videoLibraryInput = useRef<HTMLInputElement>(null);
  const cameraPreview = useRef<HTMLVideoElement>(null);
  const cameraStream = useRef<MediaStream | null>(null);
  const panoramaDrag = useRef<{ x: number; yaw: number } | null>(null);
  const cloudEnabled = useRef(false);
  const homeRef = useRef<HomeState>(INITIAL_HOME);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  const selectedSpace = home.spaces.find((space) => space.id === selectedSpaceId) ?? home.spaces[0];
  const selectedItems = home.items.filter((item) => item.spaceId === selectedSpace?.id);
  const activeHotspot = selectedSpace?.hotspots?.find((hotspot) => hotspot.id === activeHotspotId);
  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return home.items.filter((item) => [item.name, item.container, item.category, item.note].some((value) => value.toLowerCase().includes(term))).slice(0, 7);
  }, [home.items, query]);

  const totalStored = home.items.reduce((sum, item) => sum + item.quantity, 0);
  const totalHotspots = home.spaces.reduce((sum, space) => sum + (space.hotspots?.length ?? 0), 0);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }, []);

  useEffect(() => () => {
    cameraStream.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const fetchCloud = useCallback(async () => {
    const response = await fetch("/api/state");
    if (!response.ok) {
      cloudEnabled.current = false;
      setSyncState("local");
      throw new Error(await responseMessage(response, "Cloud sync is unavailable."));
    }
    const payload = await response.json();
    cloudEnabled.current = true;
    setSyncState("cloud");
    return (payload.state as HomeState | null) ?? null;
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const local = await loadLocalState();
        if (local && active) { homeRef.current = local; setHome(local); }
        const cloud = await fetchCloud();
        if (cloud && active) { homeRef.current = cloud; setHome(cloud); }
      } catch {
        if (active) setSyncState("local");
      } finally {
        if (active) setHydrated(true);
      }
    })();
    return () => { active = false; };
  }, [fetchCloud]);

  const saveImmediately = useCallback((state: HomeState) => {
    const syncToCloud = cloudEnabled.current;
    if (syncToCloud) setSyncState("saving");
    saveQueue.current = saveQueue.current.catch(() => undefined).then(async () => {
      await saveLocalState(state);
      if (!syncToCloud) return;
      try {
        const response = await fetch("/api/state", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(state),
        });
        if (!response.ok) throw new Error(await responseMessage(response, "Cloud sync failed."));
        setSyncError("");
        setSyncState("cloud");
      } catch (error) {
        cloudEnabled.current = false;
        setSyncState("error");
        setSyncError(error instanceof Error ? error.message : "Cloud sync failed.");
      }
    });
  }, []);

  function updateHome(updater: (current: HomeState) => HomeState) {
    const next = { ...updater(homeRef.current), updatedAt: new Date().toISOString() };
    homeRef.current = next;
    setHome(next);
    if (hydrated) saveImmediately(next);
  }

  function openScan(mode: ScanMode) {
    setScanMode(mode);
    setAnalysis(null);
    setAnalysisPanorama(undefined);
    setSelectedSuggestions([]);
    setAnalysisError("");
    setCameraPhotos([]);
    setCameraActive(false);
    setScanStatus("idle");
    setScanModal(true);
  }

  function stopCamera() {
    cameraStream.current?.getTracks().forEach((track) => track.stop());
    cameraStream.current = null;
    setCameraActive(false);
  }

  function closeScan() {
    stopCamera();
    setScanModal(false);
  }

  async function startCamera() {
    setAnalysisError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      panoramaCameraInput.current?.click();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      cameraStream.current = stream;
      setCameraPhotos([]);
      setCameraActive(true);
      window.setTimeout(() => {
        if (!cameraPreview.current) return;
        cameraPreview.current.srcObject = stream;
        void cameraPreview.current.play();
      }, 0);
    } catch {
      panoramaCameraInput.current?.click();
    }
  }

  function takeCameraPhoto() {
    const video = cameraPreview.current;
    if (!video?.videoWidth || cameraPhotos.length >= 6) return;
    const scale = Math.min(1, 1100 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    setCameraPhotos((current) => [...current, canvas.toDataURL("image/jpeg", 0.62)]);
  }

  async function finishCameraCapture() {
    if (!cameraPhotos.length) return;
    const photos = [...cameraPhotos];
    stopCamera();
    setScanStatus("preparing");
    try {
      const panorama = scanMode === "room" ? await stitchPanoramaFrames(photos) : undefined;
      await analyzeFrames(photos, panorama);
    } catch {
      setScanStatus("idle");
      setAnalysisError("Those camera pictures could not be processed. Try again with fewer views.");
    }
  }

  async function handleCapture(file?: File) {
    if (!file) return;
    try {
      setPendingPhoto(await imageToDataUrl(file));
      setSpaceModal(true);
    } catch {
      showToast("That photo could not be opened");
    }
  }

  async function analyzeFrames(frames: string[], panorama?: string) {
    if (!frames.length) return;
    setScanStatus("analyzing");
    setAnalysisError("");
    try {
      const response = await fetch("/api/analyze-home", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ images: frames, mode: scanMode, roomName: selectedSpace?.name }),
      });
      const result = await response.json() as HomeAnalysis & { error?: string };
      if (!response.ok) throw new Error(result.error || "The room could not be analyzed");
      setAnalysis(result);
      setAnalysisPanorama(panorama);
      setSelectedSuggestions(result.rooms.flatMap((room, roomIndex) => room.visibleItems.map((item, itemIndex) => `${roomIndex}:${itemIndex}`)));
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : "AI analysis could not finish. Check the OpenAI API key and try again.");
    } finally {
      setScanStatus("idle");
    }
  }

  async function handlePhotoScan(files?: FileList | null) {
    if (!files?.length) return;
    setScanStatus("preparing");
    setAnalysisError("");
    try {
      const selected = Array.from(files).slice(0, 6);
      const frames = await photosToFrames(selected);
      const panorama = scanMode === "room" ? selected.length === 1 ? await imageToDataUrl(selected[0], 2800) : await stitchPanorama(selected) : undefined;
      await analyzeFrames(frames, panorama);
    } catch {
      setScanStatus("idle");
      setAnalysisError("Those photos could not be processed. Try fewer or smaller images.");
    }
  }

  async function handleVideoScan(file?: File) {
    if (!file) return;
    setScanStatus("preparing");
    setAnalysisError("");
    try {
      const frames = await videoToFrames(file);
      await analyzeFrames(frames, scanMode === "room" ? await stitchPanoramaFrames(frames) : undefined);
    } catch {
      setScanStatus("idle");
      setAnalysisError("That video could not be processed. Try a shorter walkthrough or use photos.");
    }
  }

  function toggleSuggestion(id: string) {
    setSelectedSuggestions((current) => current.includes(id) ? current.filter((candidate) => candidate !== id) : [...current, id]);
  }

  function applyAnalysis() {
    if (!analysis?.rooms.length) return;
    const firstRoom = analysis.rooms[0];
    let firstSpaceId = selectedSpace?.id ?? "";
    updateHome((current) => {
      const roomIds = new Map<number, string>();
      let spaces = [...current.spaces];
      if (scanMode === "room" && selectedSpace) {
        firstSpaceId = selectedSpace.id;
        roomIds.set(0, selectedSpace.id);
        spaces = spaces.map((space) => space.id === selectedSpace.id ? {
          ...space,
          name: firstRoom.name || space.name,
          kind: firstRoom.kind,
          width: firstRoom.width,
          depth: firstRoom.depth,
          photo: analysisPanorama || space.photo,
          panorama: analysisPanorama || space.panorama,
          hotspots: firstRoom.storageSpaces.map((storage) => ({ id: uid("hotspot"), label: storage.label, x: storage.x, y: storage.y, confidence: storage.confidence })),
        } : space);
      } else {
        analysis.rooms.forEach((room, index) => {
          const existingIndex = spaces.findIndex((space) => space.name.toLowerCase() === room.name.toLowerCase());
          if (existingIndex >= 0) {
            roomIds.set(index, spaces[existingIndex].id);
            spaces[existingIndex] = {
              ...spaces[existingIndex],
              kind: room.kind,
              x: room.x,
              y: room.y,
              width: room.width,
              depth: room.depth,
              hotspots: room.storageSpaces.map((storage) => ({ id: uid("hotspot"), label: storage.label, x: storage.x, y: storage.y, confidence: storage.confidence })),
            };
          } else {
            const id = uid("space");
            roomIds.set(index, id);
            spaces.push({
              id,
              name: room.name,
              kind: room.kind,
              x: room.x,
              y: room.y,
              width: room.width,
              depth: room.depth,
              color: COLORS[spaces.length % COLORS.length],
              hotspots: room.storageSpaces.map((storage) => ({ id: uid("hotspot"), label: storage.label, x: storage.x, y: storage.y, confidence: storage.confidence })),
            });
          }
        });
        firstSpaceId = roomIds.get(0) ?? firstSpaceId;
      }

      const suggestions = analysis.rooms.flatMap((room, roomIndex) => room.visibleItems
        .filter((item, itemIndex) => selectedSuggestions.includes(`${roomIndex}:${itemIndex}`))
        .map((item) => ({ roomIndex, item })));
      const additions = suggestions.flatMap(({ roomIndex, item }) => {
        const spaceId = scanMode === "room" ? selectedSpace?.id : roomIds.get(roomIndex);
        if (!spaceId || current.items.some((existing) => existing.spaceId === spaceId && existing.name.toLowerCase() === item.name.toLowerCase())) return [];
        return [{
          id: uid("item"),
          name: item.name,
          spaceId,
          container: item.suggestedStorage || "In this room",
          category: item.category || "Everyday",
          quantity: item.quantity,
          note: "Suggested from room scan",
          createdAt: new Date().toISOString(),
        }];
      });
      return { ...current, spaces, items: [...additions, ...current.items] };
    });
    setSelectedSpaceId(firstSpaceId);
    setScanModal(false);
    setInteriorView(scanMode === "room" && Boolean(analysisPanorama));
    setPanoramaYaw(0);
    showToast(`${analysis.rooms.length} ${analysis.rooms.length === 1 ? "room" : "rooms"} mapped · ${selectedSuggestions.length} items remembered`);
  }

  function renameHotspot(hotspot: StorageHotspot) {
    const label = window.prompt("Name this storage space", hotspot.label)?.trim();
    if (!label || !selectedSpace) return;
    updateHome((current) => ({
      ...current,
      spaces: current.spaces.map((space) => space.id === selectedSpace.id ? { ...space, hotspots: space.hotspots?.map((candidate) => candidate.id === hotspot.id ? { ...candidate, label } : candidate) } : space),
    }));
  }

  function addHotspot() {
    if (!selectedSpace) return;
    const label = window.prompt("Name the storage space", "Storage area")?.trim();
    if (!label) return;
    const hotspot: StorageHotspot = {
      id: uid("hotspot"),
      label,
      x: Math.min(96, Math.max(4, panoramaYaw * 0.444 + 27.8)),
      y: 52,
      confidence: 1,
    };
    updateHome((current) => ({
      ...current,
      spaces: current.spaces.map((space) => space.id === selectedSpace.id ? { ...space, hotspots: [...(space.hotspots ?? []), hotspot] } : space),
    }));
    setActiveHotspotId(hotspot.id);
  }

  function openItemAt(location = "") {
    setItemLocation(location);
    setItemModal(true);
  }

  function movePanorama(event: PointerEvent<HTMLDivElement>) {
    if (!panoramaDrag.current) return;
    const distance = (event.clientX - panoramaDrag.current.x) / Math.max(1, event.currentTarget.clientWidth);
    setPanoramaYaw(Math.max(0, Math.min(100, panoramaDrag.current.yaw - distance * 100)));
  }

  function addSpace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const kind = String(form.get("kind") ?? "other") as SpaceKind;
    if (!name) return;
    const index = home.spaces.length;
    const space: Space = {
      id: uid("space"),
      name,
      kind,
      x: (index % 2) * 4.35 + 0.2,
      y: Math.floor(index / 2) * 3.45 + 0.2,
      width: 4.05,
      depth: 3.15,
      color: COLORS[index % COLORS.length],
      photo: pendingPhoto,
    };
    updateHome((current) => ({ ...current, spaces: [...current.spaces, space] }));
    setSelectedSpaceId(space.id);
    setSpaceModal(false);
    setPendingPhoto(undefined);
    showToast(`${name} added to your home`);
  }

  function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSpace) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    if (!name) return;
    const item: InventoryItem = {
      id: uid("item"),
      name,
      spaceId: selectedSpace.id,
      container: String(form.get("container") ?? "").trim() || "In this room",
      category: String(form.get("category") ?? "Everyday"),
      quantity: Math.max(1, Number(form.get("quantity") ?? 1)),
      note: String(form.get("note") ?? "").trim(),
      createdAt: new Date().toISOString(),
    };
    updateHome((current) => ({ ...current, items: [item, ...current.items] }));
    setItemModal(false);
    setItemLocation("");
    showToast(`${name} remembered`);
  }

  function deleteItem(id: string) {
    updateHome((current) => ({ ...current, items: current.items.filter((item) => item.id !== id) }));
    showToast("Item removed");
  }

  function deleteSpace() {
    if (!selectedSpace || !window.confirm(`Remove ${selectedSpace.name} and its inventory?`)) return;
    updateHome((current) => ({
      ...current,
      spaces: current.spaces.filter((space) => space.id !== selectedSpace.id),
      items: current.items.filter((item) => item.spaceId !== selectedSpace.id),
    }));
    setSelectedSpaceId(home.spaces.find((space) => space.id !== selectedSpace.id)?.id ?? "");
    showToast("Space removed");
  }

  function chooseResult(item: InventoryItem) {
    setSelectedSpaceId(item.spaceId);
    setQuery("");
    const space = home.spaces.find((candidate) => candidate.id === item.spaceId);
    showToast(`${item.name} · ${space?.name}, ${item.container}`);
  }

  async function connectCloud() {
    setSyncState("checking");
    setSyncError("");
    try {
      const cloud = await fetchCloud();
      if (cloud) {
        homeRef.current = cloud;
        setHome(cloud);
        setSyncModal(false);
        showToast("Synced from your home cloud");
      } else {
        const response = await fetch("/api/state", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(homeRef.current),
        });
        if (!response.ok) throw new Error(await responseMessage(response, "Cloud sync could not be connected."));
        cloudEnabled.current = true;
        setSyncState("cloud");
        setSyncModal(false);
        showToast("Cloud sync connected");
      }
    } catch (error) {
      setSyncState("error");
      setSyncError(error instanceof Error ? error.message : "Cloud sync could not be connected.");
      showToast("Cloud sync needs attention");
    }
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify(home, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `nook-home-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast("Backup downloaded");
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  }

  async function importBackup(file?: File) {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text()) as HomeState;
      if (!Array.isArray(data.spaces) || !Array.isArray(data.items)) throw new Error("Invalid backup");
      setHome({ ...data, updatedAt: new Date().toISOString() });
      setSelectedSpaceId(data.spaces[0]?.id ?? "");
      showToast("Backup restored");
    } catch {
      showToast("That file is not a Nook backup");
    }
  }

  const recentItems = [...home.items].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><NextImage src="/nook-mark.svg" alt="" width={36} height={36} priority /></span><span>Nook</span></div>
        <nav className="side-nav" aria-label="Main navigation">
          <button className="nav-item active"><Home size={19} /><span>My home</span></button>
          <button className="nav-item" onClick={() => document.getElementById("recent")?.scrollIntoView({ behavior: "smooth" })}><Package size={19} /><span>All items</span><span className="nav-count">{home.items.length}</span></button>
          <button className="nav-item" onClick={() => setSpaceModal(true)}><Grid2X2 size={19} /><span>Spaces</span><span className="nav-count">{home.spaces.length}</span></button>
        </nav>
        <div className="sidebar-spaces">
          <p className="eyebrow">Your spaces</p>
          {home.spaces.slice(0, 5).map((space) => {
            const Icon = iconForSpace(space.kind);
            return <button key={space.id} className={`space-link ${selectedSpaceId === space.id ? "selected" : ""}`} onClick={() => setSelectedSpaceId(space.id)}><span style={{ background: space.color }}><Icon size={15} /></span><b>{space.name}</b><small>{home.items.filter((item) => item.spaceId === space.id).length}</small></button>;
          })}
        </div>
        <div className="privacy-card"><ShieldCheck size={20} /><div><strong>Private by design</strong><p>Your home data stays behind your login.</p></div></div>
        <button className="nav-item settings-button" onClick={() => setSyncModal(true)}><Settings size={18} /><span>Sync & backup</span></button>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="mobile-brand brand"><span className="brand-mark"><NextImage src="/nook-mark.svg" alt="" width={36} height={36} priority /></span><span>Nook</span></div>
          <div className="search-wrap">
            <Search size={18} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find anything in your home…" aria-label="Search inventory" />
            <kbd>⌘ K</kbd>
            {query && <button className="clear-search" onClick={() => setQuery("")} aria-label="Clear search"><X size={15} /></button>}
            {query && <div className="search-results">
              <div className="results-heading">{results.length ? `${results.length} places found` : "No match yet"}</div>
              {results.map((item) => {
                const space = home.spaces.find((candidate) => candidate.id === item.spaceId);
                return <button key={item.id} onClick={() => chooseResult(item)}><span className="result-icon"><Package size={17} /></span><span><strong>{item.name}</strong><small>{space?.name} · {item.container}</small></span><ChevronRight size={16} /></button>;
              })}
              {!results.length && <p className="empty-search">Try an item, category, or container name.</p>}
            </div>}
          </div>
          <button className={`sync-pill ${syncState}`} onClick={() => setSyncModal(true)}>
            {syncState === "cloud" ? <Cloud size={16} /> : syncState === "saving" || syncState === "checking" ? <RefreshCw className="spin" size={16} /> : <CloudOff size={16} />}
            <span>{syncState === "cloud" ? "Synced" : syncState === "saving" ? "Saving" : "On this device"}</span>
          </button>
          <button className="avatar" onClick={() => void signOut()} aria-label="Sign out" title="Sign out"><LogOut size={16} /></button>
        </header>

        <div className="content-scroll">
          <section className="welcome-row">
            <div><p className="eyebrow soft">Nook Home</p><h1>Your home, remembered.</h1><p>Move through every room. Find anything. Forget nothing.</p></div>
            <div className="welcome-actions">
              <button className="secondary-button" onClick={() => setSpaceModal(true)}><Plus size={17} /> Add space</button>
              <button className="secondary-button" onClick={() => openScan("floor-plan")}><Grid2X2 size={17} /> Build floor plan</button>
              <button className="primary-button" onClick={() => openScan("room")}><ScanLine size={18} /> Scan room</button>
              <input ref={captureInput} className="sr-only" type="file" accept="image/*" capture="environment" onChange={(event) => void handleCapture(event.target.files?.[0])} />
            </div>
          </section>

          <section className="stats-row" aria-label="Inventory summary">
            <div><span className="stat-icon lime"><MapPin size={18} /></span><p><strong>{home.spaces.length}</strong><small>mapped spaces</small></p></div>
            <div><span className="stat-icon blue"><Package size={18} /></span><p><strong>{totalStored}</strong><small>things remembered</small></p></div>
            <div><span className="stat-icon peach"><ScanLine size={18} /></span><p><strong>{totalHotspots}</strong><small>storage spaces found</small></p></div>
          </section>

          <section className="map-workspace">
            <div className="map-panel">
              <div className="panel-heading">
                <div><p className="eyebrow">{interiorView ? "Immersive room replica" : "Spatial home"}</p><h2>{interiorView ? selectedSpace?.name : "Home"}</h2></div>
                {interiorView ? <button className="back-map-button" onClick={() => setInteriorView(false)}><ChevronLeft size={15} /> All rooms</button> : <div className="view-toggle" role="group" aria-label="Map view">
                  <button className={!is3d ? "active" : ""} onClick={() => setIs3d(false)}>2D</button>
                  <button className={is3d ? "active" : ""} onClick={() => setIs3d(true)}><Rotate3D size={14} /> 3D</button>
                </div>}
              </div>

              <div className="map-stage">
                {interiorView && selectedSpace?.panorama ? <div className="panorama-shell">
                  <div
                    className="panorama-viewport"
                    role="slider"
                    tabIndex={0}
                    aria-label={`Panoramic view of ${selectedSpace.name}. Drag or use arrow keys to look around.`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(panoramaYaw)}
                    onPointerDown={(event) => { panoramaDrag.current = { x: event.clientX, yaw: panoramaYaw }; event.currentTarget.setPointerCapture(event.pointerId); }}
                    onPointerMove={movePanorama}
                    onPointerUp={() => { panoramaDrag.current = null; }}
                    onPointerCancel={() => { panoramaDrag.current = null; }}
                    onKeyDown={(event) => { if (event.key === "ArrowLeft") setPanoramaYaw((value) => Math.max(0, value - 5)); if (event.key === "ArrowRight") setPanoramaYaw((value) => Math.min(100, value + 5)); }}
                  >
                    <div className="panorama-strip" style={{ backgroundImage: `url(${selectedSpace.panorama})`, transform: `translateX(-${panoramaYaw * 0.444}%)` }}>
                      {selectedSpace.hotspots?.map((hotspot, index) => <button
                        key={hotspot.id}
                        className={`storage-hotspot ${activeHotspotId === hotspot.id ? "active" : ""}`}
                        style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%` }}
                        onClick={() => setActiveHotspotId(hotspot.id)}
                        aria-label={`${hotspot.label}, storage space ${index + 1}`}
                      ><span>{index + 1}</span><strong>{hotspot.label}</strong></button>)}
                    </div>
                    <div className="panorama-vignette" />
                  </div>
                  <div className="panorama-toolbar"><span><Rotate3D size={16} /> Drag to look around</span><span><ScanLine size={16} /> {selectedSpace.hotspots?.length ?? 0} storage spaces identified</span><button onClick={addHotspot}><Plus size={14} /> Add missing space</button></div>
                </div> : <>
                  <div className="map-grid" />
                  <div className={`home-model ${is3d ? "is-3d" : "is-2d"}`} style={{ "--zoom": zoom, "--rotation": `${rotation}deg` } as CSSProperties}>
                    {home.spaces.map((space) => {
                      const Icon = iconForSpace(space.kind);
                      const count = home.items.filter((item) => item.spaceId === space.id).length;
                      const style = {
                        left: `${space.x * 72}px`, top: `${space.y * 72}px`, width: `${space.width * 72}px`, height: `${space.depth * 72}px`,
                        "--room-color": space.color,
                        ...(space.photo ? { backgroundImage: `linear-gradient(rgba(20,35,30,.16), rgba(20,35,30,.16)), url(${space.photo})` } : {}),
                      } as CSSProperties;
                      return <button key={space.id} className={`room-block ${selectedSpaceId === space.id ? "active" : ""} ${space.photo ? "has-photo" : ""}`} style={style} onClick={() => { setSelectedSpaceId(space.id); setInteriorView(false); }} aria-label={`Open ${space.name}`}>
                        <span className="room-wall wall-right" /><span className="room-wall wall-bottom" />
                        <span className="room-content"><span className="room-icon"><Icon size={19} /></span><strong>{space.name}</strong><small>{space.panorama ? `${space.hotspots?.length ?? 0} mapped storage spaces` : `${count} ${count === 1 ? "item" : "items"}`}</small></span>
                        {space.panorama ? <span className="scan-badge"><ScanLine size={12} /> Mapped</span> : count > 0 && <span className="map-pin">{count}</span>}
                      </button>;
                    })}
                  </div>
                  {!home.spaces.length && <div className="empty-map"><Home size={30} /><strong>Start with your first room</strong><button onClick={() => setSpaceModal(true)}>Add a space</button></div>}
                  <div className="map-hint"><Focus size={14} /> Select a room to explore it</div>
                  <div className="map-controls">
                    <button onClick={() => setZoom((value) => Math.min(1.08, value + 0.08))} aria-label="Zoom in"><Plus size={17} /></button>
                    <button onClick={() => setZoom((value) => Math.max(0.58, value - 0.08))} aria-label="Zoom out"><Minus size={17} /></button>
                    <button onClick={() => { setZoom(0.82); setRotation(-42); }} aria-label="Reset map"><Focus size={17} /></button>
                  </div>
                  {is3d && <label className="rotate-control"><Rotate3D size={15} /><input type="range" min="-65" max="-20" value={rotation} onChange={(event) => setRotation(Number(event.target.value))} aria-label="Rotate home map" /></label>}
                </>}
              </div>
            </div>

            {selectedSpace ? <aside className="room-panel">
              <div className="room-cover" style={{ backgroundColor: selectedSpace.color, ...(selectedSpace.photo ? { backgroundImage: `url(${selectedSpace.photo})` } : {}) }}>
                <button className="photo-button" onClick={() => openScan("room")}><ScanLine size={15} /> {selectedSpace.panorama ? "Rescan" : "Scan room"}</button>
                {selectedSpace.panorama && <button className="enter-room-button" onClick={() => { setInteriorView(true); setPanoramaYaw(0); }}><Rotate3D size={15} /> Enter room</button>}
                {!selectedSpace.photo && <div className="cover-illustration">{(() => { const Icon = iconForSpace(selectedSpace.kind); return <Icon size={54} />; })()}</div>}
              </div>
              <div className="room-panel-body">
                <div className="room-title-row"><div><p className="eyebrow">Selected space</p><h3>{selectedSpace.name}</h3></div><button className="icon-button danger" onClick={deleteSpace} aria-label={`Delete ${selectedSpace.name}`}><Trash2 size={16} /></button></div>
                <div className="room-summary"><span><Package size={15} /> {selectedItems.length} records</span><span><Box size={15} /> {selectedItems.reduce((sum, item) => sum + item.quantity, 0)} things</span></div>
                {selectedSpace.hotspots?.length ? <div className="hotspot-list">
                  <div className="list-label"><span>Storage spaces</span><small>{selectedSpace.hotspots.length}</small></div>
                  {selectedSpace.hotspots.map((hotspot, index) => <button key={hotspot.id} className={activeHotspotId === hotspot.id ? "active" : ""} onClick={() => { setActiveHotspotId(hotspot.id); setInteriorView(true); }} onDoubleClick={() => renameHotspot(hotspot)}><span>{index + 1}</span><b>{hotspot.label}</b><small>{Math.round(hotspot.confidence * 100)}%</small></button>)}
                </div> : null}
                {activeHotspot && <div className="active-storage"><span><MapPin size={15} /></span><div><strong>{activeHotspot.label}</strong><small>Selected storage space</small></div><div><button onClick={() => renameHotspot(activeHotspot)}>Rename</button><button onClick={() => openItemAt(activeHotspot.label)}>Add item</button></div></div>}
                <button className="remember-button" onClick={() => openItemAt()}><Plus size={18} /><span><strong>Remember something here</strong><small>Add the precise cabinet, shelf, or drawer</small></span></button>
                <div className="stored-list">
                  <div className="list-label"><span>Stored here</span><small>{selectedItems.length}</small></div>
                  {selectedItems.slice(0, 5).map((item) => <div className="stored-item" key={item.id}>
                    <span className="item-glyph"><Package size={17} /></span>
                    <div><strong>{item.name}</strong><small>{item.container}{item.quantity > 1 ? ` · ×${item.quantity}` : ""}</small></div>
                    <button onClick={() => deleteItem(item.id)} aria-label={`Remove ${item.name}`}><X size={14} /></button>
                  </div>)}
                  {!selectedItems.length && <div className="empty-room"><Box size={22} /><p>Nothing remembered here yet.</p></div>}
                </div>
              </div>
            </aside> : <aside className="room-panel empty-selection"><Home size={28} /><h3>Add your first space</h3><button className="primary-button" onClick={() => setSpaceModal(true)}>Get started</button></aside>}
          </section>

          <section className="recent-section" id="recent">
            <div className="section-heading"><div><p className="eyebrow">Home activity</p><h2>Recently remembered</h2></div><button onClick={() => setQuery(" ")}>View all <ChevronRight size={16} /></button></div>
            <div className="recent-grid">
              {recentItems.map((item) => {
                const space = home.spaces.find((candidate) => candidate.id === item.spaceId);
                const Icon = iconForSpace(space?.kind ?? "other");
                return <button key={item.id} className="recent-card" onClick={() => setSelectedSpaceId(item.spaceId)}>
                  <span className="recent-visual" style={{ background: space?.color }}><Icon size={28} /></span>
                  <span><strong>{item.name}</strong><small><MapPin size={13} /> {space?.name} · {item.container}</small></span>
                  <time>{formatDay(item.createdAt)}</time>
                </button>;
              })}
            </div>
          </section>
        </div>
      </main>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        <button className="active"><Home size={20} /><span>Home</span></button>
        <button onClick={() => setQuery(" ")}><Search size={20} /><span>Find</span></button>
        <button className="capture-fab" onClick={() => openScan("room")} aria-label="Scan room"><ScanLine size={23} /></button>
        <button onClick={() => setSpaceModal(true)}><Grid2X2 size={20} /><span>Spaces</span></button>
        <button onClick={() => setSyncModal(true)}><Settings size={20} /><span>Settings</span></button>
      </nav>

      {spaceModal && <div className="modal-backdrop">
        <div className="modal-card">
          <button className="modal-close" onClick={() => setSpaceModal(false)} aria-label="Close"><X size={18} /></button>
          <div className="modal-icon"><MapPin size={22} /></div><p className="eyebrow">Map your home</p><h2>Add a space</h2><p className="modal-intro">Name the room or storage area. You can photograph it now or anytime later.</p>
          {pendingPhoto && <div className="photo-preview" style={{ backgroundImage: `url(${pendingPhoto})` }}><span><Check size={14} /> Photo ready</span></div>}
          <form onSubmit={addSpace}>
            <label><span>Space name</span><input name="name" placeholder="e.g. Hallway cupboard" required /></label>
            <fieldset><legend>What kind of space?</legend><div className="kind-grid">{SPACE_OPTIONS.map(({ kind, label, icon: Icon }, index) => <label key={kind}><input type="radio" name="kind" value={kind} defaultChecked={index === 0} /><span><Icon size={18} />{label}</span></label>)}</div></fieldset>
            <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => captureInput.current?.click()}><Camera size={17} /> Take photo</button><button className="primary-button" type="submit">Add to map <ChevronRight size={17} /></button></div>
          </form>
        </div>
      </div>}

      {scanModal && <div className="modal-backdrop">
        <div className="modal-card scan-card">
          <button className="modal-close" onClick={closeScan} aria-label="Close"><X size={18} /></button>
          {analysis ? <>
            <div className="analysis-heading"><span><Sparkles size={20} /></span><div><p className="eyebrow">Ready to review</p><h2>Nook found {analysis.rooms.length} {analysis.rooms.length === 1 ? "room" : "rooms"}.</h2></div></div>
            <p className="modal-intro analysis-summary">{analysis.summary}</p>
            <div className="analysis-rooms">
              {analysis.rooms.map((room, roomIndex) => {
                const Icon = iconForSpace(room.kind);
                return <section className="analysis-room" key={`${room.name}-${roomIndex}`}>
                  <div className="analysis-room-title"><span style={{ background: COLORS[roomIndex % COLORS.length] }}><Icon size={18} /></span><div><strong>{room.name}</strong><small>{Math.round(room.confidence * 100)}% room confidence · {room.storageSpaces.length} storage spaces</small></div></div>
                  {room.storageSpaces.length > 0 && <div className="analysis-storage">{room.storageSpaces.map((storage, index) => <span key={`${storage.label}-${index}`}><Archive size={12} /> {storage.label}</span>)}</div>}
                  {room.visibleItems.length > 0 && <div className="analysis-items"><p>Select the things to remember</p>{room.visibleItems.map((item, itemIndex) => {
                    const id = `${roomIndex}:${itemIndex}`;
                    const checked = selectedSuggestions.includes(id);
                    return <button key={id} className={checked ? "selected" : ""} onClick={() => toggleSuggestion(id)}><span className="analysis-check">{checked && <Check size={13} />}</span><span><strong>{item.name}{item.quantity > 1 ? ` · ×${item.quantity}` : ""}</strong><small>{item.suggestedStorage}</small></span><em>{Math.round(item.confidence * 100)}%</em></button>;
                  })}</div>}
                </section>;
              })}
            </div>
            <div className="analysis-actions"><button className="secondary-button" onClick={() => { setAnalysis(null); setSelectedSuggestions([]); }}>Scan again</button><button className="primary-button" onClick={applyAnalysis}><Check size={17} /> {scanMode === "floor-plan" ? "Add to floor plan" : "Apply room scan"}</button></div>
            <p className="privacy-note"><ShieldCheck size={15} /> AI suggestions can be wrong. Unselect anything you do not want to save.</p>
          </> : cameraActive ? <>
            <p className="eyebrow camera-eyebrow">Live camera · {scanMode === "floor-plan" ? "floor plan" : "room scan"}</p>
            <h2 className="camera-title">Capture every useful angle.</h2>
            <p className="modal-intro camera-intro">Move slowly and keep storage spaces in frame. Take up to six pictures, then let Nook identify what is there.</p>
            <div className="live-camera"><video ref={cameraPreview} autoPlay muted playsInline /><div className="camera-count">{cameraPhotos.length} / 6</div><button className="shutter-button" onClick={takeCameraPhoto} disabled={cameraPhotos.length >= 6} aria-label="Take picture"><span /></button></div>
            {cameraPhotos.length > 0 && <div className="camera-filmstrip">{cameraPhotos.map((photo, index) => <button key={`${photo.slice(-18)}-${index}`} onClick={() => setCameraPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index))} aria-label={`Remove picture ${index + 1}`} style={{ backgroundImage: `url(${photo})` }}><X size={13} /></button>)}</div>}
            <div className="camera-actions"><button className="secondary-button" onClick={stopCamera}>Cancel</button><button className="primary-button" disabled={!cameraPhotos.length} onClick={() => void finishCameraCapture()}><Sparkles size={17} /> Analyze {cameraPhotos.length || ""} {cameraPhotos.length === 1 ? "picture" : "pictures"}</button></div>
          </> : <>
            <div className="scan-mode-toggle" role="group" aria-label="Capture type"><button className={scanMode === "room" ? "active" : ""} onClick={() => setScanMode("room")}><ScanLine size={15} /> One room</button><button className={scanMode === "floor-plan" ? "active" : ""} onClick={() => setScanMode("floor-plan")}><Grid2X2 size={15} /> Floor plan</button></div>
            <div className="scan-orb">{scanMode === "floor-plan" ? <Grid2X2 size={28} /> : <ScanLine size={27} />}</div>
            <p className="eyebrow">{scanMode === "floor-plan" ? "Home walkthrough" : `Spatial capture${selectedSpace ? ` · ${selectedSpace.name}` : ""}`}</p>
            <h2>{scanMode === "floor-plan" ? "Build your floor plan from a walkthrough." : "Turn this room into a place you can revisit."}</h2>
            <p className="modal-intro">{scanMode === "floor-plan" ? "Walk slowly through connected rooms or choose clear photos. Nook will propose rooms, storage, visible items, and an approximate layout." : "Take photos directly with your camera, choose a panorama, or record a slow room video. Nook will name the room, storage spaces, and visible things."}</p>
            <div className="scan-preview-card"><div className="scan-arc"><span /><span /><span /></div><div><strong>OpenAI vision, with your review</strong><small>Compressed frames are sent securely for analysis. Nothing is added until you approve the result.</small></div></div>
            {scanStatus !== "idle" ? <div className="scan-processing"><span className="scan-pulse">{scanStatus === "preparing" ? <Film size={24} /> : <Sparkles size={24} />}</span><strong>{scanStatus === "preparing" ? "Preparing your capture…" : "Understanding your home…"}</strong><small>{scanStatus === "preparing" ? "Compressing photos and sampling video frames" : "Naming rooms, storage spaces, and visible things"}</small></div> : <div className="scan-actions capture-grid">
              <button className="primary-button" onClick={() => void startCamera()}><Camera size={19} /><span><strong>Take pictures</strong><small>Open the camera now</small></span></button>
              <button className="secondary-button" onClick={() => walkthroughVideoInput.current?.click()}><Film size={19} /><span><strong>Record walkthrough</strong><small>Slowly pan across the room</small></span></button>
              <button className="secondary-button" onClick={() => panoramaInput.current?.click()}><Images size={19} /><span><strong>Choose photos</strong><small>Select up to 6 clear views</small></span></button>
              <button className="secondary-button" onClick={() => videoLibraryInput.current?.click()}><Upload size={19} /><span><strong>Choose video</strong><small>Use an existing walkthrough</small></span></button>
            </div>}
            {analysisError && <p className="scan-error">{analysisError}</p>}
            <input ref={panoramaInput} className="sr-only" type="file" accept="image/*" multiple onChange={(event) => void handlePhotoScan(event.target.files)} />
            <input ref={panoramaCameraInput} className="sr-only" type="file" accept="image/*" capture="environment" multiple onChange={(event) => void handlePhotoScan(event.target.files)} />
            <input ref={walkthroughVideoInput} className="sr-only" type="file" accept="video/*" capture="environment" onChange={(event) => void handleVideoScan(event.target.files?.[0])} />
            <input ref={videoLibraryInput} className="sr-only" type="file" accept="video/*" onChange={(event) => void handleVideoScan(event.target.files?.[0])} />
            <p className="privacy-note"><ShieldCheck size={15} /> Floor plans are visual estimates, not architectural measurements.</p>
          </>}
        </div>
      </div>}

      {itemModal && selectedSpace && <ItemModal space={selectedSpace} defaultContainer={itemLocation} onClose={() => { setItemModal(false); setItemLocation(""); }} onSubmit={addItem} />}

      {syncModal && <div className="modal-backdrop">
        <div className="modal-card sync-card">
          <button className="modal-close" onClick={() => setSyncModal(false)} aria-label="Close"><X size={18} /></button>
          <div className="modal-icon"><Cloud size={22} /></div><p className="eyebrow">Phone + laptop</p><h2>Cloud sync</h2><p className="modal-intro">Connect the private Neon database attached to this Vercel deployment. Your signed-in session protects every sync request.</p>
          <div className={`sync-status-card ${syncState}`}><span>{syncState === "cloud" ? <Check size={18} /> : <CloudOff size={18} />}</span><div><strong>{syncState === "cloud" ? "Your home is synced" : "Working on this device"}</strong><small>{syncState === "cloud" ? "Changes save automatically" : "Your inventory is still safely available offline"}</small></div></div>
          {syncError && <div className="sync-error"><strong>Cloud setup needs attention</strong><p>{syncError}</p><small>In Vercel, open Project Settings - Environment Variables. Confirm DATABASE_URL is enabled for Production, then redeploy.</small></div>}
          <button className="primary-button full" type="button" onClick={() => void connectCloud()}><RefreshCw size={17} /> Connect & sync</button>
          <div className="backup-row"><button onClick={exportBackup}><Download size={17} /><span><strong>Download backup</strong><small>Save a copy as JSON</small></span></button><button onClick={() => importInput.current?.click()}><Upload size={17} /><span><strong>Restore backup</strong><small>Import on another device</small></span></button></div>
          <input ref={importInput} className="sr-only" type="file" accept="application/json" onChange={(event) => void importBackup(event.target.files?.[0])} />
          <p className="privacy-note"><ShieldCheck size={15} /> Photos are compressed before saving to keep free-tier storage light.</p>
        </div>
      </div>}

      {toast && <div className="toast"><Check size={16} /> {toast}</div>}
    </div>
  );
}

function ItemModal({ space, defaultContainer, onClose, onSubmit }: { space: Space; defaultContainer: string; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const [listening, setListening] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null);

  function listen() {
    type Recognition = { lang: string; interimResults: boolean; start: () => void; onresult: (event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void; onend: () => void };
    const SpeechRecognition = (window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }).SpeechRecognition
      ?? (window as unknown as { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      nameInput.current?.focus();
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.onresult = (event) => { if (nameInput.current) nameInput.current.value = event.results[0][0].transcript; };
    recognition.onend = () => setListening(false);
    setListening(true);
    recognition.start();
  }

  return <div className="modal-backdrop">
    <div className="modal-card">
      <button className="modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
      <div className="modal-icon"><Package size={22} /></div><p className="eyebrow">Save to {space.name}</p><h2>What are you keeping here?</h2><p className="modal-intro">Say it out loud or type it in. Add a precise shelf, drawer, or container so it is effortless to find later.</p>
      <form onSubmit={onSubmit}>
        <label><span>Item name</span><div className="voice-input"><input ref={nameInput} name="name" placeholder="e.g. Winter blankets" required /><button type="button" className={listening ? "listening" : ""} onClick={listen} aria-label="Speak item name"><Mic size={18} /></button></div></label>
        {listening && <div className="listening-note"><span /> Listening… tell Nook what you are storing</div>}
        <label><span>Exactly where?</span><input name="container" defaultValue={defaultContainer} placeholder="e.g. Top shelf, green basket" required /></label>
        <div className="form-row"><label><span>Category</span><select name="category">{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label><label className="quantity-field"><span>Quantity</span><input name="quantity" type="number" min="1" defaultValue="1" /></label></div>
        <label><span>Helpful note <small>optional</small></span><textarea name="note" placeholder="Size, colour, who it belongs to…" rows={2} /></label>
        <button className="primary-button full" type="submit"><Sparkles size={17} /> Remember this place</button>
      </form>
    </div>
  </div>;
}
