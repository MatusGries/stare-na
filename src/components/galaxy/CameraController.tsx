// CameraController.tsx
// Animates camera + controls.target toward selected star.
// When no star is selected, hands full control back to OrbitControls.
import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

interface CameraControllerProps {
  target: [number, number, number] | null;
}

const CameraController = ({ target }: CameraControllerProps) => {
  const { camera, controls } = useThree();
  const animating = useRef(false);
  const camDest = useRef(new THREE.Vector3());
  const lookDest = useRef(new THREE.Vector3());

  useEffect(() => {
    if (target) {
      camDest.current.set(target[0], target[1], target[2] + 6);
      lookDest.current.set(target[0], target[1], target[2]);
      animating.current = true;
    } else {
      animating.current = false;
    }
  }, [target]);

  useFrame(() => {
    if (!animating.current) return;

    camera.position.lerp(camDest.current, 0.04);

    // lerp OrbitControls target if available (makeDefault registers it)
    const ctrl = controls as any;
    if (ctrl?.target) {
      ctrl.target.lerp(lookDest.current, 0.04);
      ctrl.update?.();
    }

    // Stop when close enough so user can freely orbit after
    if (camera.position.distanceTo(camDest.current) < 0.05) {
      camera.position.copy(camDest.current);
      animating.current = false;
    }
  });

  return null;
};

export default CameraController;
