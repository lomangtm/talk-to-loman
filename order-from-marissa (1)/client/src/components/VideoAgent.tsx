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
  // "idle" = no session yet, avatar not visible, shows Start Call button
  // "loading" = session booting up
  // "ready" = session running, avatar visible, voice not started yet
  // "live" = voice chat active
  // "error" = something went wrong
  const [sessionState, setSessionState] = useState<"idle" | "loading" | "ready" | "live" | "error">("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [hasVoice, setHasVoice] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const sessionRef = useRef<LiveAvatarSession | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chromaFrameRef = useRef<number>(0);

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

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(chromaFrameRef.current);
      if (sessionRef.current) {
        try { sessionRef.current.stop(); } catch {}
      }
    };
  }, []);

  // Boot session AND start voice — triggered by button click only
  async function bootAndStartVoice() {
    try {
      setSessionState("loading");

      const tokenRes = await apiRequest("POST", "/api/liveavatar/token");
      const tokenData = await tokenRes.json();
      if (!tokenData.sessionToken) throw new Error(tokenData.error || "No token");

      const session = new LiveAvatarSession(tokenData.sessionToken, {
        voiceChat: true,
      });
      sessionRef.current = session;

      // Wait for stream to be ready, then attach video and start voice
      session.on(SessionEvent.SESSION_STREAM_READY, async () => {
        console.log("Stream ready");
        // Attach video
        if (videoRef.current) {
          try {
            session.attach(videoRef.current);
            videoRef.current.play().catch(() => {});
          } catch (e) {
            console.error("Attach failed:", e);
          }
        }
        // Immediately start voice chat
        try {
          await session.voiceChat.start();
          setHasVoice(true);
          setSessionState("live");
          console.log("Voice started");
        } catch (err: any) {
          console.warn("Voice start failed:", err.message);
          setHasVoice(false);
          setSessionState("live");
        }
      });

      session.on(SessionEvent.SESSION_DISCONNECTED, () => {
        console.log("Disconnected");
        setSessionState("idle");
        setHasVoice(false);
        sessionRef.current = null;
      });

      await session.start();
      console.log("Session started");

    } catch (err: any) {
      console.error("Boot error:", err);
      setSessionState("error");
      setErrorMessage(err?.message || "Connection failed");
    }
  }

  const endCall = useCallback(async () => {
    if (sessionRef.current) {
      if (hasVoice) {
        try { await sessionRef.current.voiceChat.stop(); } catch {}
      }
      try { await sessionRef.current.stop(); } catch {}
    }
    sessionRef.current = null;
    setHasVoice(false);
    setIsMuted(false);
    setSessionState("idle");
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
          <p className="aw-status">Connecting to Marissa...</p>
        </div>
      )}

      {/* Error */}
      {sessionState === "error" && (
        <div className="aw-overlay">
          <p className="aw-status aw-status-err">{errorMessage || "Connection failed"}</p>
          <button onClick={() => bootAndStartVoice()} className="aw-btn aw-btn-start">
            Try Again
          </button>
        </div>
      )}

      {/* Bottom controls */}
      <div className="aw-bottom">
        {/* Idle state: show Start Call button */}
        {sessionState === "idle" && (
          <button onClick={bootAndStartVoice} className="aw-btn aw-btn-start" data-testid="start-call-button">
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
