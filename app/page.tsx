/**
 * Home — the root route ("/") entry point.
 *
 * Thin server component whose only job is to render `<ViewerAppClient>`,
 * the client-side app shell that owns the actual IFC viewer UI and state.
 */
import ViewerAppClient from "@/components/viewer/ViewerAppClient";

export default function Home() {
  return <ViewerAppClient />;
}
