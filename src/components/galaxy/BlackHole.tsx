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
      {/* Core — absolute void */}
      <mesh
        onPointerOver={() => { document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { document.body.style.cursor = "auto"; }}
      >
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial color="#000000" emissive="#000000" emissiveIntensity={0} />
      </mesh>

      {/* Photon ring — hot blue-white, closest to event horizon */}
      <mesh ref={innerRingRef} rotation={[Math.PI / 2.2, 0.2, 0]}>
        <torusGeometry args={[0.65, 0.03, 16, 128]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#d0e8ff"
          emissiveIntensity={4}
          transparent
          opacity={0.9}
          toneMapped={false}
        />
      </mesh>

      {/* Accretion disk — outer, dimmer grey-white */}
      <mesh ref={ringRef} rotation={[Math.PI / 2.5, 0, 0]}>
        <torusGeometry args={[1.0, 0.08, 16, 128]} />
        <meshStandardMaterial
          color="#aabbcc"
          emissive="#8899aa"
          emissiveIntensity={1.2}
          transparent
          opacity={0.5}
          toneMapped={false}
        />
      </mesh>

      {/* Gravitational lensing glow — very subtle grey halo */}
      <mesh>
        <sphereGeometry args={[1.4, 32, 32]} />
        <meshStandardMaterial
          color="#111111"
          emissive="#334455"
          emissiveIntensity={0.4}
          transparent
          opacity={0.06}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
};

export default BlackHole;
