import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { Channel } from "@/types/channel";

interface StarProps {
  channel: Channel;
  isActive: boolean;
  isFiltered: boolean;
  searchActive: boolean;
  onClick: (channel: Channel) => void;
}

const Star = ({ channel, isActive, isFiltered, searchActive, onClick }: StarProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const baseY = channel.y;
  const offset = channel.x * 100 + channel.z * 37;

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();
    meshRef.current.position.y = baseY + Math.sin(t * 0.4 + offset) * 0.15;

    const targetScale = hovered || isActive ? 1.6 : 1;
    meshRef.current.scale.lerp(
      new THREE.Vector3(targetScale, targetScale, targetScale),
      0.1
    );
  });

  const opacity = searchActive && !isFiltered ? 0.06 : 1;
  // Slightly warm white for active, cool blue-white for hovered, pure white default
  const starColor = isActive ? "#e8f0ff" : hovered ? "#c8d8ff" : "#ffffff";
  const emissiveIntensity = isActive ? 2.5 : hovered ? 2 : 1.2;

  return (
    <mesh
      ref={meshRef}
      position={[channel.x, channel.y, channel.z]}
      onClick={(e) => {
        e.stopPropagation();
        onClick(channel);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "auto";
      }}
    >
      <sphereGeometry args={[channel.size * 0.12, 16, 16]} />
      <meshStandardMaterial
        color={starColor}
        emissive={starColor}
        emissiveIntensity={emissiveIntensity}
        transparent
        opacity={opacity}
        toneMapped={false}
      />
      {hovered && opacity > 0.5 && (
        <Html distanceFactor={12} center style={{ pointerEvents: "none" }}>
          <div className="whitespace-nowrap rounded-md bg-black/80 px-3 py-1.5 text-xs text-white backdrop-blur-sm border border-white/10">
            {channel.title}
          </div>
        </Html>
      )}
    </mesh>
  );
};

export default Star;
