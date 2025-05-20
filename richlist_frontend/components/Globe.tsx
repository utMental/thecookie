// richlist_frontend/components/Globe.tsx (Full-featured version)

import React, { useRef, Suspense, useMemo } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, Stars, Html } from '@react-three/drei';
import * as THREE from 'three';

// Ensure this interface is exported for index.tsx
export interface Location {
  lat: number;
  lng: number;
  owner: string;
  locationLabel: string | undefined;
}

interface GlobeComponentProps {
  locations: Location[];
}

const latLngToVector3 = (lat: number, lng: number, radius: number): [number, number, number] => {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  return [x, y, z];
};

const LocationPin: React.FC<{ position: [number, number, number]; owner?: string; locationLabel?: string }> = ({ position, owner, locationLabel }) => {
  const [hovered, setHover] = React.useState(false);
  const pinColor = hovered ? "orange" : "red";

  return (
    <mesh position={position} onPointerOver={() => setHover(true)} onPointerOut={() => setHover(false)}>
      <sphereGeometry args={[0.05, 16, 16]} />
      <meshStandardMaterial
        color={pinColor}
        emissive={hovered ? "orange" : pinColor}
        emissiveIntensity={hovered ? 0.8 : 0.3}
        metalness={0.3}
        roughness={0.5}
      />
      {hovered && (
        <Html distanceFactor={6} center zIndexRange={[100,0]}>
          <div style={{
            background: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '6px 10px',
            borderRadius: '4px',
            fontSize: '12px',
            whiteSpace: 'nowrap',
            transform: 'translateY(-100%)',
            userSelect: 'none',
          }}>
            {owner && <strong>{owner}</strong>}
            {owner && locationLabel && <br />}
            {locationLabel || (!owner && 'Location')}
          </div>
        </Html>
      )}
    </mesh>
  );
};

const Earth: React.FC<{ locations: Location[]; earthRadius: number }> = ({ locations, earthRadius }) => {
  const earthGroupRef = useRef<THREE.Group>(null!); // Changed to group ref
  const texture = useLoader(THREE.TextureLoader, '/assets/globe/earth-day.jpg'); // Your correct path

  useFrame(() => {
    if (earthGroupRef.current) {
      earthGroupRef.current.rotation.y += 0.0005;
    }
  });

  const pins = useMemo(() => {
    return locations.map((loc, index) => {
      if (typeof loc.lat === 'number' && typeof loc.lng === 'number') {
        const position = latLngToVector3(loc.lat, loc.lng, earthRadius);
        return <LocationPin key={`${loc.lat}-${loc.lng}-${index}`} position={position} owner={loc.owner} locationLabel={loc.locationLabel} />;
      }
      return null;
    });
  }, [locations, earthRadius]);

  return (
    <group ref={earthGroupRef}>
      <mesh>
        <sphereGeometry args={[earthRadius, 64, 64]} />
        <meshStandardMaterial map={texture} roughness={0.7} metalness={0.1} />
      </mesh>
      {pins}
    </group>
  );
};

const GlobeComponent: React.FC<GlobeComponentProps> = ({ locations }) => {
  const earthDisplayRadius = 2.5;
  console.log('FULL GlobeComponent rendering. Locations:', locations);


  return (
    <div style={{ width: '100%', height: '100%', background: 'black' }}>
      <Canvas camera={{ position: [0, 0, earthDisplayRadius * 2.2], fov: 50 }}>
        <Suspense fallback={<Html center><p style={{color: 'white', background: 'rgba(0,0,0,0.5)', padding: '10px', borderRadius: '5px'}}>Loading 3D Assets...</p></Html>}>
          <ambientLight intensity={0.3} />
          <pointLight position={[earthDisplayRadius + 5, earthDisplayRadius + 5, earthDisplayRadius + 5]} intensity={1.7} decay={2} />
          <Stars radius={earthDisplayRadius * 30} depth={60} count={10000} factor={5} saturation={0} fade speed={0.3} />
          <Earth locations={locations} earthRadius={earthDisplayRadius} />
          <OrbitControls 
            enableZoom={true} 
            enablePan={true} 
            minDistance={earthDisplayRadius * 1.15}
            maxDistance={earthDisplayRadius * 6}
            autoRotate={false}
          />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default GlobeComponent;