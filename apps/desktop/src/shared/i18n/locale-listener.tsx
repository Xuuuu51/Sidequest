import type { ReactNode } from "react";

import { useLocaleEvents } from "./use-locale-events";

export function LocaleListener({ children }: { children: ReactNode }) {
  useLocaleEvents();
  return children;
}
