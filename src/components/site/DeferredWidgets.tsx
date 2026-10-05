import { lazy, Suspense, useEffect, useState } from "react";

// The lead pop-up and voice-message widget are never needed for first paint
// (the pop-up opens after a delay; the voice button is a floating extra).
// Loading them after the browser is idle keeps their code out of the bundle
// every page waits on, and out of hydration.
const LeadPopup = lazy(() =>
  import("@/components/site/LeadPopup").then((m) => ({ default: m.LeadPopup })),
);
const VoiceMessage = lazy(() =>
  import("@/components/site/VoiceMessage").then((m) => ({ default: m.VoiceMessage })),
);

export function DeferredWidgets() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1200));
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    const id = idle(() => setReady(true), { timeout: 2500 });
    return () => cancel(id);
  }, []);
  if (!ready) return null;
  return (
    <Suspense fallback={null}>
      <LeadPopup />
      <VoiceMessage />
    </Suspense>
  );
}
