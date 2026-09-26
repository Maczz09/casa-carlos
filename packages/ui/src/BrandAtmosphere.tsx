import { useEffect, useRef } from "react";

/** Fondo 3D ambiental, liviano y sin interacción: aporta profundidad sin competir con el contenido. */
export function BrandAtmosphere({ className }: { className?: string }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = host.current;
    if (!element || !window.WebGLRenderingContext) return;
    let disposed = false;
    let disposeScene: (() => void) | undefined;

    void import("three").then((THREE) => {
      if (disposed || !element.isConnected) return;
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
      camera.position.z = 8;
      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.setClearAlpha(0);
      element.appendChild(renderer.domElement);

      const group = new THREE.Group();
      scene.add(group);
      const material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, wireframe: true });
      const accent = new THREE.MeshBasicMaterial({ color: 0xffd59a, transparent: true, opacity: 0.16, wireframe: true });
      const shapes = [
        new THREE.Mesh(new THREE.IcosahedronGeometry(1.25, 1), material),
        new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.18, 10, 44), accent),
        new THREE.Mesh(new THREE.OctahedronGeometry(0.72, 0), material),
      ];
      shapes[0]!.position.set(-2.4, 1.4, 0);
      shapes[1]!.position.set(2.3, -1.45, -0.4);
      shapes[2]!.position.set(2.7, 2.1, -1.3);
      shapes.forEach((shape) => group.add(shape));

      const resize = () => {
        const width = Math.max(1, element.clientWidth);
        const height = Math.max(1, element.clientHeight);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };
      resize();
      const observer = new ResizeObserver(resize);
      observer.observe(element);

      let frame = 0;
      const render = (time = 0) => {
        shapes[0]!.rotation.x = time * 0.00008;
        shapes[0]!.rotation.y = time * 0.00012;
        shapes[1]!.rotation.x = time * -0.0001;
        shapes[1]!.rotation.z = time * 0.00008;
        shapes[2]!.rotation.y = time * -0.00016;
        renderer.render(scene, camera);
        if (!reducedMotion) frame = requestAnimationFrame(render);
      };
      render();

      disposeScene = () => {
        if (frame) cancelAnimationFrame(frame);
        observer.disconnect();
        shapes.forEach((shape) => shape.geometry.dispose());
        material.dispose();
        accent.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    });

    return () => {
      disposed = true;
      disposeScene?.();
    };
  }, []);

  return <div ref={host} aria-hidden="true" className={className} />;
}
