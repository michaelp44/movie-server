"use client";

import { useEffect } from "react";

/** Tracks controls, never field contents, full URLs, phone numbers, or invitation tokens. */
export function GuestActivityTracker({ token, rootId }: { token?: string; rootId: string }) {
  useEffect(() => {
    const page = document.getElementById(rootId);
    if (!page) return;

    function send(target: string) {
      void fetch("/api/invitation-activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, target }),
        keepalive: true,
        credentials: "same-origin",
      }).catch(() => undefined);
    }

    function onClick(event: MouseEvent) {
      const element = event.target instanceof Element ? event.target : null;
      const control = element?.closest<HTMLElement>("[data-track], button, a, label, input, textarea");
      if (!control || !page?.contains(control) || control.closest("[disabled]")) return;
      const link = control instanceof HTMLAnchorElement ? control : control.closest("a");
      const section = link ? new URL(link.href).pathname.split("/")[1] || "home" : null;
      const target = control.dataset.track ?? (section && /^[a-z-]+$/.test(section) ? `link_${section}` : control.tagName.toLowerCase());
      send(target);
    }

    function onFocus(event: FocusEvent) {
      const element = event.target;
      if (element instanceof HTMLTextAreaElement && element.dataset.track) send(element.dataset.track);
    }

    page.addEventListener("click", onClick);
    page.addEventListener("focusin", onFocus);
    return () => {
      page.removeEventListener("click", onClick);
      page.removeEventListener("focusin", onFocus);
    };
  }, [rootId, token]);

  return null;
}

export function RsvpActivityTracker({ token }: { token: string }) {
  return <GuestActivityTracker token={token} rootId="rsvp-page" />;
}
