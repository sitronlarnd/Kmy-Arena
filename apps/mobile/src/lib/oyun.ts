import type { OyunDurumu } from "@kmy/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { useOturum } from "./oturum";

/** Oyun durumu (seri, görevler, rozetler, envanter). Yazmalar yalnızca API'de. */
export function useOyun() {
  const id = useOturum((s) => s.oturum?.user.id);
  const ogrenci = useOturum((s) => s.profil?.tur === "ogrenci");
  return useQuery({
    queryKey: ["oyun", id],
    enabled: Boolean(id) && ogrenci,
    staleTime: 15_000,
    queryFn: () => api<OyunDurumu & { yeniRozetler: string[] }>("/api/oyun/durum", {}),
  });
}

export function useOyunYenile() {
  const q = useQueryClient();
  return () => {
    void q.invalidateQueries({ queryKey: ["oyun"] });
    void q.invalidateQueries({ queryKey: ["ilerleme"] });
  };
}
