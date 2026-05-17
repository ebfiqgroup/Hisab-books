import { createContext, useContext, ReactNode } from "react";
import type { RealtimeStatus } from "@/components/RealtimeStatusBadge";

const Ctx = createContext<RealtimeStatus>("connecting");

export function RealtimeStatusProvider({ value, children }: { value: RealtimeStatus; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRealtimeStatus(): RealtimeStatus {
  return useContext(Ctx);
}