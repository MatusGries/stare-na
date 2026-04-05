import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

interface CameraControllerProps {
  target: [number, number, number] | null;
}

const CameraController = ({ target }: CameraControllerProps) => {
  const { camera } = useThree();
  const targetPos = useRef(new THREE.Vector3(0, 0, 20));

  useFrame(() => {
    if (target) {
      const dest = new THREE.Vector3(target[0], target[1], target[2] + 5);
      targetPos.current.lerp(dest, 0.03);
    } else {
      targetPos.current.lerp(new THREE.Vector3(0, 0, 20), 0.02);
    }
    camera.position.lerp(targetPos.current, 0.05);
  });

  return null;
};

export default CameraController;
