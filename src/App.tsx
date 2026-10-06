import { useState, useEffect } from "react";
import "./App.css";
import Header from "./components/Header/Header";
import { HeroSection } from "./components/HeroSection/HeroSection";
import { AboutSection } from "./components/AboutSection/AboutSection";
import { ServicesSection } from "./components/ServicesSection/ServicesSection";
import { ProjectsSection } from "./components/ProjectsSection/ProjectsSection";
import { EducationSection } from "./components/EducationSection/EducationSection";
import { CareerTimeline } from "./components/CareerSection/CareerTimeline";
import { ContactSection } from "./components/ContactSection/ContactSection";
import { Footer } from "./components/Footer/Footer";
import ReactLenis, { useLenis } from "lenis/react";
import { Home, User, GraduationCap, Briefcase, FolderKanban, Send } from "lucide-react";
import { motion, AnimatePresence, MotionConfig, useReducedMotion } from "framer-motion";

import Dock from "./components/ui/dock";

function App() {
  const [showDock, setShowDock] = useState(false);
  const reduceMotion = useReducedMotion();
  const lenis = useLenis();

  useEffect(() => {
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const shouldShow = currentScrollY > lastScrollY && currentScrollY > window.innerHeight * 0.5;
      const isTop = currentScrollY < window.innerHeight * 0.5;

      if (shouldShow) {
        setShowDock(true);
      } else if (isTop) {
        setShowDock(false);
      }
      lastScrollY = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      if (lenis) lenis.scrollTo(el, { immediate: !!reduceMotion });
      else el.scrollIntoView({ behavior: reduceMotion ? "instant" : "smooth", block: "start" });
    }
  };

  const dockItems = [
    { icon: <Home size={20} />, label: "Home", onClick: () => scrollToSection("hero") },
    { icon: <User size={20} />, label: "About", onClick: () => scrollToSection("about") },
    { icon: <FolderKanban size={20} />, label: "Projects", onClick: () => scrollToSection("projects") },
    { icon: <Briefcase size={20} />, label: "Career", onClick: () => scrollToSection("career") },
    { icon: <GraduationCap size={20} />, label: "Education", onClick: () => scrollToSection("education") },
    { icon: <Send size={20} />, label: "Contact", onClick: () => scrollToSection("contact") },
  ];

  return (
    <MotionConfig reducedMotion="user">
    <div className="bg-transparent min-h-screen relative overflow-x-hidden selection:bg-primary/30 selection:text-primary-foreground">
      <a href="#main-content" onClick={event => {
        if (lenis) {
          event.preventDefault();
          lenis.scrollTo('#main-content', { immediate: true });
          document.getElementById('main-content')?.focus({ preventScroll: true });
        }
      }} className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[1001] focus:rounded-lg focus:bg-card focus:p-3">Skip to content</a>
      <ReactLenis root options={{ smoothWheel: !reduceMotion, duration: reduceMotion ? 0 : 1.2 }}>
        <Header />

        <main id="main-content" tabIndex={-1} className="w-full flex flex-col pt-10 border-none">
          <HeroSection />
          <AboutSection />
          <ServicesSection />
          <ProjectsSection />
          <CareerTimeline />
          <EducationSection />
          <ContactSection />
        </main>

        {/* Footer */}
        <Footer />

        {/* Floating Dock */}
        <AnimatePresence>
          {showDock && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="fixed bottom-2 left-0 right-0 z-[999] hidden md:block"
            >
              <Dock
                items={dockItems}
                panelHeight={56}
                baseItemSize={44}
                magnification={reduceMotion ? 44 : 66}
                distance={180}
                multiBorder
              />
            </motion.div>
          )}
        </AnimatePresence>
      </ReactLenis>
    </div>
    </MotionConfig>
  );
}

export default App;
