import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial, OrbitControls, PerspectiveCamera, Sparkles } from "@react-three/drei";
import { useRef } from "react";
import type { Group, Mesh } from "three";

function EnergyCore() {
  const shellRef = useRef<Mesh>(null);
  const ringRef = useRef<Group>(null);

  useFrame((state) => {
    const elapsed = state.clock.getElapsedTime();

    if (shellRef.current) {
      shellRef.current.rotation.x = elapsed * 0.18;
      shellRef.current.rotation.y = elapsed * 0.3;
    }

    if (ringRef.current) {
      ringRef.current.rotation.z = elapsed * 0.24;
      ringRef.current.rotation.x = Math.sin(elapsed * 0.3) * 0.25;
    }
  });

  return (
    <group>
      <Float speed={2.2} rotationIntensity={1.2} floatIntensity={1.5}>
        <mesh ref={shellRef} castShadow receiveShadow>
          <icosahedronGeometry args={[1.25, 12]} />
          <MeshDistortMaterial
            color="#f97316"
            emissive="#fb7185"
            emissiveIntensity={1.4}
            roughness={0.08}
            metalness={0.5}
            distort={0.35}
            speed={2.4}
          />
        </mesh>
      </Float>

      <group ref={ringRef}>
        <mesh rotation={[1.2, 0.2, 0]}>
          <torusGeometry args={[2.15, 0.045, 32, 160]} />
          <meshStandardMaterial color="#fdba74" emissive="#f97316" emissiveIntensity={1.1} />
        </mesh>
        <mesh rotation={[0.25, 0.9, 1]}>
          <torusGeometry args={[1.7, 0.035, 24, 120]} />
          <meshStandardMaterial color="#67e8f9" emissive="#22d3ee" emissiveIntensity={0.9} />
        </mesh>
      </group>
    </group>
  );
}

export function HeroScene() {
  return (
    <Canvas dpr={[1, 2]} shadows>
      <color attach="background" args={["#09090b"]} />
      <fog attach="fog" args={["#09090b", 5, 12]} />
      <PerspectiveCamera makeDefault position={[0, 0, 6]} fov={42} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[3, 4, 2]} intensity={2.2} castShadow color="#fff7ed" />
      <pointLight position={[-3, -2, 2]} intensity={16} color="#22d3ee" />
      <pointLight position={[3, 1, -2]} intensity={14} color="#fb7185" />
      <Sparkles count={90} scale={8} size={3} speed={0.6} color="#fff7ed" />
      <EnergyCore />
      <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.65} />
    </Canvas>
  );
}
