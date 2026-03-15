import { useState, useCallback } from "react";
import { apiRequest } from "@/lib/queryClient";

interface ConversationState {
  sessionId: string | null;
  status: "idle" | "connecting" | "active" | "ended";
  isDemo: boolean;
}

export function useConversation() {
  const [state, setState] = useState<ConversationState>({
    sessionId: null,
    status: "idle",
    isDemo: false,
  });

  const startConversation = useCallback(async () => {
    setState(prev => ({ ...prev, status: "connecting" }));

    try {
      const res = await apiRequest("POST", "/api/conversation/start");
      const data = await res.json();

      setState({
        sessionId: data.sessionId,
        status: "active",
        isDemo: data.demo ?? false,
      });

      return data;
    } catch (error) {
      setState(prev => ({ ...prev, status: "idle" }));
      throw error;
    }
  }, []);

  const endConversation = useCallback(() => {
    setState({
      sessionId: null,
      status: "ended",
      isDemo: false,
    });
  }, []);

  const resetConversation = useCallback(() => {
    setState({
      sessionId: null,
      status: "idle",
      isDemo: false,
    });
  }, []);

  return {
    ...state,
    startConversation,
    endConversation,
    resetConversation,
  };
}
