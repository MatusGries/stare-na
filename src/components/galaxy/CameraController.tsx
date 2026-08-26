// CameraController.tsx
// Handles two animations:
//   1. Fly to a selected star (approach from current viewing direction)
//   2. Return to galaxy overview (triggered by resetSignal increment)

import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { OVERVIEW_CAMERA, FOCUS_DISTANCE } from "./constants";

interface CameraControllerProps {
  /** World-space position of the selected star, or null for free orbit. */
  target: [number, number, number] | null;
  /** Increment this to trigger a return-to-overview animation. */
  resetSignal: number;
}

const CameraController = ({ target, resetSignal }: CameraControllerProps) => {
  const { camera, controls } = useThree();
  const animating = useRef(false);
  const camDest = useRef(new THREE.Vector3());
  const lookDest = useRef(new THREE.Vector3());
  const lerpK = useRef(0.038);

  // Approach selected star from current viewing direction — preserves orientation
  useEffect(() => {
    if (!target) { animating.current = false; return; }

    const tgt = new THREE.Vector3(target[0], target[1], target[2]);

    // Direction from target back to camera (where camera currently is relative to star)
    const dir = camera.position.clone().sub(tgt);
    const dist = dir.length();

    if (dist > FOCUS_DISTANCE * 0.6) {
      // Maintain current viewing angle, just move to FOCUS_DISTANCE from star
      dir.normalize().multiplyScalar(FOCUS_DISTANCE);
    } else {
      // Already close — pull back to a comfortable distance from current position
      dir.normalize().multiplyScalar(FOCUS_DISTANCE);
    }

    camDest.current.copy(tgt).add(dir);
    lookDest.current.copy(tgt);
    lerpK.current = 0.040;
    animating.current = true;
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps

  // Return to overview — slower lerp for a more expansive feeling
  useEffect(() => {
    if (resetSignal <= 0) return;
    camDest.current.set(...OVERVIEW_CAMERA.position);
    lookDest.current.set(...OVERVIEW_CAMERA.target);
    lerpK.current = 0.026;
    animating.current = true;
  }, [resetSignal]);

  // Abort any in-flight camera animation the moment the user grabs the controls
  // — otherwise useFrame keeps lerping and fights their drag/rotate input.
  useEffect(() => {
    const ctrl = controls as any;
    if (!ctrl?.addEventListener) return;
    const abort = () => { animating.current = false; };
    ctrl.addEventListener("start", abort);
    return () => ctrl.removeEventListener("start", abort);
  }, [controls]);

  useFrame((_, delta) => {
    if (!animating.current) return;

    // Frame-rate independent: same speed at 30fps and 144fps
    const k = 1 - Math.pow(1 - lerpK.current, delta * 60);
    camera.position.lerp(camDest.current, k);

    const ctrl = controls as any;
    if (ctrl?.target) {
      ctrl.target.lerp(lookDest.current, k);
      ctrl.update?.();
    }

    if (camera.position.distanceTo(camDest.current) < 0.08) {
      camera.position.copy(camDest.current);
      if (ctrl?.target) ctrl.target.copy(lookDest.current);
      animating.current = false;
    }
  });

  return null;
};

export default CameraController;
