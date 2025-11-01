"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { backgroundCrossfade } from "@/lib/animations";

interface BackgroundManagerProps {
  backgroundImage: string;
}

/**
 * BackgroundManager handles dynamic background image switching with
 * sophisticated blur+fade transitions.
 *
 * Transition effect:
 * - Old image: opacity 100% → 0%, blur 0px → 20px
 * - New image: opacity 0% → 100%, blur 20px → 0px
 * - Duration: 800ms with ease-in-out
 *
 * Implementation:
 * - Uses AnimatePresence to manage old/new image layers
 * - Old image shown only during transition, exits with blur+fade
 * - New image always present, enters with deblur+fade when changed
 * - Key-based approach ensures React properly mounts/unmounts layers
 */
export default function BackgroundManager({ backgroundImage }: BackgroundManagerProps) {
  const [displayedImage, setDisplayedImage] = useState(backgroundImage);
  const [previousImage, setPreviousImage] = useState<string | null>(null);
  const isInitialMount = useRef(true);

  // Detect background image change
  if (backgroundImage !== displayedImage) {
    setPreviousImage(displayedImage);
    setDisplayedImage(backgroundImage);
    isInitialMount.current = false; // Any change after mount means we should animate
  }

  return (
    <>
      <AnimatePresence mode="sync">
        {/* Old image layer - only rendered during transition, exits with blur+fade */}
        {previousImage && (
          <motion.div
            key={`old-${previousImage}`}
            className="pointer-events-none fixed inset-0 bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage: `url(${previousImage})`,
              backgroundAttachment: "fixed",
              zIndex: -4,
            }}
            variants={backgroundCrossfade}
            initial="visible"
            exit="exit"
            onAnimationComplete={() => setPreviousImage(null)}
          />
        )}

        {/* New image layer - enters with deblur+fade (skips animation on initial mount) */}
        <motion.div
          key={`new-${displayedImage}`}
          className="pointer-events-none fixed inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url(${displayedImage})`,
            backgroundAttachment: "fixed",
            zIndex: -3, // Above old image, below gradient
          }}
          variants={backgroundCrossfade}
          initial={isInitialMount.current ? "visible" : "hidden"}
          animate="visible"
        />
      </AnimatePresence>

      {/* Gradient overlay (maintains readability) - sits above background, below film grain */}
      {/* Light mode gradient */}
      <div
        className="pointer-events-none fixed inset-0 bg-gradient-to-b dark:hidden"
        style={{
          zIndex: -2,
          background: 'linear-gradient(to bottom, rgba(245, 252, 253, 0.25) 0%, rgba(245, 252, 253, 0.45) 50%, rgba(245, 252, 253, 0.5) 100%)',
        }}
      />
      {/* Dark mode gradient */}
      <div
        className="pointer-events-none fixed inset-0 hidden bg-gradient-to-b dark:block"
        style={{
          zIndex: -2,
          background: 'linear-gradient(to bottom, rgba(7, 25, 29, 0.5) 0%, rgba(7, 25, 29, 0.75) 50%, rgba(7, 25, 29, 0.9) 100%)',
        }}
      />
    </>
  );
}
