import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera } from "lucide-react";
import "./mv.css";

export default function MachineVisionLesson() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const drawerRef = useRef(null);
  const handLmRef = useRef(null);

  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [fingers, setFingers] = useState(0);
  const [activeCardIdx, setActiveCardIdx] = useState(null);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);

  const cards = [
  {
    id: 1,
    title: "What Is Machine Vision?",
    body: [
      "Machines don’t actually *see* meaning — they record light as numbers.",
      "Every photo your phone takes is a grid of colored pixels. To a computer, your face is just data: brightness, color, and contrast patterns.",
      "Machine vision turns sight into data by detecting shapes, motion, and textures — it’s statistics, not perception.",
      "Computers measure relationships between pixels instead of understanding emotion or context.",
      "Reflection: if a machine doesn’t see context or feeling, can it ever really ‘see’?"
    ]
  },
  {
    id: 2,
    title: "A Short History of Seeing Machines",
    body: [
      "1950s–70s: Machine vision began with the barcode.",
      "1980s–2000s: Engineers hand-coded rules to find edges and faces. This ‘classical’ computer vision worked only under ideal lighting and angles.",
      "2012 → Deep Learning changed everything. Instead of writing rules, we showed neural networks millions of images so they could learn their own patterns.",
      "Today: Real-time models recognize faces and gestures instantly on phones.",
      "Reflection: what do we gain or lose when we let machines teach themselves?"
    ]
  },
  {
    id: 3,
    title: "ASCII Art: When Vision Becomes Language",
    body: [
      "Before screens could show full graphics, computers drew pictures with keyboard characters.",
      "Each symbol (like ‘@’ or ‘.’) represents brightness — turning visuals into code.",
      "It mirrors what machine vision does: compressing rich, continuous images into data that can be processed and compared.",
      "Artists use ASCII to show how perception becomes translation — how detail and emotion flatten into information.",
    ]
  },
  {
    id: 4,
    title: "Training Data: How Machines Learn to See",
    body: [
      "Machines learn to ‘see’ by studying huge image collections called training data.",
      "Each picture is labeled — cat, road, hand, smile — and the model looks for pixel patterns that usually match that label.",
      "But what a model learns depends on what it’s shown: biased data leads to biased vision. If most faces in a dataset share one skin tone or style, others may be misread or ignored.",
      "Reflection: if you trained a model only on your own camera roll, what kind of world would it believe exists?"
    ]
  },
  {
    id: 5,
    title: "Seeing, Surveillance, and Art",
    body: [
      "Machine vision shapes everyday life: unlocking phones, sorting packages, social media filters, tagging photos, navigating cars.",
      "But every act of ‘seeing’ also means capturing and storing data — turning people and spaces into information.",
      "The same algorithms that power creative filters can also enable surveillance and tracking.",
      "Vision has become infrastructure — a mix of creativity, convenience, and control.",
    ]
  }
];

  function cardIdxFromFingers(n) {
    if (n <= 0) return null;
    if (n > 5) n = 5;
    return n - 1;
  }

  function countFingers(landmarks, handedness) {
    if (!landmarks || landmarks.length < 21) return 0;
    const y = (i) => landmarks[i].y;
    const x = (i) => landmarks[i].x;
    const tip = { thumb: 4, index: 8, middle: 12, ring: 16, pinky: 20 };
    const pip = { index: 6, middle: 10, ring: 14, pinky: 18 };
    let count = 0;
    ["index", "middle", "ring", "pinky"].forEach((f) => {
      if (y(tip[f]) < y(pip[f])) count += 1;
    });
    if (handedness === "Right") {
      if (x(tip.thumb) < x(3)) count += 1;
    } else {
      if (x(tip.thumb) > x(3)) count += 1;
    }
    return count;
  }

  async function startCameraAndModel() {
    try {
      setError("");
      if (!window.isSecureContext) throw new Error("Use HTTPS or localhost for camera access.");
      setStatus("requesting");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: false,
      });
      const video = videoRef.current;
      video.srcObject = stream;
      video.setAttribute("playsinline", "");
      video.muted = true;
      await new Promise((res) => (video.onloadedmetadata = res));
      await video.play();

      setStatus("loading-model");
      const wasmBase = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm";
      const vision = await import("@mediapipe/tasks-vision");
      const { FilesetResolver, HandLandmarker, DrawingUtils } = vision;
      const filesetResolver = await FilesetResolver.forVisionTasks(wasmBase);

      const handLm = await HandLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
          delegate: "GPU",
        },
        numHands: 2,
        runningMode: "VIDEO",
      });
      handLmRef.current = handLm;

      const c = canvasRef.current;
      c.width = video.videoWidth;
      c.height = video.videoHeight;
      const ctx = c.getContext("2d");
      drawerRef.current = new DrawingUtils(ctx);


      let stableCount = 0;
      let lastCount = 0;

      const loop = () => {
        ctx.drawImage(video, 0, 0, c.width, c.height);
        if (!paused && handLmRef.current) {
          const t = performance.now();
          const results = handLmRef.current.detectForVideo(video, t);
          let maxFingers = 0;
          if (results?.landmarks?.length) {
            for (let i = 0; i < results.landmarks.length; i++) {
              const lmk = results.landmarks[i];
              const handedness = results.handednesses?.[i]?.[0]?.categoryName || "Right";
              const f = countFingers(lmk, handedness);
              if (f > maxFingers) maxFingers = f;
              drawerRef.current.drawLandmarks(lmk);
            }
          }
          if (maxFingers === lastCount) stableCount++;
          else {
            lastCount = maxFingers;
            stableCount = 0;
          }
          if (stableCount > 4) setFingers(maxFingers);
        }
        rafRef.current = requestAnimationFrame(loop);
      };

      setStatus("running");
      setStarted(true);
      rafRef.current = requestAnimationFrame(loop);
    } catch (e) {
      console.error(e);
      setError(e.message || "Camera or model failed to load. Check permissions/network.");
      setStatus("error");
    }
  }


  useEffect(() => {
    const idx = cardIdxFromFingers(fingers);
    if (idx !== null && activeCardIdx === null) setActiveCardIdx(idx);
  }, [fingers, activeCardIdx]);


  useEffect(() => {
    const video = videoRef.current;
    const nowPaused = activeCardIdx !== null;
    setPaused(nowPaused);
    if (video) {
      if (nowPaused) {
        try { video.pause(); } catch {}
      } else if (started) {
        try { video.play(); } catch {}
      }
    }
  }, [activeCardIdx, started]);


  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") setActiveCardIdx(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="page">
      <header className="header-center">
        <h1 className="title">Machine Vision: ART 3769</h1>
        <p className="sub">Raise <strong>1–5 fingers</strong> to open a topic. Or click a card.</p>
        <div className="status"><Camera width={16} height={16}/> Status: {status}</div>
        {error && <div style={{ marginTop: 8, color: "#b00020", fontSize: 14 }}>{error}</div>}
      </header>

      <section className="stage">
        <div className="camera-frame">
          <video ref={videoRef} style={{ display: "none" }} playsInline muted />
          <canvas ref={canvasRef} className="canvas" />
          <div className="pill">{`Fingers: ${fingers}`}</div>

          {!started && (
            <div className="start-overlay">
              <button onClick={startCameraAndModel} className="btn">
                Enable Camera & Start Demo
              </button>
            </div>
          )}

          <AnimatePresence>
            {activeCardIdx !== null && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="modal">
                <motion.div initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }} className="modal-panel">
                  <button aria-label="Close" onClick={() => setActiveCardIdx(null)} className="modal-x">×</button>
                  <div className="modal-inner">
                    <div className="modal-kicker">Card {activeCardIdx + 1} of {cards.length}</div>
                    <h2 className="modal-title">{cards[activeCardIdx].title}</h2>
                    <ul className="modal-list">
                      {cards[activeCardIdx].body.map((b, i) => <li key={i}>• {b}</li>)}
                    </ul>
                    <div className="modal-actions">
                      <button className="btn-ghost" onClick={() => setActiveCardIdx(i => (i > 0 ? i - 1 : 0))}>Prev</button>
                      <button className="btn-primary" onClick={() => setActiveCardIdx(i => (i < cards.length - 1 ? i + 1 : i))}>Next</button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="cards-row">
          {cards.map((c, i) => (
            <button key={c.id} onClick={() => setActiveCardIdx(i)} className="glass-card">
              <div className="card-hint">Show with {i + 1} finger{i + 1 === 1 ? "" : "s"}</div>
              <h3 className="card-title">{c.title}</h3>
              <p className="card-desc">{c.body[0]}</p>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
