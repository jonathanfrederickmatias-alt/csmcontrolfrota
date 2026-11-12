import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchDismissedKeys, visibleAlerts, FUEL_ALERTS_EVENT } from "@/components/fuel/FuelConsumptionAlerts";

/** Number of open fuel consumption alerts, for the menu badge. */
export function useFuelAlertCount(enabled: boolean) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!enabled || !navigator.onLine) return;
    let cancelled = false;
    const load = async () => {
      // 90-day window plus history before it so each series has a reference reading
      const since = new Date(Date.now() - 150 * 86400000).toISOString().slice(0, 10);
      const all: any[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from("fuel_records")
          .select("id,target_equipment_id,combo_equipment_id,date,created_at,liters,hour_meter,fuel_type,hour_meter_confirmed")
          .gte("date", since).order("date").range(from, from + 999);
        if (error || !data?.length) break;
        all.push(...data);
        if (data.length < 1000) break;
      }
      const [{ data: eqs }, dismissed] = await Promise.all([
        supabase.from("equipments").select("id,name,type,plate,track_hour_meter"),
        fetchDismissedKeys(),
      ]);
      if (!cancelled) setCount(visibleAlerts(all, (eqs || []) as any, dismissed).length);
    };
    load();
    const onEvt = (e: Event) => setCount((e as CustomEvent).detail ?? 0);
    window.addEventListener(FUEL_ALERTS_EVENT, onEvt);
    const t = setInterval(load, 5 * 60 * 1000);
    return () => { cancelled = true; window.removeEventListener(FUEL_ALERTS_EVENT, onEvt); clearInterval(t); };
  }, [enabled]);
  return count;
}
