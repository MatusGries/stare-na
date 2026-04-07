import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import Star from "./Star";
import BlackHole from "./BlackHole";
import CameraController from "./CameraController";
import type { Channel } from "@/types/channel";

interface GalaxyProps {
  channels: Channel[];
  activeChannel: Channel | null;
  searchQuery: string;
  onSelectChannel: (channel: Channel) => void;
  onBlackHoleClick: () => void;
}

const Galaxy = ({ channels, activeChannel, searchQuery, onSelectChannel, onBlackHoleClick }: GalaxyProps) => {
  const searchActive = searchQuery.length > 0;
  const query = searchQuery.toLowerCase();

  const cameraTarget: [number, number, number] | null = activeChannel
    ? [activeChannel.x, activeChannel.y, activeChannel.z]
    : null;

  return (
    <Canvas camera={{ position: [0, 0, 20], fov: 60 }} style={{ background: "transparent" }}>
      <fog attach="fog" args={["#000000", 30, 80]} />
      <ambientLight intensity={0.08} />

      {/* Deep background stars — dense Milky Way layer */}
      <Stars radius={200} depth={120} count={8000} factor={2} saturation={0} fade speed={0.2} />
      {/* Mid-field stars */}
      <Stars radius={100} depth={80} count={5000} factor={1.5} saturation={0} fade speed={0.15} />

      <BlackHole onClick={onBlackHoleClick} />

      {channels.map((ch) => (
        <Star
          key={ch.id}
          channel={ch}
          isActive={activeChannel?.id === ch.id}
          isFiltered={ch.title.toLowerCase().includes(query)}
          searchActive={searchActive}
          onClick={onSelectChannel}
        />
      ))}

      <CameraController target={cameraTarget} />
      <OrbitControls
        makeDefault
        enablePan
        enableZoom
        enableRotate
        dampingFactor={0.05}
        rotateSpeed={0.6}
        zoomSpeed={1.2}
        panSpeed={0.8}
        minDistance={2}
        maxDistance={60}
        enableDamping
      />

      <EffectComposer>
        <Bloom luminanceThreshold={0.3} luminanceSmoothing={0.7} intensity={0.8} radius={0.4} />
      </EffectComposer>
    </Canvas>
  );
};

export default Galaxy;
