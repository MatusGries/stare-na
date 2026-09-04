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
  /** How far to sit from `target`. Defaults to FOCUS_DISTANCE (one star);
   *  a constellation passes a larger distance so the whole cluster frames. */
  distance?: number;
  /** Increment this to trigger a return-to-overview animation. */
  resetSignal: number;
}

const CameraController = ({ target, distance, resetSignal }: CameraControllerProps) => {
  const { camera, controls } = useThree();
  const animating = useRef(false);
  const camDest = useRef(new THREE.Vector3());
  const lookDest = useRef(new THREE.Vector3());
  const lerpK = useRef(0.038);

  // Approach the target from the current viewing direction — preserves
  // orientation, so a fly-to never disorients. `distance` sets how far to
  // stop: one star (FOCUS_DISTANCE) or a whole constellation (framed).
  const targetKey = target ? target.join(",") : "";
  useEffect(() => {
    if (!target) { animating.current = false; return; }

    const stop = distance ?? FOCUS_DISTANCE;
    const tgt = new THREE.Vector3(target[0], target[1], target[2]);

    // Direction from target back to camera, normalized to the stop distance
    const dir = camera.position.clone().sub(tgt);
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1); // degenerate: camera on target
    dir.normalize().multiplyScalar(stop);

    camDest.current.copy(tgt).add(dir);
    lookDest.current.copy(tgt);
    lerpK.current = 0.040;
    animating.current = true;
  }, [targetKey, distance]); // eslint-disable-line react-hooks/exhaustive-deps

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
