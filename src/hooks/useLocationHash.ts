"use client";

import { useSyncExternalStore } from "react";

function subscribe(onStoreChange: () => void) {
  window.addEventListener("hashchange", onStoreChange);
  window.addEventListener("popstate", onStoreChange);
  return () => {
    window.removeEventListener("hashchange", onStoreChange);
    window.removeEventListener("popstate", onStoreChange);
  };
}

function getSnapshot() {
  return window.location.hash;
}

function getServerSnapshot() {
  return "";
}

export function useLocationHash() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
