import type { Amblem } from "@kmy/shared";
import { Amblem as AmblemSvg } from "./sanat";

/** Hazır parçalardan klan amblemi (SVG kalkan + simge + renk). */
export function AmblemRozeti({ a, boyut = 48 }: { a: Amblem; boyut?: number }) {
  return <AmblemSvg a={a} boyut={boyut} />;
}
