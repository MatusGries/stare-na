// clusterFraming.ts — where to put the camera so a whole constellation fits.
//
//   members ──centroid──> look-at point
//           └──max spread──> stop distance (vertical fov 58° ⇒ ~1.8× radius,
//                            plus margin), clamped so we never end up inside
//                            the cluster or so far it reads as the overview.
import { COORD_SCALE } from "@/components/galaxy/constants";
import type { Channel } from "@/types/channel";

export const MIN_FRAME_DISTANCE = 14;
export const MAX_FRAME_DISTANCE = 80;

export interface ClusterFraming {
  center: [number, number, number];
  distance: number;
}

export const clusterFraming = (members: Channel[]): ClusterFraming | null => {
  if (!members.length) return null;
  const n = members.length;
  const cx = members.reduce((s, c) => s + c.x, 0) / n;
  const cy = members.reduce((s, c) => s + c.y, 0) / n;
  const cz = members.reduce((s, c) => s + c.z, 0) / n;
  const radius = Math.max(
    ...members.map((c) => Math.hypot(c.x - cx, c.y - cy, c.z - cz))
  );
  const worldRadius = Math.max(radius, 0.6) * COORD_SCALE;
  return {
    center: [cx * COORD_SCALE, cy * COORD_SCALE, cz * COORD_SCALE],
    distance: Math.min(MAX_FRAME_DISTANCE, Math.max(MIN_FRAME_DISTANCE, worldRadius * 2.4)),
  };
};
