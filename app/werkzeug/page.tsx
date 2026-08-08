/**
 * Werkzeug — standalone IFC tool interface (isolated from H/L/K viewer).
 */
import WerkzeugAppClient from "@/components/tools/WerkzeugAppClient";
import { WelcomeGate } from "@/components/welcome";

export default function WerkzeugPage() {
  return (
    <WelcomeGate>
      <WerkzeugAppClient />
    </WelcomeGate>
  );
}
