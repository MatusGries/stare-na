// Regression test for FINDING-011: star hit spheres (7e22e48) shadowed the
// black hole from the default camera angle, making the profile panel
// unreachable by click. biasedRaycast gives the core an 8-unit distance
// advantage so clicks inside its glare zone open the profile, while stars
// clearly in front of the glare still win.
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { biasedRaycast } from "@/components/galaxy/BlackHole";

const sphere = (radius: number, z: number) => {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 8, 8),
    new THREE.MeshBasicMaterial()
  );
  m.position.set(0, 0, z);
  m.updateMatrixWorld();
  return m;
};

const rayFromFront = () =>
  new THREE.Raycaster(new THREE.Vector3(0, 0, 50), new THREE.Vector3(0, 0, -1));

describe("biasedRaycast (FINDING-011)", () => {
  it("black hole wins against a star grazing the ray inside the glare zone", () => {
    // Mirrors the real geometry: "anything beautiful" sits ~5.5 units from origin
    const star = sphere(0.5, 5);
    const hole = sphere(2.2, 0);
    hole.raycast = biasedRaycast;

    const hits = rayFromFront().intersectObjects([star, hole], false);
    expect(hits.length).toBeGreaterThanOrEqual(2);
    expect(hits[0].object).toBe(hole);
  });

  it("a star well in front of the glare zone still wins", () => {
    const star = sphere(0.5, 20); // 20 units in front — visually a separate object
    const hole = sphere(2.2, 0);
    hole.raycast = biasedRaycast;

    const hits = rayFromFront().intersectObjects([star, hole], false);
    expect(hits[0].object).toBe(star);
  });

  it("biased distance never goes negative", () => {
    const hole = sphere(2.2, 0);
    hole.raycast = biasedRaycast;
    const nearRay = new THREE.Raycaster(
      new THREE.Vector3(0, 0, 4),
      new THREE.Vector3(0, 0, -1)
    );
    const hits = nearRay.intersectObjects([hole], false);
    expect(hits.length).toBeGreaterThan(0);
    for (const h of hits) expect(h.distance).toBeGreaterThanOrEqual(0);
  });
});
