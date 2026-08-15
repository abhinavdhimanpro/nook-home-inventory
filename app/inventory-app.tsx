"use client";

import {
  Archive,
  BedDouble,
  Box,
  Camera,
  Check,
  ChevronRight,
  ChefHat,
  Cloud,
  CloudOff,
  Download,
  Focus,
  Warehouse,
  Grid2X2,
  Home,
  Layers3,
  LogOut,
  MapPin,
  Mic,
  Minus,
  Package,
  Plus,
  RefreshCw,
  Rotate3D,
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
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";

type SpaceKind = "living" | "kitchen" | "bedroom" | "garage" | "storage" | "other";

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

async function imageToDataUrl(file: File): Promise<string> {
  const source = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Could not read image"));
      image.src = source;
    });
    const max = 1200;
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

function formatDay(value: string) {
  const date = new Date(value);
  const today = new Date();
  const difference = Math.floor((today.getTime() - date.getTime()) / 86400000);
  if (difference <= 0) return "Today";
  if (difference === 1) return "Yesterday";
  if (difference < 7) return `${difference} days ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
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
  const [pendingPhoto, setPendingPhoto] = useState<string | undefined>();
  const [syncState, setSyncState] = useState<SyncState>("checking");
  const [hydrated, setHydrated] = useState(false);
  const [toast, setToast] = useState("");
  const captureInput = useRef<HTMLInputElement>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const roomPhotoInput = useRef<HTMLInputElement>(null);
  const cloudEnabled = useRef(false);

  const selectedSpace = home.spaces.find((space) => space.id === selectedSpaceId) ?? home.spaces[0];
  const selectedItems = home.items.filter((item) => item.spaceId === selectedSpace?.id);
  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return home.items.filter((item) => [item.name, item.container, item.category, item.note].some((value) => value.toLowerCase().includes(term))).slice(0, 7);
  }, [home.items, query]);

  const totalStored = home.items.reduce((sum, item) => sum + item.quantity, 0);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }, []);

  const fetchCloud = useCallback(async () => {
    const response = await fetch("/api/state");
    if (!response.ok) {
      cloudEnabled.current = false;
      setSyncState("local");
      return null;
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
        if (local && active) setHome(local);
        const cloud = await fetchCloud();
        if (cloud && active) setHome(cloud);
      } catch {
        if (active) setSyncState("local");
      } finally {
        if (active) setHydrated(true);
      }
    })();
    return () => { active = false; };
  }, [fetchCloud]);

  useEffect(() => {
    if (!hydrated) return;
    void saveLocalState(home);
    if (!cloudEnabled.current) return;
    const timer = window.setTimeout(async () => {
      try {
        setSyncState("saving");
        const response = await fetch("/api/state", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(home),
        });
        if (!response.ok) { cloudEnabled.current = false; setSyncState("error"); }
        else setSyncState("cloud");
      } catch {
        cloudEnabled.current = false;
        setSyncState("error");
      }
    }, 900);
    return () => window.clearTimeout(timer);
  }, [home, hydrated]);

  function updateHome(updater: (current: HomeState) => HomeState) {
    setHome((current) => ({ ...updater(current), updatedAt: new Date().toISOString() }));
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

  async function handleRoomPhoto(file?: File) {
    if (!file || !selectedSpace) return;
    try {
      const photo = await imageToDataUrl(file);
      updateHome((current) => ({ ...current, spaces: current.spaces.map((space) => space.id === selectedSpace.id ? { ...space, photo } : space) }));
      showToast("Room photo updated");
    } catch {
      showToast("That photo could not be opened");
    }
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
    try {
      const cloud = await fetchCloud();
      if (cloud) {
        setHome(cloud);
        setSyncModal(false);
        showToast("Synced from your home cloud");
      } else {
        const response = await fetch("/api/state", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(home),
        });
        if (response.ok) {
          cloudEnabled.current = true;
          setSyncState("cloud");
          setSyncModal(false);
          showToast("Cloud sync connected");
        } else {
          setSyncState("local");
          showToast("Cloud database is not connected yet");
        }
      }
    } catch {
      setSyncState("error");
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
        <div className="brand"><span className="brand-mark"><Layers3 size={20} /></span><span>Nook</span></div>
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
        <div className="privacy-card"><ShieldCheck size={20} /><div><strong>Private by design</strong><p>Your PIN stays on this device.</p></div></div>
        <button className="nav-item settings-button" onClick={() => setSyncModal(true)}><Settings size={18} /><span>Sync & backup</span></button>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="mobile-brand brand"><span className="brand-mark"><Layers3 size={19} /></span><span>Nook</span></div>
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
            <div><p className="eyebrow soft">Your home memory</p><h1>Everything has a place.</h1><p>See your whole home, then tap a room to remember what lives there.</p></div>
            <div className="welcome-actions">
              <button className="secondary-button" onClick={() => setSpaceModal(true)}><Plus size={17} /> Add space</button>
              <button className="primary-button" onClick={() => captureInput.current?.click()}><Camera size={18} /> Capture a space</button>
              <input ref={captureInput} className="sr-only" type="file" accept="image/*" capture="environment" onChange={(event) => void handleCapture(event.target.files?.[0])} />
            </div>
          </section>

          <section className="stats-row" aria-label="Inventory summary">
            <div><span className="stat-icon lime"><MapPin size={18} /></span><p><strong>{home.spaces.length}</strong><small>mapped spaces</small></p></div>
            <div><span className="stat-icon blue"><Package size={18} /></span><p><strong>{totalStored}</strong><small>things remembered</small></p></div>
            <div><span className="stat-icon peach"><Sparkles size={18} /></span><p><strong>{home.items.length ? "100%" : "0%"}</strong><small>easy to find</small></p></div>
          </section>

          <section className="map-workspace">
            <div className="map-panel">
              <div className="panel-heading">
                <div><p className="eyebrow">Interactive home map</p><h2>Your home in 3D</h2></div>
                <div className="view-toggle" role="group" aria-label="Map view">
                  <button className={!is3d ? "active" : ""} onClick={() => setIs3d(false)}>2D</button>
                  <button className={is3d ? "active" : ""} onClick={() => setIs3d(true)}><Rotate3D size={14} /> 3D</button>
                </div>
              </div>

              <div className="map-stage">
                <div className="map-grid" />
                <div className={`home-model ${is3d ? "is-3d" : "is-2d"}`} style={{ "--zoom": zoom, "--rotation": `${rotation}deg` } as CSSProperties}>
                  {home.spaces.map((space) => {
                    const Icon = iconForSpace(space.kind);
                    const count = home.items.filter((item) => item.spaceId === space.id).length;
                    const style = {
                      left: `${space.x * 72}px`, top: `${space.y * 72}px`, width: `${space.width * 72}px`, height: `${space.depth * 72}px`,
                      "--room-color": space.color,
                      ...(space.photo ? { backgroundImage: `linear-gradient(rgba(20,35,30,.2), rgba(20,35,30,.2)), url(${space.photo})` } : {}),
                    } as CSSProperties;
                    return <button key={space.id} className={`room-block ${selectedSpaceId === space.id ? "active" : ""} ${space.photo ? "has-photo" : ""}`} style={style} onClick={() => setSelectedSpaceId(space.id)} aria-label={`Open ${space.name}`}>
                      <span className="room-wall wall-right" /><span className="room-wall wall-bottom" />
                      <span className="room-content"><span className="room-icon"><Icon size={19} /></span><strong>{space.name}</strong><small>{count} {count === 1 ? "item" : "items"}</small></span>
                      {count > 0 && <span className="map-pin">{count}</span>}
                    </button>;
                  })}
                </div>
                {!home.spaces.length && <div className="empty-map"><Home size={30} /><strong>Start with your first room</strong><button onClick={() => setSpaceModal(true)}>Add a space</button></div>}
                <div className="map-hint"><Focus size={14} /> Tap a room to look inside</div>
                <div className="map-controls">
                  <button onClick={() => setZoom((value) => Math.min(1.08, value + 0.08))} aria-label="Zoom in"><Plus size={17} /></button>
                  <button onClick={() => setZoom((value) => Math.max(0.58, value - 0.08))} aria-label="Zoom out"><Minus size={17} /></button>
                  <button onClick={() => { setZoom(0.82); setRotation(-42); }} aria-label="Reset map"><Focus size={17} /></button>
                </div>
                {is3d && <label className="rotate-control"><Rotate3D size={15} /><input type="range" min="-65" max="-20" value={rotation} onChange={(event) => setRotation(Number(event.target.value))} aria-label="Rotate home map" /></label>}
              </div>
            </div>

            {selectedSpace ? <aside className="room-panel">
              <div className="room-cover" style={{ backgroundColor: selectedSpace.color, ...(selectedSpace.photo ? { backgroundImage: `url(${selectedSpace.photo})` } : {}) }}>
                <button className="photo-button" onClick={() => roomPhotoInput.current?.click()}><Camera size={15} /> {selectedSpace.photo ? "Change photo" : "Add photo"}</button>
                <input ref={roomPhotoInput} className="sr-only" type="file" accept="image/*" capture="environment" onChange={(event) => void handleRoomPhoto(event.target.files?.[0])} />
                {!selectedSpace.photo && <div className="cover-illustration">{(() => { const Icon = iconForSpace(selectedSpace.kind); return <Icon size={54} />; })()}</div>}
              </div>
              <div className="room-panel-body">
                <div className="room-title-row"><div><p className="eyebrow">Selected space</p><h3>{selectedSpace.name}</h3></div><button className="icon-button danger" onClick={deleteSpace} aria-label={`Delete ${selectedSpace.name}`}><Trash2 size={16} /></button></div>
                <div className="room-summary"><span><Package size={15} /> {selectedItems.length} records</span><span><Box size={15} /> {selectedItems.reduce((sum, item) => sum + item.quantity, 0)} things</span></div>
                <button className="remember-button" onClick={() => setItemModal(true)}><Plus size={18} /><span><strong>Remember something here</strong><small>Tell Nook exactly where it is</small></span></button>
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
        <button className="capture-fab" onClick={() => captureInput.current?.click()} aria-label="Capture a space"><Camera size={23} /></button>
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

      {itemModal && selectedSpace && <ItemModal space={selectedSpace} onClose={() => setItemModal(false)} onSubmit={addItem} />}

      {syncModal && <div className="modal-backdrop">
        <div className="modal-card sync-card">
          <button className="modal-close" onClick={() => setSyncModal(false)} aria-label="Close"><X size={18} /></button>
          <div className="modal-icon"><Cloud size={22} /></div><p className="eyebrow">Phone + laptop</p><h2>Cloud sync</h2><p className="modal-intro">Connect the private Neon database attached to this Vercel deployment. Your signed-in session protects every sync request.</p>
          <div className={`sync-status-card ${syncState}`}><span>{syncState === "cloud" ? <Check size={18} /> : <CloudOff size={18} />}</span><div><strong>{syncState === "cloud" ? "Your home is synced" : "Working on this device"}</strong><small>{syncState === "cloud" ? "Changes save automatically" : "Your inventory is still safely available offline"}</small></div></div>
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

function ItemModal({ space, onClose, onSubmit }: { space: Space; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
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
        <label><span>Exactly where?</span><input name="container" placeholder="e.g. Top shelf, green basket" required /></label>
        <div className="form-row"><label><span>Category</span><select name="category">{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label><label className="quantity-field"><span>Quantity</span><input name="quantity" type="number" min="1" defaultValue="1" /></label></div>
        <label><span>Helpful note <small>optional</small></span><textarea name="note" placeholder="Size, colour, who it belongs to…" rows={2} /></label>
        <button className="primary-button full" type="submit"><Sparkles size={17} /> Remember this place</button>
      </form>
    </div>
  </div>;
}
