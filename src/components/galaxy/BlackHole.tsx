import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface BlackHoleProps {
  onClick: () => void;
}

function ringGeo(rIn: number, rOut: number, tSeg = 128, rSeg = 24) {
  const verts: number[] = [], uvs: number[] = [], idx: number[] = [];
  for (let j = 0; j <= rSeg; j++) {
    const r = rIn + (rOut - rIn) * (j / rSeg);
    for (let i = 0; i <= tSeg; i++) {
      const a = (i / tSeg) * Math.PI * 2;
      verts.push(Math.cos(a) * r, Math.sin(a) * r, 0);
      uvs.push(j / rSeg, i / tSeg);
    }
  }
  for (let j = 0; j < rSeg; j++) {
    for (let i = 0; i < tSeg; i++) {
      const a = j * (tSeg + 1) + i;
      const b = (j + 1) * (tSeg + 1) + i;
      const c = (j + 1) * (tSeg + 1) + i + 1;
      const d = j * (tSeg + 1) + i + 1;
      idx.push(a, b, d, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  return g;
}

const DISK_VERT = `varying vec2 vUv;
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;

const DISK_FRAG = `
uniform float uTime;
uniform float uSpeed;
varying vec2 vUv;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){
  vec2 i=floor(p),f=fract(p);
  f=f*f*(3.-2.*f);
  return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);
}
float fbm(vec2 p){return n(p)*.5+n(p*2.+1.7)*.25+n(p*4.+3.3)*.125+n(p*8.+5.7)*.0625;}
void main(){
  float r=vUv.x;
  float ang=vUv.y;
  float swirl=ang*6.2832+uTime*uSpeed*(1.0-r*.75);
  vec2 nc=vec2(cos(swirl),sin(swirl))*(r*2.2+.4)+uTime*.07;
  float t1=fbm(nc);
  float t2=fbm(nc*1.8+vec2(4.1,2.3));
  vec3 c1=vec3(1.00,.94,.76);
  vec3 c2=vec3(.98,.50,.07);
  vec3 c3=vec3(.52,.15,.02);
  vec3 c4=vec3(.11,.03,.00);
  vec3 col;
  if(r<.33)col=mix(c1,c2,r/.33);
  else if(r<.66)col=mix(c2,c3,(r-.33)/.33);
  else col=mix(c3,c4,(r-.66)/.34);
  col*=.32+t1*1.4+t2*.28;
  float alpha=(0.42+t1*.78+t2*.18)
    *smoothstep(0.,.07,r)*smoothstep(1.,.52,r);
  alpha=clamp(alpha*.9,0.,1.);
  gl_FragColor=vec4(col,alpha);
}`;

function useDiskMat(speed: number) {
  return useMemo(() => new THREE.ShaderMaterial({
    vertexShader: DISK_VERT,
    fragmentShader: DISK_FRAG,
    uniforms: { uTime: { value: 0 }, uSpeed: { value: speed } },
    transparent: true,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  }), [speed]);
}

// Clicks landing inside the core's glare zone belong to the black hole, even when
// a near-core star's invisible hit sphere grazes the same ray slightly closer.
// Bias 8 ≈ the glare radius: stars >8 units in front still win (they read as
// separate objects); stars inside the glare lose to the core they're hidden behind.
function biasedRaycast(this: THREE.Mesh, raycaster: THREE.Raycaster, intersects: THREE.Intersection[]) {
  const hits: THREE.Intersection[] = [];
  THREE.Mesh.prototype.raycast.call(this, raycaster, hits);
  for (const h of hits) {
    h.distance = Math.max(0, h.distance - 8);
    intersects.push(h);
  }
}

const BlackHole = ({ onClick }: BlackHoleProps) => {
  const photonRef = useRef<THREE.Mesh>(null);
  const innerRef  = useRef<THREE.Mesh>(null);
  const outerRef  = useRef<THREE.Mesh>(null);
  const innerMat  = useDiskMat(0.48);
  const outerMat  = useDiskMat(0.16);

  const innerGeo = useMemo(() => ringGeo(0.86, 2.0, 128, 28), []);
  const outerGeo = useMemo(() => ringGeo(1.9,  3.2, 128, 16), []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (photonRef.current) photonRef.current.rotation.z = -t * 0.22;
    if (innerRef.current)  innerRef.current.rotation.z  =  t * 0.09;
    if (outerRef.current)  outerRef.current.rotation.z  =  t * 0.04;
    innerMat.uniforms.uTime.value = t;
    outerMat.uniforms.uTime.value = t;
  });

  return (
    <group
      position={[0, 0, 0]}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onPointerOver={() => { document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { document.body.style.cursor = "auto"; }}
    >
      <mesh>
        <sphereGeometry args={[0.72, 48, 48]} />
        <meshBasicMaterial color="#000000" />
      </mesh>

      <mesh>
        <sphereGeometry args={[1.85, 32, 32]} />
        <meshBasicMaterial color="#010208" transparent opacity={0.20} side={THREE.BackSide} />
      </mesh>

      <mesh>
        <sphereGeometry args={[4, 16, 16]} />
        <meshBasicMaterial color="#c87822" transparent opacity={0.018} side={THREE.BackSide} toneMapped={false} />
      </mesh>

      <mesh ref={photonRef} rotation={[Math.PI / 2.08, 0.16, 0]}>
        <torusGeometry args={[0.94, 0.016, 16, 200]} />
        <meshStandardMaterial
          color="#ffffff" emissive="#d0e8ff" emissiveIntensity={7}
          transparent opacity={0.92} toneMapped={false}
        />
      </mesh>

      <mesh ref={innerRef} geometry={innerGeo} material={innerMat}
        rotation={[Math.PI / 2 - 0.26, 0.06, 0]} />

      <mesh ref={outerRef} geometry={outerGeo} material={outerMat}
        rotation={[Math.PI / 2 - 0.30, -0.05, 0]} />

      <mesh raycast={biasedRaycast}>
        <sphereGeometry args={[2.2, 12, 12]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  );
};

export default BlackHole;
