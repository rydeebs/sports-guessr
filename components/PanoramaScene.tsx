"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import * as THREE from "three";

type PanoramaSceneProps = {
  imageUrl: string;
  title: string;
  isDimmed: boolean;
  initialYaw?: number;
};

export function PanoramaScene({
  imageUrl,
  title,
  isDimmed,
  initialYaw = 180,
}: PanoramaSceneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      92,
      container.clientWidth / container.clientHeight,
      0.1,
      1100,
    );
    camera.position.set(0, 0, 0.1);

    let renderer: THREE.WebGLRenderer;

    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      });
    } catch {
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.domElement.setAttribute("aria-label", title);
    renderer.domElement.className = "panorama-canvas";
    renderer.domElement.style.display = "block";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.width = "100%";
    container.appendChild(renderer.domElement);

    const geometry = new THREE.SphereGeometry(500, 96, 64);
    geometry.scale(-1, 1, 1);

    const material = new THREE.MeshBasicMaterial({
      color: 0x0b1622,
    });
    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

    let texture: THREE.Texture | null = null;
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let startLon = 0;
    let startLat = 0;
    let lon = initialYaw;
    let lat = 0;
    let animationFrame = 0;

    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
      imageUrl,
      (loadedTexture) => {
        loadedTexture.colorSpace = THREE.SRGBColorSpace;
        loadedTexture.minFilter = THREE.LinearFilter;
        loadedTexture.magFilter = THREE.LinearFilter;
        texture = loadedTexture;
        material.map = loadedTexture;
        material.color.set(0xffffff);
        material.needsUpdate = true;
      },
      undefined,
      () => {
        material.color.set(0x0b1622);
      },
    );

    const render = () => {
      lat = Math.max(-82, Math.min(82, lat));
      const phi = THREE.MathUtils.degToRad(90 - lat);
      const theta = THREE.MathUtils.degToRad(lon);

      camera.lookAt(
        500 * Math.sin(phi) * Math.cos(theta),
        500 * Math.cos(phi),
        500 * Math.sin(phi) * Math.sin(theta),
      );
      renderer.domElement.style.filter = isDimmed
        ? "brightness(0.66) saturate(0.92)"
        : "brightness(0.9) saturate(1.02)";
      renderer.render(scene, camera);
      animationFrame = window.requestAnimationFrame(render);
    };

    const resize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    const onPointerDown = (event: PointerEvent) => {
      isDragging = true;
      startX = event.clientX;
      startY = event.clientY;
      startLon = lon;
      startLat = lat;
      renderer.domElement.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!isDragging) {
        return;
      }

      lon = startLon - (event.clientX - startX) * 0.12;
      lat = startLat + (event.clientY - startY) * 0.12;
    };

    const stopDragging = (event: PointerEvent) => {
      isDragging = false;

      if (renderer.domElement.hasPointerCapture(event.pointerId)) {
        renderer.domElement.releasePointerCapture(event.pointerId);
      }
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      camera.fov = THREE.MathUtils.clamp(
        camera.fov + event.deltaY * 0.035,
        45,
        92,
      );
      camera.updateProjectionMatrix();
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", stopDragging);
    renderer.domElement.addEventListener("pointercancel", stopDragging);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("resize", resize);
    render();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", stopDragging);
      renderer.domElement.removeEventListener("pointercancel", stopDragging);
      renderer.domElement.removeEventListener("wheel", onWheel);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      texture?.dispose();
      renderer.dispose();
    };
  }, [imageUrl, initialYaw, isDimmed, title]);

  return (
    <div
      ref={containerRef}
      className="panorama-scene absolute inset-0"
      role="img"
      aria-label={title}
    >
      <Image
        alt=""
        className="panorama-fallback"
        fill
        priority
        sizes="100vw"
        src={imageUrl}
        unoptimized
      />
    </div>
  );
}
