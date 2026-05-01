import { useRef, useMemo } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars, Line } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, Noise } from "@react-three/postprocessing";
import Star from "./Star";
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
  onSelectChannel: (channel: Channel) => void;
  onBlackHoleClick: () => void;
  resetSignal: number;
  onOverviewRequest: () => void;
}

const Scene = ({
  channels,
  activeChannel,
  searchQuery,
  onSelectChannel,
  onBlackHoleClick,
  resetSignal,
  onOverviewRequest,
}: GalaxyProps) => {
  const searchActive = searchQuery.length > 0;
  const query = searchQuery.toLowerCase();

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

  // Backdrop group rotates imperceptibly — nebulas and deep field drift while
  // the semantic galaxy stays anchored to the embedding coordinates.
  const backdropRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (backdropRef.current) {
      backdropRef.current.rotation.y = clock.getElapsedTime() * 0.0015;
    }
  });

  return (
    <>
      <fog attach="fog" args={["#000004", 36, 110]} />
      <ambientLight intensity={0.04} />

      {/* Backdrop sphere — double-click anywhere in empty space to return to overview */}
      <mesh onDoubleClick={(e) => { e.stopPropagation(); onOverviewRequest(); }}>
        <sphereGeometry args={[200, 8, 8]} />
        <meshBasicMaterial side={THREE.BackSide} transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Slowly drifting backdrop: deep field stars + nebulas */}
      <group ref={backdropRef}>
        {/* Ultra-deep field — very dense, barely visible */}
        <Stars radius={280} depth={180} count={14000} factor={0.65} saturation={0} fade speed={0.02} />
        {/* Deep field — Milky Way density */}
        <Stars radius={200} depth={120} count={7500} factor={1.6} saturation={0} fade speed={0.10} />
        {/* Mid field */}
        <Stars radius={85}  depth={55}  count={2800} factor={1.05} saturation={0} fade speed={0.06} />
        <NebulaLayer />
      </group>

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
          onClick={onSelectChannel}
        />
      ))}

      <CameraController target={cameraTarget} resetSignal={resetSignal} />

      <OrbitControls
        makeDefault
        enablePan
        panSpeed={0.4}
        enableZoom
        enableRotate
        dampingFactor={0.055}
        rotateSpeed={0.35}
        zoomSpeed={0.7}
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
