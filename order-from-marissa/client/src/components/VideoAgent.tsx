import { useState, useEffect, useRef, useCallback } from "react";
import { Phone, PhoneOff, Mic, MicOff, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import {
  LiveAvatarSession,
  SessionEvent,
  SessionState,
  AgentEventsEnum,
} from "@heygen/liveavatar-web-sdk";

// Chroma key detection thresholds
const GREEN_MIN = 70;
const RATIO_SOFT = 1.25;
const RATIO_HARD = 1.4;

export default function VideoAgent() {
  const [sessionState, setSessionState] = useState<"loading" | "ready" | "live" | "error">("loading");
  const [isMuted, setIsMuted] = useState(false);
  const [hasVoice, setHasVoice] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const sessionRef = useRef<LiveAvatarSession | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chromaFrameRef = useRef<number>(0);
  const initRef = useRef(false);

  // Boot avatar session immediately on mount — avatar is always visible
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    bootSession();
  }, []);

  // Chroma key loop — makes green pixels transparent
  useEffect(() => {
    if (sessionState !== "ready" && sessionState !== "live") return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    let running = true;

    function processFrame() {
      if (!running || !video || !canvas || !ctx) return;

      if (video.readyState >= 2 && video.videoWidth > 0) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }

        ctx.drawImage(video, 0, 0);
        const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = frame.data;

        for (let i = 0; i < d.length; i += 4) {
          const r = d[i], g = d[i + 1], b = d[i + 2];
          if (g > GREEN_MIN && g > r * RATIO_SOFT && g > b * RATIO_SOFT) {
            if (g > r * RATIO_HARD && g > b * RATIO_HARD) {
              d[i + 3] = 0; // Fully transparent
            } else {
              const greenness = Math.min(1, (g - Math.max(r, b)) / 60);
              d[i + 3] = Math.round(255 * (1 - greenness * 0.9));
            }
          }
        }

        ctx.putImageData(frame, 0, 0);
      }

      chromaFrameRef.current = requestAnimationFrame(processFrame);
    }

    const t = setTimeout(() => processFrame(), 300);
    return () => { running = false; clearTimeout(t); cancelAnimationFrame(chromaFrameRef.current); };
  }, [sessionState]);

  // Clean up
  useEffect(() => {
    return () => {
      cancelAnimationFrame(chromaFrameRef.current);
      if (sessionRef.current) {
        try { sessionRef.current.stop(); } catch {}
      }
    };
  }, []);

  async function bootSession() {
    try {
      setSessionState("loading");

      const tokenRes = await apiRequest("POST", "/api/liveavatar/token");
      const tokenData = await tokenRes.json();
      if (!tokenData.sessionToken) throw new Error(tokenData.error || "No token");

      const session = new LiveAvatarSession(tokenData.sessionToken, {
        voiceChat: true,
      });
      sessionRef.current = session;

      session.on(SessionEvent.SESSION_STREAM_READY, () => {
        console.log("Stream ready");
        setSessionState("ready");
        // Attach video
        if (videoRef.current) {
          try {
            session.attach(videoRef.current);
            videoRef.current.play().catch(() => {});
          } catch (e) {
            console.error("Attach failed:", e);
          }
        }
      });

      session.on(SessionEvent.SESSION_DISCONNECTED, () => {
        console.log("Disconnected");
        setSessionState("loading");
        setHasVoice(false);
        // Auto-reconnect after a moment
        setTimeout(() => {
          initRef.current = false;
          bootSession();
        }, 2000);
      });

      await session.start();
      console.log("Session started");

    } catch (err: any) {
      console.error("Boot error:", err);
      setSessionState("error");
      setErrorMessage(err?.message || "Connection failed");
    }
  }

  const startCall = useCallback(async () => {
    if (!sessionRef.current) return;
    try {
      await sessionRef.current.voiceChat.start();
      setHasVoice(true);
      setSessionState("live");
      console.log("Voice started");
    } catch (err: any) {
      console.warn("Voice failed:", err.message);
      // If mic not available, still go live with text
      setHasVoice(false);
      setSessionState("live");
    }
  }, []);

  const endCall = useCallback(async () => {
    if (sessionRef.current && hasVoice) {
      try { await sessionRef.current.voiceChat.stop(); } catch {}
    }
    setHasVoice(false);
    setIsMuted(false);
    setSessionState("ready");
  }, [hasVoice]);

  const toggleMute = useCallback(async () => {
    if (!sessionRef.current || !hasVoice) return;
    if (!isMuted) {
      await sessionRef.current.voiceChat.mute();
    } else {
      await sessionRef.current.voiceChat.unmute();
    }
    setIsMuted(!isMuted);
  }, [isMuted, hasVoice]);

  const isLive = sessionState === "live";
  const showAvatar = sessionState === "ready" || sessionState === "live";

  return (
    <div className="aw" data-testid="avatar-widget">
      {/* Orange gradient bg */}
      <div className="aw-bg" />

      {/* Hidden video element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="aw-video"
        data-testid="liveavatar-video"
      />

      {/* Canvas — chroma keyed avatar */}
      <canvas
        ref={canvasRef}
        className={`aw-canvas ${showAvatar ? "aw-canvas-show" : ""}`}
        data-testid="chroma-canvas"
      />

      {/* Loading spinner */}
      {sessionState === "loading" && (
        <div className="aw-overlay">
          <Loader2 className="aw-spinner" />
          <p className="aw-status">Loading Marissa...</p>
        </div>
      )}

      {/* Error */}
      {sessionState === "error" && (
        <div className="aw-overlay">
          <p className="aw-status aw-status-err">{errorMessage || "Connection failed"}</p>
          <button onClick={() => { initRef.current = false; bootSession(); }} className="aw-btn aw-btn-start">
            Try Again
          </button>
        </div>
      )}

      {/* Bottom controls */}
      <div className="aw-bottom">
        {sessionState === "ready" && (
          <button onClick={startCall} className="aw-btn aw-btn-start" data-testid="start-call-button">
            <Phone className="w-4 h-4" />
            <span>Talk to Marissa</span>
          </button>
        )}

        {isLive && (
          <div className="aw-controls">
            {hasVoice && (
              <button
                onClick={toggleMute}
                className={`aw-btn-icon ${isMuted ? "aw-btn-muted" : ""}`}
                data-testid="mute-button"
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            )}
            <button onClick={endCall} className="aw-btn aw-btn-end" data-testid="end-call-button">
              <PhoneOff className="w-4 h-4" />
              <span>End Call</span>
            </button>
          </div>
        )}

        {isLive && (
          <div className="aw-live">
            <div className="aw-live-dot" />
            <span>LIVE</span>
          </div>
        )}
      </div>
    </div>
  );
}
