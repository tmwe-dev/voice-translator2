'use client';
import { useEffect, useRef, useCallback, useState } from 'react';
import * as THREE from 'three';
import { gsap } from 'gsap';

// b.372 — I NOSTRI MESSAGGI HANNO ALTRI NOMI. RadioChat li chiama
// senderName/senderType/content, noi original/translated/from. Invece di
// rincorrere i nomi in venti punti del file (che vorrebbe dire riscriverlo)
// si traducono UNA VOLTA qui in cima, e sotto resta il codice originale.
export function daBarTalk(m, mioNome, mioLang) {
  // i nomi veri li dice la chat: sender / original / translated|translation
  const mio = m.sender === mioNome;
  const tradotto = (m.translations && m.translations[mioLang]) || m.translated || m.translation || '';
  return {
    id: m.id,
    senderName: m.sender || m.from || '',
    senderType: mio ? 'human' : 'assistant',
    // si legge la traduzione se c'e, se no l'originale: e la stessa
    // regola dell'elenco, non una nuova.
    content: (mio ? (m.original || m.text) : (tradotto || m.original || m.text)) || '',
    createdAt: m.createdAt || m.ts || m.timestamp || null,
    isDemo: false,
    isError: !!m.error,
  };
}

const CSS_CAROSELLO = `
.carousel-with-input {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.carousel-with-input .input-box {
  flex-shrink: 0;
}
.carousel-3d-wrapper {
  width: 100%;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: transparent;
  position: relative;
  overflow: visible;
}
.carousel-3d-canvas {
  flex: 1;
  cursor: pointer;
  min-height: 0;
  overflow: visible;
  position: relative;
}
.carousel-3d-canvas canvas {
  display: block;
  width: 100% !important;
  height: 100% !important;
}
.carousel-avatars {
  display: none;
  position: absolute;
  right: 24px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 30;
  flex-direction: column;
  gap: 16px;
}
.carousel-avatar-btn {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  overflow: visible;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  box-shadow: none;
}
.carousel-avatar-btn.active {
  transform: scale(1.2);
}
.carousel-avatar-btn:not(.active) {
  opacity: 0.5;
}
.carousel-avatar-btn:not(.active):hover {
  opacity: 0.85;
  transform: scale(1.08);
}
.carousel-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
  transition: all 0.3s;
  filter: drop-shadow(0 2px 8px rgba(0,0,0,0.4));
}
.carousel-avatar-btn.active .carousel-avatar-img {
  filter: drop-shadow(0 0 12px rgba(99, 102, 241, 0.5));
}
.carousel-avatar-img.inactive {
  filter: grayscale(1) brightness(0.75) drop-shadow(0 2px 6px rgba(0,0,0,0.3));
}
.carousel-avatar-emoji {
  font-size: 24px;
}
.carousel-3d-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 10px;
  background: rgba(26, 26, 36, 0.8);
  backdrop-filter: blur(8px);
  border-top: 1px solid rgba(42, 42, 64, 0.5);
}
.carousel-nav-btn {
  background: rgba(34, 34, 58, 0.6);
  color: #eef2ff;
  border: 1px solid rgba(42, 42, 64, 0.5);
  border-radius: 8px;
  padding: 8px 18px;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s;
  backdrop-filter: blur(4px);
}
.carousel-nav-btn:hover {
  background: rgba(99, 102, 241, 0.3);
  border-color: #26D9B0;
}
.carousel-nav-info {
  color: #eef2ff;
  font-size: 14px;
  min-width: 60px;
  text-align: center;
}
.floating-zoom-control {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 25;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px 8px;
  background: rgba(15, 15, 22, 0.7);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(42, 42, 64, 0.4);
  border-radius: 12px;
  opacity: 0.4;
  transition: opacity 0.3s ease;
}
.floating-zoom-control:hover {
  opacity: 1;
}
.zoom-slider-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.zoom-label {
  font-size: 10px;
  color: currentColor;
  white-space: nowrap;
  min-width: 40px;
  text-align: center;
}
.zoom-slider {
  writing-mode: vertical-lr;
  direction: rtl;
  width: 24px;
  height: 100px;
  cursor: pointer;
  accent-color: #26D9B0;
  appearance: slider-vertical;
  -webkit-appearance: slider-vertical;
}
.zoom-icon {
  font-size: 14px;
}
.zoom-divider {
  width: 24px;
  height: 1px;
  background: rgba(42, 42, 64, 0.5);
  margin: 4px 0;
}
@media (min-width: 768px) {
  .carousel-avatars { display: flex; }
}
@media (max-width: 768px) {
  .floating-zoom-control { display: none; }
  .conv-sidebar { width: 85%; max-width: 320px; }
}
@media (max-width: 768px) {
  .sidebar { display: none; }
  .message { max-width: 95%; }
  .modal-content { width: 95%; max-height: 90vh; }

  /* ── Sblocca scroll su mobile ── */
  html, body, #root {
    overflow: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
  }

  .app-main,
  .main-content,
  .app-layout-row {
    overflow: visible;
  }

  /* ── Left sidebar: overlay su mobile ── */
  .left-sidebar {
    position: fixed;
    top: 0;
    left: 0;
    width: 85%;
    max-width: 300px;
    z-index: 100;
    animation: slideInLeft 0.25s ease;
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }

  .lsb-overlay {
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
  }

  /* ── Navbar compatta ── */
  .navbar {
    height: 44px;
    padding: 0 10px;
  }

  .navbar-title {
    font-size: 17px;
  }

  .navbar-version {
    display: none;
  }

  .navbar-right {
    gap: 2px;
  }

  .navbar-right .icon-btn {
    width: 34px;
    height: 34px;
    font-size: 16px;
  }

  /* ── Agent tabs compatte ── */
  .agent-tabs-bar {
    padding: 4px 8px;
    gap: 3px;
  }

  .agent-tab {
    padding: 4px 10px;
    font-size: 11px;
    gap: 4px;
  }

  .agent-tab-avatar {
    width: 20px;
    height: 20px;
  }

  /* ── Tab bar bottom (glass morphism) ── */
  .main-tab-bar {
    order: 99;
    border-bottom: none;
    border-top: 1px solid rgba(42, 42, 64, 0.4);
    justify-content: space-around;
    padding: 0;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 50;
    background: rgba(18, 18, 28, 0.95);
    backdrop-filter: blur(12px);
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }

  .main-tab {
    flex-direction: column;
    gap: 2px;
    padding: 8px 4px;
    font-size: 10px;
    flex: 1;
    justify-content: center;
    border-bottom: none;
    border-top: 3px solid transparent;
  }

  .main-tab.active {
    border-bottom-color: transparent;
    border-top-color: #26D9B0;
  }

  .main-tab-icon {
    font-size: 18px;
  }

  .main-tab-label {
    font-size: 9px;
  }

  /* ── Content area: spazio per tab bar + input box fissi ── */
  .main-content-area {
    padding-bottom: 130px; /* 65px tab bar + 65px input box */
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  /* ── InputBox fisso sopra la tab bar ── */
  .input-box {
    position: fixed;
    bottom: calc(75px + env(safe-area-inset-bottom, 0px));
    left: 0;
    right: 0;
    z-index: 49;
    padding: 8px 12px;
    padding-bottom: 8px;
    background: rgba(15, 15, 20, 0.95);
    backdrop-filter: blur(16px);
    border-top: 1px solid rgba(42, 42, 64, 0.5);
  }

  .input-textarea {
    min-height: 38px;
    max-height: 100px;
    font-size: 16px; /* previene zoom iOS su focus */
  }

  .mic-button,
  .send-button {
    width: 38px;
    height: 38px;
    font-size: 18px;
  }

  /* ── Chat container: scroll abilitato su mobile ── */
  .chat-container,
  .tab-msg-with-input,
  .carousel-with-input {
    padding-bottom: 70px;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  /* ── Welcome / empty states: scrollabile su mobile ── */
  .message-list-empty,
  .tab-msg-view,
  .studio-page,
  .tab-content-padded {
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  /* ── Audio control bar compatta ── */
  .audio-control-bar {
    padding: 4px 10px;
    min-height: 34px;
    font-size: 12px;
  }

  /* ── Modal full-screen su mobile ── */
  .modal-content {
    border-radius: 12px 12px 0 0;
    max-height: 85vh;
  }

  /* ── Tab content padding per spazio input ── */
  .tab-content-padded {
    padding-bottom: 80px;
  }
}
`;

// --- Costanti originali v7.x ---
const MAX_SLOTS = 8;
const RADIUS = 7.8;
const MESH_Y = 0.82;
const CARD_WIDTH_BASE = 4.83;
const CARD_HEIGHT_BASE = 7.04;

// Colori agente (stile v7.x)
const GRADIENT_CONFIG = {
  albert: {
    from: 'rgba(34, 197, 94, 0.15)', to: 'rgba(22, 163, 74, 0.08)',
    border: 'rgba(34, 197, 94, 0.3)', title: '#4ade80', badge: '#16a34a'
  },
  archimede: {
    from: 'rgba(168, 85, 247, 0.15)', to: 'rgba(147, 51, 234, 0.08)',
    border: 'rgba(168, 85, 247, 0.3)', title: '#c084fc', badge: '#9333ea'
  },
  pitagora: {
    from: 'rgba(6, 182, 212, 0.15)', to: 'rgba(8, 145, 178, 0.08)',
    border: 'rgba(6, 182, 212, 0.3)', title: '#22d3ee', badge: '#0891b2'
  },
  newton: {
    from: 'rgba(245, 158, 11, 0.15)', to: 'rgba(217, 119, 6, 0.08)',
    border: 'rgba(245, 158, 11, 0.3)', title: '#fbbf24', badge: '#d97706'
  },
  human: {
    from: 'rgba(59, 130, 246, 0.15)', to: 'rgba(37, 99, 235, 0.08)',
    border: 'rgba(59, 130, 246, 0.3)', title: '#60a5fa', badge: '#2563eb'
  },
  system: {
    from: 'rgba(160, 160, 180, 0.15)', to: 'rgba(120, 120, 140, 0.08)',
    border: 'rgba(160, 160, 180, 0.3)', title: '#d0d0e0', badge: '#888'
  },
};

// b.372 — RadioChat colorava per AGENTE (Albert, Newton...). Qui non ci
// sono agenti: ci sono persone. Chi parla sono io o e un altro, e tanto
// basta — i due colori originali (human/system) c'erano gia.
function getColors(msg) {
  return msg.senderType === 'human' ? GRADIENT_CONFIG.human : GRADIENT_CONFIG.system;
}

// --- Texture HD via Canvas (design originale v7.x) ---
function createTextTexture(msg, renderer) {
  const DPR = window.devicePixelRatio || 2;
  const W = 800;
  const H = 1100;
  const canvas = document.createElement('canvas');
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  const ctx = canvas.getContext('2d');
  ctx.scale(DPR, DPR);

  const colors = getColors(msg);

  // Background gradiente diagonale (stile v7.x)
  const gradient = ctx.createLinearGradient(0, 0, W, H);
  gradient.addColorStop(0, colors.from);
  gradient.addColorStop(1, colors.to);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  // Bordo colorato
  ctx.strokeStyle = colors.border;
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, W - 3, H - 3);

  // Specchia orizzontalmente (effetto v7.x)
  ctx.save();
  ctx.scale(-1, 1);
  ctx.translate(-W, 0);

  // Badge: da noi dice chi parla, non quale motore
  const badgeText = String(msg.senderName || '').slice(0, 18).toUpperCase();
  const badgePadding = 12;
  const badgeHeight = 32;
  ctx.font = 'bold 18px sans-serif';
  const badgeWidth = ctx.measureText(badgeText).width + badgePadding * 2;

  ctx.fillStyle = colors.badge;
  ctx.fillRect(20, 20, badgeWidth, badgeHeight);

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(badgeText, 20 + badgeWidth / 2, 20 + badgeHeight / 2 + 6);

  // Emoji + Nome sender
  ctx.fillStyle = colors.title;
  ctx.font = 'bold 36px sans-serif';
  ctx.textAlign = 'center';
  // b.372 — nell'originale qui c'era un'emoji davanti al nome. Da noi le
  // emoji nell'interfaccia non si usano (regola dell'app, con tanto di
  // prova che la fa rispettare): il nome basta, ed e piu pulito.
  ctx.fillText(String(msg.senderName || ''), W / 2, 85);

  // Corpo messaggio
  ctx.fillStyle = '#ffffff';
  ctx.font = '24px sans-serif';
  ctx.textAlign = 'left';
  const lineHeight = 32;
  const maxWidth = W - 80;
  const words = msg.content.split(' ');
  const x = 40;
  let y = 140;
  let line = '';

  for (let i = 0; i < words.length; i++) {
    const testLine = line + words[i] + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && i > 0) {
      ctx.fillText(line, x, y);
      line = words[i] + ' ';
      y += lineHeight;
      if (y > H - 80) {
        ctx.fillText(line + '...', x, y);
        line = '';
        break;
      }
    } else {
      line = testLine;
    }
  }
  if (line) ctx.fillText(line, x, y);

  // Footer: timestamp
  if (msg.createdAt) {
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'right';
    // b.372 — l'ora nella lingua di chi guarda, non in italiano fisso
    const time = new Date(msg.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    ctx.fillText(time, W - 30, H - 30);
  }


  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  if (renderer) {
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  } else {
    texture.anisotropy = 4;
  }
  return texture;
}

export default function Carosello3D({ messages, currentIndex, onIndexChange, zoom = 1.0, verticalOffset = 0, L }) {
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const groupRef = useRef(null);
  const meshesRef = useRef([]);
  const slotsRef = useRef([]);   // b.372 — cosa c'e in ogni carta, per indice
  const hasInitRef = useRef(false);
  const animFrameRef = useRef(0);
  const isFirstRotationRef = useRef(true);
  const fovBaseRef = useRef(null);   // b.372 — l'inquadratura con cui e nata la scena
  const [isReady, setIsReady] = useState(false);

  // Inizializza Three.js (setup identico a v7.x)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isMobile = window.innerWidth < 768;
    const fov = isMobile ? 62 : 67;
    fovBaseRef.current = fov;
    const { width, height } = container.getBoundingClientRect();

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(fov, width / height, 0.1, 1000);
    camera.position.set(0, 0.3, 13.5); // Posizione camera originale v7.x
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    // b.372 — RIPARATO. Senza tetto, su un telefono a densita tre si
    // disegnano NOVE VOLTE i pixel dello schermo, e insieme alle otto
    // immagini grandi il telefono si pianta. Due e gia oltre quello che
    // l'occhio distingue.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting originale v7.x
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const pointLight = new THREE.PointLight(0x8b5cf6, 1, 100);
    pointLight.position.set(0, 0, 5);
    scene.add(pointLight);

    const group = new THREE.Group();
    scene.add(group);
    groupRef.current = group;

    queueMicrotask(() => setIsReady(true));

    // Animation loop
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // Resize handler
    const onResize = () => {
      const { width: w, height: h } = container.getBoundingClientRect();
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      renderer.setPixelRatio(window.devicePixelRatio);
    };
    window.addEventListener('resize', onResize);

    // ResizeObserver per sidebar toggle
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0) {
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      window.removeEventListener('resize', onResize);
      resizeObserver.disconnect();
      cancelAnimationFrame(animFrameRef.current);
      // b.372 — RIPARATO. L'originale chiudeva il disegnatore ma non
      // liberava le OTTO IMMAGINI delle carte. Ognuna e una tela da
      // 800x1100 moltiplicata per la densita dello schermo: su un
      // telefono moderno sono decine di megabyte di memoria video che
      // restavano appesi ogni volta che si chiudeva la chat. Chi entra
      // e esce cinque volte se li porta dietro tutti e cinque.
      for (const mesh of meshesRef.current) {
        if (mesh.material?.map) mesh.material.map.dispose();
        mesh.material?.dispose?.();
        mesh.geometry?.dispose?.();
        group.remove(mesh);
      }
      meshesRef.current = [];
      hasInitRef.current = false;
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Inizializza 8 slot invisibili (geometria fissa come v7.x)
  useEffect(() => {
    if (!isReady || !groupRef.current || hasInitRef.current) return;

    const group = groupRef.current;
    const angleStep = (Math.PI * 2) / MAX_SLOTS;
    const scaleFactor = Math.min(window.innerWidth / 1200, 2.0);

    for (let i = 0; i < MAX_SLOTS; i++) {
      const geometry = new THREE.PlaneGeometry(
        CARD_WIDTH_BASE * scaleFactor,
        CARD_HEIGHT_BASE * scaleFactor
      );
      const material = new THREE.MeshBasicMaterial({
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0, // Invisibile inizialmente
      });
      const mesh = new THREE.Mesh(geometry, material);

      // Posizionamento antiorario (identico v7.x)
      const angle = -(i * angleStep) + Math.PI;
      mesh.position.set(
        Math.cos(angle) * RADIUS,
        MESH_Y,
        Math.sin(angle) * RADIUS
      );
      mesh.lookAt(new THREE.Vector3(0, 0, 0));

      group.add(mesh);
      meshesRef.current.push(mesh);
    }

    hasInitRef.current = true;
    slotsRef.current = [];
  }, [isReady]);

  // Zoom FOV (v7.x style - ultra-light, no geometry recalc)
  useEffect(() => {
    if (!cameraRef.current) return;
    // b.372 — RIPARATO. L'inquadratura di partenza era 62 sul telefono e
    // 67 sullo schermo grande, ma questo pezzo ripartiva sempre da 50 e
    // scattava appena montato: la distinzione telefono/schermo non ha
    // mai avuto effetto, e all'apertura si vedeva un salto. Adesso la
    // base e quella con cui e nata la scena.
    const baseFOV = fovBaseRef.current || 50;
    const newFOV = baseFOV / (zoom || 1.0);
    cameraRef.current.fov = newFOV;
    cameraRef.current.updateProjectionMatrix();
  }, [zoom]);

  // Vertical camera offset (v7.x style - GSAP animated)
  useEffect(() => {
    if (!cameraRef.current) return;
    const cameraYOffset = -(verticalOffset || 0) * 0.01;
    const baseY = 0.3;
    const newY = baseY + cameraYOffset;
    gsap.to(cameraRef.current.position, {
      y: newY,
      duration: 0.3,
      ease: 'power2.out'
    });
  }, [verticalOffset]);

  // Popola slot con messaggi
  useEffect(() => {
    if (!isReady || !groupRef.current || meshesRef.current.length === 0) return;

    const allMessages = messages.filter(m => (m.senderType === 'assistant' || m.senderType === 'human') && !m.isDemo && !m.isError);
    const visibleMessages = allMessages.slice(-MAX_SLOTS);

    visibleMessages.forEach((msg, i) => {
      const msgKey = `${msg.id || ''}_${msg.content.slice(0, 20)}`;
      // b.372 — ERRORE TROVATO NELL'ORIGINALE, riparato qui.
      //
      // Prima si teneva un ELENCO dei messaggi gia disegnati e si
      // saltava chiunque fosse dentro. Funziona finche i messaggi sono
      // otto. Al NONO la finestra scorre: quello che stava nella carta 1
      // passa alla carta 0 — ma risulta "gia disegnato", quindi viene
      // saltato, e la carta 0 resta con il messaggio di prima.
      //
      // Da li in poi ogni carta mostra il messaggio del vicino. Non e un
      // difetto grafico: si legge il testo sbagliato attribuito alla
      // persona sbagliata.
      //
      // La riparazione: non si ricorda "chi ho disegnato", si ricorda
      // COSA C'E' IN OGNI CARTA. Se la carta i porta un altro messaggio,
      // si ridisegna. Una riga di idea, non un pezzo nuovo.
      if (i >= meshesRef.current.length) return;
      if (slotsRef.current[i] === msgKey) return;

      const mesh = meshesRef.current[i];
      const material = mesh.material;

      // Rilascia vecchia texture
      if (material.map) material.map.dispose();

      const newTexture = createTextTexture(msg, rendererRef.current || undefined);
      material.map = newTexture;
      material.opacity = 1;
      material.needsUpdate = true;

      slotsRef.current[i] = msgKey;
    });

    // Nascondi slot inutilizzati
    for (let i = visibleMessages.length; i < meshesRef.current.length; i++) {
      const mat = meshesRef.current[i].material;
      // b.372 — l'originale spegneva solo le carte SENZA immagine, cioe
      // proprio quelle che erano gia spente. Una carta con sopra un
      // messaggio vecchio restava accesa a girare per sempre.
      if (mat.map) { mat.map.dispose(); mat.map = null; mat.needsUpdate = true; }
      mat.opacity = 0;
      slotsRef.current[i] = null;
    }
  }, [messages, isReady]);

  // Rotazione GSAP al messaggio attivo (identica a v7.x)
  // Primo posizionamento: istantaneo. Successivi: animati.
  useEffect(() => {
    if (!groupRef.current) return;

    const allMessages = messages.filter(m => (m.senderType === 'assistant' || m.senderType === 'human') && !m.isDemo && !m.isError);
    const visibleCount = Math.min(allMessages.length, MAX_SLOTS);
    if (visibleCount === 0) return;

    const targetAngle = -(currentIndex / MAX_SLOTS) * Math.PI * 2 + Math.PI / 2;

    if (isFirstRotationRef.current) {
      // Prima rotazione: posiziona istantaneamente (no animation)
      groupRef.current.rotation.y = targetAngle;
      isFirstRotationRef.current = false;
    } else {
      gsap.to(groupRef.current.rotation, {
        y: targetAngle,
        duration: 1.2,
        ease: 'power2.inOut'
      });
    }
  }, [currentIndex, messages]);

  // Navigazione
  const goNext = useCallback(() => {
    const all = messages.filter(m => (m.senderType === 'assistant' || m.senderType === 'human') && !m.isDemo && !m.isError);
    const max = Math.min(all.length, MAX_SLOTS) - 1;
    onIndexChange(Math.min(currentIndex + 1, max));
  }, [currentIndex, messages, onIndexChange]);

  const goPrev = useCallback(() => {
    onIndexChange(Math.max(currentIndex - 1, 0));
  }, [currentIndex, onIndexChange]);

  // Wheel + touch navigation
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let touchStartX = 0;
    const onWheel = (e) => {
      e.preventDefault();
      if (e.deltaY > 0) goNext();
      else goPrev();
    };
    const onTouchStart = (e) => {
      touchStartX = e.touches[0].clientX;
    };
    const onTouchEnd = (e) => {
      const diff = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(diff) > 50) {
        if (diff > 0) goPrev();
        else goNext();
      }
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    container.addEventListener('touchstart', onTouchStart);
    container.addEventListener('touchend', onTouchEnd);
    return () => {
      container.removeEventListener('wheel', onWheel);
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchend', onTouchEnd);
    };
  }, [goNext, goPrev]);

  // Click navigation (left/right zones)
  const handleClick = useCallback((e) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const zone = x / rect.width;
    if (zone < 0.25) goPrev();
    else if (zone > 0.75) goNext();
  }, [goNext, goPrev]);

  const visibleCount = Math.min(
    messages.filter(m => (m.senderType === 'assistant' || m.senderType === 'human') && !m.isDemo && !m.isError).length,
    MAX_SLOTS
  );

  return (
    <div className="carousel-3d-wrapper">
      {/* b.372 — LO STILE VIENE CON LUI. RadioChat lo teneva in un foglio
          globale; qui non esistono fogli globali, lo stile sta dentro i
          componenti. Le regole sono le SUE, copiate: cambiati solo i nomi
          dei colori, che erano variabili di quel progetto e da noi non
          esistono. */}
      <style>{CSS_CAROSELLO}</style>
      {/* Avatar Navigation Column (desktop only, stile v7.x) */}
      {visibleCount > 1 && (
        <div className="carousel-avatars">
          {messages
            .filter(m => (m.senderType === 'assistant' || m.senderType === 'human') && !m.isDemo && !m.isError)
            .slice(-MAX_SLOTS)
            .map((msg, i) => {
              const isActive = i === currentIndex;

              return (
                <button
                  key={msg.id || i}
                  onClick={() => onIndexChange(i)}
                  className={`carousel-avatar-btn ${isActive ? 'active' : ''}`}
                  title={msg.senderName}
                >
                  <span className="carousel-avatar-emoji">
                    {(msg.senderName || '·').slice(0, 1).toUpperCase()}
                  </span>
                </button>
              );
            })}
        </div>
      )}

      {/* Canvas 3D */}
      <div
        ref={containerRef}
        className="carousel-3d-canvas"
        onClick={handleClick}
      />

      {/* Navigation bar */}
      <div className="carousel-3d-nav">
        <button onClick={goPrev} className="carousel-nav-btn" title={L ? L('backWord') : 'Precedente'}>◀</button>
        <span className="carousel-nav-info">
          {currentIndex + 1} / {visibleCount}
        </span>
        <button onClick={goNext} className="carousel-nav-btn" title={L ? L('nextWord') : 'Successivo'}>▶</button>
      </div>
    </div>
  );
}
