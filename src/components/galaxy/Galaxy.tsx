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
      <fog attach="fog" args={["#0a0a1a", 15, 45]} />
      <ambientLight intensity={0.15} />

      <Stars radius={80} depth={60} count={3000} factor={3} saturation={0} fade speed={0.5} />

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
        enablePan
        enableZoom
        enableRotate
        dampingFactor={0.05}
        minDistance={3}
        maxDistance={50}
        enableDamping
      />

      <EffectComposer>
        <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.9} intensity={1.5} radius={0.8} />
      </EffectComposer>
    </Canvas>
  );
};

export default Galaxy;
