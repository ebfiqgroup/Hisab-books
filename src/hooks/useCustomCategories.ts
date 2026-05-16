import { useEffect, useState } from "react";
import {
  CUSTOM_CAT_EVENT,
  CUSTOM_CAT_LS_KEY,
  loadCustomCats,
  type CustomCatMap,
  BUILTIN_CATS,
  type TxnType,
} from "@/lib/finance";

export function useCustomCategories() {
  const [map, setMap] = useState<CustomCatMap>(() => loadCustomCats());

  useEffect(() => {
    const refresh = () => setMap(loadCustomCats());
    window.addEventListener(CUSTOM_CAT_EVENT, refresh);
    const onStorage = (e: StorageEvent) => {
      if (e.key === CUSTOM_CAT_LS_KEY) refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CUSTOM_CAT_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const forType = (t: TxnType) => [...BUILTIN_CATS[t], ...map[t]];
  const combined = Array.from(
    new Set([...BUILTIN_CATS.income, ...BUILTIN_CATS.expense, ...map.income, ...map.expense]),
  );

  return { map, forType, combined };
}