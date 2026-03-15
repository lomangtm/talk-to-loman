import { useEffect } from "react";
import VideoAgent from "@/components/VideoAgent";

export default function Home() {
  // Set body background to match the widget gradient
  useEffect(() => {
    document.body.style.background = "#1a1a1a";
    document.body.style.margin = "0";
    document.body.style.padding = "0";
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.background = "";
    };
  }, []);

  return <VideoAgent />;
}
