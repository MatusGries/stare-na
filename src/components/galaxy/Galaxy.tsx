import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars, Line } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, Noise } from "@react-three/postprocessing";
import Star from "./Star";
import ConstellationLabels from "./ConstellationLabels";
import BlackHole from "./BlackHole";
import CameraController from "./CameraController";
import SupportStars from "./SupportStars";
import NebulaLayer from "./NebulaLayer";
import { COORD_SCALE, OVERVIEW_CAMERA } from "./constants";
import type { Channel } from "@/types/channel";

interface GalaxyProps {
  channels: Channel[];
  activeChannel: Channel | null;
  searchQuery: string;
  /** Condensation reveal for freshly generated galaxies (T6). */
  reveal?: boolean;
  /** Milestone-B live condensation: UMAP optimization snapshots ([-8,8]³,
   *  aligned to `channels` order). When present, playback replaces the T6
   *  reveal and drives star positions until it settles. */
  epochFrames?: number[][][];
  /** Playback length: ~14s for the condensation, ~2.5s for the B2 settle. */
  epochDuration?: number;
  onCondensed?: () => void;
  /** B3: named clusters, labeled in 3D at their centroids. */
  constellations?: import("@/lib/pipeline/constellations").Constellation[];
  /** Fade the labels back while a panel or search is in focus. */
  constellationsDimmed?: boolean;
  onSelectChannel: (channel: Channel) => void;
  onBlackHoleClick: () => void;
  resetSignal: number;
  onOverviewRequest: () => void;
}

const CONDENSE_SECONDS = 14;

// Drives star group positions through the recorded UMAP epochs, then hands
// control back to the stars (drift). Imperative on purpose: zero per-frame
// React work for 300+ stars.
const EpochDriver = ({
  frames,
  channels,
  groups,
  duration = CONDENSE_SECONDS,
  onDone,
}: {
  frames: number[][][];
  channels: Channel[];
  groups: Map<string, THREE.Group>;
  duration?: number;
  onDone: () => void;
}) => {
  const t = useRef(0);
  const done = useRef(false);
  useFrame((_, delta) => {
    if (done.current) return;
    if (frames.length < 2) {
      done.current = true;
      onDone();
      return;
    }
    t.current = Math.min(1, t.current + delta / duration);
    // ease-out cubic: early epochs (where the big structure forms) read slowly,
    // the tail glides in rather than clipping.
    const e = 1 - Math.pow(1 - t.current, 3);
    const pos = e * (frames.length - 1);
    const i = Math.min(frames.length - 2, Math.floor(pos));
    const frac = pos - i;
    const a = frames[i];
    const b = frames[i + 1];
    for (let idx = 0; idx < channels.length; idx++) {
      const g = groups.get(channels[idx].id);
      if (!g || !a[idx] || !b[idx]) continue;
      g.position.set(
        (a[idx][0] + (b[idx][0] - a[idx][0]) * frac) * COORD_SCALE,
        (a[idx][1] + (b[idx][1] - a[idx][1]) * frac) * COORD_SCALE,
        (a[idx][2] + (b[idx][2] - a[idx][2]) * frac) * COORD_SCALE
      );
    }
    if (t.current >= 1) {
      done.current = true;
      onDone();
    }
  });
  return null;
};

const Scene = ({
  channels,
  activeChannel,
  searchQuery,
  reveal,
  epochFrames,
  epochDuration,
  onCondensed,
  constellations,
  constellationsDimmed,
  onSelectChannel,
  onBlackHoleClick,
  resetSignal,
  onOverviewRequest,
}: GalaxyProps) => {
  const searchActive = searchQuery.length > 0;
  const query = searchQuery.toLowerCase();

  const starGroups = useMemo(() => new Map<string, THREE.Group>(), []);
  const [condensed, setCondensed] = useState(!epochFrames?.length);
  // A NEW frames array (B2: preview condensation, then the enrichment settle)
  // restarts playback; same-identity re-renders don't.
  useEffect(() => {
    setCondensed(!epochFrames?.length);
  }, [epochFrames]);
  const registerGroup = useCallback(
    (id: string, group: THREE.Group | null) => {
      if (group) starGroups.set(id, group);
      else starGroups.delete(id);
    },
    [starGroups]
  );
  const handleCondensed = useCallback(() => {
    setCondensed(true);
    onCondensed?.();
  }, [onCondensed]);
  const driving = !condensed && !!epochFrames?.length;

  const cameraTarget: [number, number, number] | null = activeChannel
    ? [activeChannel.x * COORD_SCALE, activeChannel.y * COORD_SCALE, activeChannel.z * COORD_SCALE]
    : null;

  const activeNeighborSet = useMemo(
    () => new Set(activeChannel?.neighbors ?? []),
    [activeChannel]
  );

  const neighborLines = useMemo(() => {
    if (!activeChannel) return [];
    return activeChannel.neighbors.flatMap((nId) => {
      const n = channels.find((c) => c.id === nId);
      if (!n) return [];
      return [{
        key: nId,
        points: [
          [activeChannel.x * COORD_SCALE, activeChannel.y * COORD_SCALE, activeChannel.z * COORD_SCALE] as [number, number, number],
          [n.x * COORD_SCALE, n.y * COORD_SCALE, n.z * COORD_SCALE] as [number, number, number],
        ],
      }];
    });
  }, [activeChannel, channels]);

  return (
    <>
      <fog attach="fog" args={["#000004", 36, 110]} />
      <ambientLight intensity={0.04} />

      {/* Backdrop sphere — double-click anywhere in empty space to return to overview */}
      <mesh onDoubleClick={(e) => { e.stopPropagation(); onOverviewRequest(); }}>
        <sphereGeometry args={[200, 8, 8]} />
        <meshBasicMaterial side={THREE.BackSide} transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Anchored backdrop: deep field stars + nebulas — no rotation, no shimmer */}
      {/* Backdrop thinned so CHANNEL stars are the brightest thing in frame —
          the near layer especially was competing with real channels. */}
      <Stars radius={280} depth={180} count={11000} factor={0.6}  saturation={0} fade speed={0} />
      <Stars radius={200} depth={120} count={5200}  factor={1.25} saturation={0} fade speed={0} />
      <Stars radius={85}  depth={55}  count={1400}  factor={0.85} saturation={0} fade speed={0} />
      <NebulaLayer />

      <SupportStars channels={channels} />

      <BlackHole onClick={onBlackHoleClick} />

      {/* Semantic filaments — visible only when a channel is selected */}
      {neighborLines.map(({ key, points }) => (
        <Line
          key={key}
          points={points}
          color="#8899aa"
          lineWidth={0.4}
          transparent
          opacity={0.07}
        />
      ))}

      {channels.map((ch) => (
        <Star
          key={ch.id}
          channel={ch}
          isActive={activeChannel?.id === ch.id}
          isFiltered={ch.title.toLowerCase().includes(query)}
          searchActive={searchActive}
          isNeighbor={activeNeighborSet.has(ch.id)}
          reveal={reveal && !epochFrames?.length}
          positionDriven={driving}
          registerGroup={epochFrames?.length ? registerGroup : undefined}
          onClick={onSelectChannel}
        />
      ))}

      {driving && epochFrames && (
        <EpochDriver
          key={epochFrames.length + "-" + channels.length}
          frames={epochFrames}
          channels={channels}
          groups={starGroups}
          duration={epochDuration}
          onDone={handleCondensed}
        />
      )}

      {/* Named regions, in the galaxy itself — only once it has settled */}
      {condensed && !!constellations?.length && (
        <ConstellationLabels
          constellations={constellations}
          channels={channels}
          dimmed={!!constellationsDimmed}
          onSelect={onSelectChannel}
        />
      )}

      <CameraController target={cameraTarget} resetSignal={resetSignal} />

      <OrbitControls
        makeDefault
        enablePan
        panSpeed={0.4}
        enableZoom
        enableRotate
        dampingFactor={0.18}
        rotateSpeed={0.30}
        zoomSpeed={0.65}
        minDistance={3}
        maxDistance={120}
        enableDamping
        minPolarAngle={0.05}
        maxPolarAngle={Math.PI - 0.05}
      />

      <EffectComposer>
        <Bloom
          luminanceThreshold={0.015}
          luminanceSmoothing={0.92}
          intensity={1.65}
          radius={0.68}
        />
        <Vignette offset={0.18} darkness={0.90} />
        <Noise opacity={0.016} />
      </EffectComposer>
    </>
  );
};

const Galaxy = (props: GalaxyProps) => (
  <Canvas
    camera={{ position: OVERVIEW_CAMERA.position, fov: 58 }}
    style={{ background: "transparent" }}
    gl={{ antialias: true }}
  >
    <Scene {...props} />
  </Canvas>
);

export default Galaxy;
