import Head from 'next/head';
import { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
// Import the TYPE of ThreeGlobe for better type safety for the window object
import { gsap } from 'gsap';
import type ActualThreeGlobe from 'three-globe';

// Extend the Window interface to inform TypeScript about myGlobeInstance
declare global {
  interface Window {
    myGlobeInstance?: ActualThreeGlobe;
  }
}

// This component will contain all client-side Three.js and ThreeGlobe logic
const ClientSideGlobe = () => {
  const containerRef = useRef<HTMLDivElement>(null); // Ref for the container div
  const canvasRef = useRef<HTMLCanvasElement>(null); // Ref for the canvas element

  useEffect(() => {
    // This function will contain all the client-side setup
    let cleanupFunction: (() => void) | undefined;
    let isMounted = true; // Flag to prevent updates if component unmounts during async ops

    const initGlobe = async () => {
      if (!containerRef.current || !canvasRef.current || window.myGlobeInstance) {
        if (window.myGlobeInstance) {
          console.log('Globe useEffect: Globe already initialized.');
        } else if (!containerRef.current || !canvasRef.current) {
          console.log('Globe useEffect: Container not ready.');
        }
        return; // Exit if container not ready or globe already initialized
      }

      const globeContainer = globeContainer.current;
      console.log('Globe useEffect: Dynamically importing THREE, ThreeGlobe, and TrackballControls...');

      const canvas = canvasRef.current; // Get the canvas element from the ref

      try {
        const THREE = await import('three');
        const ThreeGlobeModule = await import('three-globe');
        const ThreeGlobe = ThreeGlobeModule.default; // This should be the constructor
        const { TrackballControls } = await import('three/examples/jsm/controls/TrackballControls.js');

        console.log('Globe useEffect: Modules imported. Initializing ThreeGlobe instance...');

        // Check if component is still mounted before proceeding
         if (!isMounted || !containerRef.current || !canvasRef.current) { // Re-check refs here
            console.log('Globe useEffect: Component unmounted or container ref lost before init.');
            return;
        }
        
        if (!ThreeGlobe) {
          console.error("Globe useEffect: ThreeGlobe constructor is not loaded!");
          return;
        }

        const globeInstance = new ThreeGlobe({
          waitForGlobeReady: true, // Wait for textures/materials
          animateIn: true,      // Enable built-in intro animation
        })
        // .globeImageUrl('/assets/globe/earth-dark.jpg') // Remove image texture
        // .bumpImageUrl('/assets/globe/earth-topology.png') // Remove bump map
        .globeMaterial(new THREE.MeshPhongMaterial({ // Set a basic material
          color: 0x111122, // Dark blue/purpleish
          specular: 0x080808,
          shininess: 20,
          // wireframe: true, // Optionally make the base globe wireframe
        }));

        // Sample GeoJSON data for a few hexagons
        // In a real application, you'd load or generate a full set of hexagonal polygons
        const sampleHexFeatures = [
          { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[0,0],[5,10],[10,0],[5,-10],[0,0]]] } }, // Simplified diamond for demo
          { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[20,20],[25,30],[30,20],[25,10],[20,20]]] } }
          // NOTE: These are NOT true hexagons. Generating proper spherical hexagons is complex.
          // This is just to demonstrate the hexPolygonsData API.
        ];

        globeInstance
          .hexPolygonsData(sampleHexFeatures)
          .hexPolygonColor(() => `#${Math.floor(Math.random()*16777215).toString(16)}`) // Random color for each hex
          .hexPolygonAltitude(0.005) // Slight altitude to make them pop
          .hexPolygonMargin(0.1);   // Margin between hexagons (adjust for desired gap)

         // Initialize renderer using the existing canvas element
        const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
        renderer.setSize(globeContainer.offsetWidth, globeContainer.offsetHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        //globeContainer.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        scene.add(globeInstance);
        scene.add(new THREE.AmbientLight(0xcccccc, Math.PI));
        scene.add(new THREE.DirectionalLight(0xffffff, 0.6 * Math.PI));

        const camera = new THREE.PerspectiveCamera();
        camera.aspect = globeContainer.offsetWidth / globeContainer.offsetHeight;
        camera.updateProjectionMatrix();
        camera.position.z = 250;

        const tbControls = new TrackballControls(camera, renderer.domElement);
        tbControls.minDistance = 101;
        tbControls.rotateSpeed = 3.0;
        tbControls.zoomSpeed = 0.8;


        let animationFrameId: number;
        (function animate() {
          if (!isMounted) return; // Stop animation if unmounted
          tbControls.update();
          renderer.render(scene, camera);
          animationFrameId = requestAnimationFrame(animate);
        })();

        window.myGlobeInstance = globeInstance; // Ensure this is set
        console.log('Globe useEffect: Globe initialized and window.myGlobeInstance is set.');

        // --- Add message listener logic directly here ---
        const handleParentMessage = (event: MessageEvent) => {
          if (!isMounted) return; // Check if component is still mounted

          if (event.origin !== window.origin) {
            console.warn('Globe (ClientSideGlobe): Message received from unexpected origin:', event.origin);
            return;
          }
          const messageData = event.data;
          console.log('Globe (ClientSideGlobe): Message received:', messageData);

          if (messageData && messageData.type === 'UPDATE_GLOBE_LOCATION' && messageData.payload) {
            const { lat, lng } = messageData.payload;
            console.log('Globe (ClientSideGlobe): Received new location - Lat:', lat, 'Lng:', lng);
            
            // The previous detailed logging confirmed window.myGlobeInstance is the Globe object.
            // The typeof check for pointOfView was problematic.
            // If window.myGlobeInstance exists, we will assume pointOfView is available as per ThreeGlobe API.

            if (window.myGlobeInstance) {
              console.log('Globe (ClientSideGlobe): Manually positioning camera for new lat/lng.');

              const globeInstance = window.myGlobeInstance;

              // Get Cartesian coordinates for the lat/lng on the globe surface (altitude 0)
              const targetPointOnGlobe = globeInstance.getCoords(lat, lng, 0);
              
              // Define desired altitude factor (e.g., 1.5 means 1.5 radii above the surface)
              const altitudeFactor = 1.5; 
              const globeRadius = globeInstance.getGlobeRadius();
              const cameraDistance = globeRadius * (1 + altitudeFactor);

              // Calculate new camera position
              const targetVector = new THREE.Vector3(targetPointOnGlobe.x, targetPointOnGlobe.y, targetPointOnGlobe.z);
              targetVector.normalize(); // Make it a unit vector
              targetVector.multiplyScalar(cameraDistance); // Scale it to the desired distance

              // camera and tbControls are from the outer scope of initGlobe
              if (camera && tbControls) {
                // Kill any existing tweens on the camera position or controls target to prevent conflicts
                gsap.killTweensOf(camera.position);
                gsap.killTweensOf(tbControls.target);

                // Animate camera position
                gsap.to(camera.position, {
                  x: targetVector.x,
                  y: targetVector.y,
                  z: targetVector.z,
                  duration: 1.5, // Duration in seconds
                  ease: "power2.out", // Easing function
                  onUpdate: () => {
                    // No need to call camera.lookAt(0,0,0) if tbControls.target is also animated
                  }
                });

                // Animate TrackballControls target to the center of the globe
                gsap.to(tbControls.target, {
                  x: 0,
                  y: 0,
                  z: 0,
                  duration: 1.5, // Match camera animation duration
                  ease: "power2.out"
                });

                tbControls.update(); // Apply changes to controls
                console.log('Globe (ClientSideGlobe): Camera position updated.');
              } else {
                console.warn('Globe (ClientSideGlobe): Camera or TrackballControls not available in handleParentMessage scope.');
              }
            } else {
              console.warn('Globe (ClientSideGlobe): window.myGlobeInstance is not available when trying to call pointOfView.');
              console.warn('Globe (ClientSideGlobe): window.myGlobeInstance is not available when message received.');
            }
          }
        };

        window.addEventListener('message', handleParentMessage);
        // --- End of message listener logic ---

        if (!isMounted) return; // Check again before adding event listeners

        const handleResize = () => {
          if (globeContainer && isMounted) { // Check isMounted here too
            camera.aspect = globeContainer.offsetWidth / globeContainer.offsetHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(globeContainer.offsetWidth, globeContainer.offsetHeight);
          }
        };
        window.addEventListener('resize', handleResize);

         // Now that the globe AND its listener are ready, inform the parent.
        // Add a minimal delay to give Kapsule a moment to fully wire up methods.
        setTimeout(() => {
          if (isMounted && window.parent) { // Check isMounted again before sending
            window.parent.postMessage({ type: 'GLOBE_LISTENER_READY' }, window.origin);
            console.log('Globe (ClientSideGlobe): Globe and listener initialized. Sent GLOBE_LISTENER_READY to parent (after 100ms delay).');
          }
        }, 100); // 100ms delay, can be adjusted

        cleanupFunction = () => {
          // isMounted check is implicitly handled by the outer useEffect cleanup
          console.log('Globe useEffect: Cleaning up ThreeGlobe...');
          if (animationFrameId) cancelAnimationFrame(animationFrameId);
          window.removeEventListener('resize', handleResize);
          tbControls.dispose();
          // Kill all GSAP tweens associated with camera.position and tbControls.target
          gsap.killTweensOf(camera?.position); // camera might be null if init failed early
          gsap.killTweensOf(tbControls?.target); // tbControls might be null
          if (globeContainer.current && renderer.domElement.parentElement === globeContainer.current) {
            window.removeEventListener('message', handleParentMessage); // Cleanup message listener
            // Check if it's still a child before removing
            globeContainer.current.removeChild(renderer.domElement);
          }
          renderer.dispose();
          scene.clear();
          // No standard dispose on ThreeGlobe instance itself
          delete window.myGlobeInstance;
        };

      } catch (error) {
        console.error("Globe useEffect: Error during dynamic import or initialization:", error);
      }
    };

    if (typeof window !== 'undefined') {
      initGlobe().catch(error => {
        console.error("Globe useEffect: initGlobe promise rejected:", error);
      });
    }

    return () => {
      isMounted = false;
      if (cleanupFunction) {
        cleanupFunction();
      }
    };
  }, []); // Empty dependency array: runs once on mount, cleans up on unmount

  return (
    // Render the container div and the canvas inside it
    <div ref={containerRef} id="globe-container" style={{ width: '100%', height: '100%' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
    </div>
  );
};

// Dynamically import the ClientSideGlobe component to ensure it only renders on the client
const DynamicGlobe = dynamic(() => Promise.resolve(ClientSideGlobe), { ssr: false });

export default function GlobePage() {
  return (
    <>
      <Head>
        <title>The Cookie – Globe</title>
        <style>{`
          html, body, #__next, #globe-container /* Ensure #globe-container is targeted if used by DynamicGlobe */ {
            margin: 0 !important;
            padding: 0 !important;
            width: 100%;
            height: 100%;
            overflow: hidden;
          } /* The style on the canvas element itself also helps */
          div#globe-container > canvas {
             display: block !important;
          }
        `}</style>
      </Head>
      {/* Render the dynamically imported globe component */}
      <DynamicGlobe />
    </>
  );
}
