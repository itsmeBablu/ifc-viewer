/**
 * Home — H/L/K analysis viewer, gated by the welcome screen on first visit.
 */
import ViewerAppClient from "@/components/viewer/ViewerAppClient";
import { WelcomeGate } from "@/components/welcome";

export default function Home() {
  return (
    <WelcomeGate>
      <ViewerAppClient />
    </WelcomeGate>
  );
}
