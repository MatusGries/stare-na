import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";

interface BlackHoleProps {
  onClick: () => void;
}

const BlackHole = ({ onClick }: BlackHoleProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const innerRingRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ringRef.current) ringRef.current.rotation.z = t * 0.15;
    if (innerRingRef.current) innerRingRef.current.rotation.z = -t * 0.3;
    if (groupRef.current) {
      groupRef.current.scale.setScalar(1 + Math.sin(t * 0.8) * 0.03);
    }
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]} onClick={(e) => { e.stopPropagation(); onClick(); }}>
      {/* Core sphere — dark void */}
      <mesh
        onPointerOver={() => { document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { document.body.style.cursor = "auto"; }}
      >
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial color="#000000" emissive="#1a0a2e" emissiveIntensity={0.3} />
      </mesh>

      {/* Accretion disk — outer ring */}
      <mesh ref={ringRef} rotation={[Math.PI / 2.5, 0, 0]}>
        <torusGeometry args={[1.0, 0.12, 16, 64]} />
        <meshStandardMaterial
          color="#7c3aed"
          emissive="#a855f7"
          emissiveIntensity={2}
          transparent
          opacity={0.7}
          toneMapped={false}
        />
      </mesh>

      {/* Inner accretion ring */}
      <mesh ref={innerRingRef} rotation={[Math.PI / 2.2, 0.2, 0]}>
        <torusGeometry args={[0.72, 0.06, 16, 64]} />
        <meshStandardMaterial
          color="#c084fc"
          emissive="#e9d5ff"
          emissiveIntensity={3}
          transparent
          opacity={0.5}
          toneMapped={false}
        />
      </mesh>

      {/* Glow sphere */}
      <mesh>
        <sphereGeometry args={[1.3, 32, 32]} />
        <meshStandardMaterial
          color="#4c1d95"
          emissive="#7c3aed"
          emissiveIntensity={0.8}
          transparent
          opacity={0.08}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
};

export default BlackHole;
