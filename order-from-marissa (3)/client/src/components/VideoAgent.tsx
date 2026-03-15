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
  // "idle" = nothing running, just orange bg + Start button
  // "loading" = session booting
  // "live" = session active, voice chat running
  // "error" = something failed
  const [sessionState, setSessionState] = useState<"idle" | "loading" | "live" | "error">("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const sessionRef = useRef<LiveAvatarSession | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chromaFrameRef = useRef<number>(0);

  // Chroma key loop — makes green pixels transparent
  useEffect(() => {
    if (sessionState !== "live") return;

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
              d[i + 3] = 0;
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

      session.on(SessionEvent.SESSION_STREAM_READY, async () => {
        console.log("Stream ready");

        const vid = videoRef.current;
        if (vid) {
          try {
            // Attach SDK stream (both audio + video tracks) to the video element
            session.attach(vid);

            // Since this runs from a user click, we can unmute and play with audio.
            // The browser allows autoplay with sound after a user gesture.
            vid.muted = false;
            vid.volume = 1.0;
            vid.play().catch((e) => {
              console.warn("Play with audio failed, trying muted:", e);
              // Fallback: if unmuted play fails, play muted first then unmute
              vid.muted = true;
              vid.play().then(() => {
                vid.muted = false;
              }).catch(() => {});
            });
          } catch (e) {
            console.error("Attach failed:", e);
          }
        }

        // Start voice chat (microphone input)
        try {
          await session.voiceChat.start();
          console.log("Voice chat started");
        } catch (err: any) {
          console.warn("Voice start failed:", err.message);
        }

        setSessionState("live");
      });

      session.on(SessionEvent.SESSION_DISCONNECTED, () => {
        console.log("Disconnected");
        setSessionState("idle");
        sessionRef.current = null;
      });

      // Log agent events for debugging
      session.on(AgentEventsEnum.AVATAR_SPEAK_STARTED, () => console.log("Avatar speaking"));
      session.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, () => console.log("Avatar done speaking"));
      session.on(AgentEventsEnum.USER_SPEAK_STARTED, () => console.log("User speaking"));
      session.on(AgentEventsEnum.USER_SPEAK_ENDED, () => console.log("User done speaking"));

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
      try { sessionRef.current.voiceChat.stop(); } catch {}
      try { await sessionRef.current.stop(); } catch {}
    }
    sessionRef.current = null;
    setIsMuted(false);
    setSessionState("idle");
  }, []);

  const toggleMute = useCallback(async () => {
    if (!sessionRef.current) return;
    try {
      if (!isMuted) {
        await sessionRef.current.voiceChat.mute();
      } else {
        await sessionRef.current.voiceChat.unmute();
      }
      setIsMuted(!isMuted);
    } catch (e) {
      console.warn("Mute toggle failed:", e);
    }
  }, [isMuted]);

  const isLive = sessionState === "live";

  return (
    <div className="aw" data-testid="avatar-widget">
      {/* Orange gradient bg */}
      <div className="aw-bg" />

      {/* Video element — starts muted in HTML, gets unmuted via JS after user click */}
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
        className={`aw-canvas ${isLive ? "aw-canvas-show" : ""}`}
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
        {/* Idle: show Start Call button */}
        {sessionState === "idle" && (
          <button onClick={bootAndStartVoice} className="aw-btn aw-btn-start" data-testid="start-call-button">
            <Phone className="w-4 h-4" />
            <span>Talk to Marissa</span>
          </button>
        )}

        {isLive && (
          <div className="aw-controls">
            <button
              onClick={toggleMute}
              className={`aw-btn-icon ${isMuted ? "aw-btn-muted" : ""}`}
              data-testid="mute-button"
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
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
