import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion, type Variants, type MotionProps } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useLenis } from "lenis/react";

import { ThemeToggle } from "@/components/ui/theme-toggle";
import { profile } from "@/data/portfolio";

const navItems = [
  { name: "Home", href: "#hero" },
  { name: "About", href: "#about" },
  { name: "Projects", href: "#projects" },
  { name: "Career", href: "#career" },
  { name: "Education", href: "#education" },
  { name: "Contact", href: "#contact" },
];

export default function Header() {
  const [showHeader, setShowHeader] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const lenis = useLenis();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    let lastScrollY = window.scrollY;
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 80) {
        setShowHeader(false); // Scrolling down
      } else {
        setShowHeader(true); // Scrolling up
      }
      lastScrollY = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleScrollTo = (id: string) => {
    if (lenis) {
      lenis.scrollTo(id, { immediate: !!reduceMotion });
    } else {
      document.querySelector(id)?.scrollIntoView({ behavior: reduceMotion ? "instant" : "smooth" });
    }
    setIsMobileMenuOpen(false);
  };

  const menuVariants: Variants = {
    open: {
      opacity: 1,
      transition: { duration: 0.18 },
    },
    closed: {
      opacity: 0,
      transition: { duration: 0.12 },
    },
  };

  const listVariants: Variants = {
    open: { transition: { staggerChildren: 0.035 } },
    closed: { transition: { staggerChildren: 0.05, staggerDirection: -1 } },
  };

  const itemVariants: Variants = {
    open: { y: 0, opacity: 1, transition: { y: { stiffness: 1000, velocity: -100 } } },
    closed: { y: 50, opacity: 0, transition: { y: { stiffness: 1000 } } },
  };

  return (
    <AnimatePresence>
      {(showHeader || isMobileMenuOpen) && (
        <motion.header
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0, transition: { duration: 0.4 } }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="fixed top-6 left-0 right-0 z-50 flex justify-center px-4"
        >
          <div className="glass-panel w-full max-w-7xl rounded-[2rem] flex items-center justify-between px-6 py-4 shadow-xl">
            {/* Logo */}
            <a
              href="#hero"
              onClick={(event) => {
                event.preventDefault();
                handleScrollTo("#hero");
              }}
              className="cursor-pointer font-extrabold text-lg flex items-center gap-3 group select-none"
            >
              <div className="relative w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 via-primary to-sky-400 p-[1px] shadow-lg group-hover:scale-105 transition-transform duration-300">
                <img src={profile.avatar} alt="" width={36} height={36} className="w-full h-full bg-background rounded-[11px] object-cover object-top" />
              </div>
              <div className="flex flex-col text-left">
                <span className="font-extrabold tracking-tight text-foreground text-sm leading-none group-hover:text-primary transition-colors">
                  Keshav Karn
                </span>
                <span className="text-[9px] font-bold text-muted-foreground tracking-widest uppercase mt-0.5">
                  Portfolio
                </span>
              </div>
            </a>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex flex-1 justify-center">
              <ul className="flex space-x-8">
                {navItems.map((item) => (
                  <motion.li key={item.name} className="relative group text-sm font-medium text-muted-foreground transition-colors">
                    <a
                      href={item.href}
                      onClick={(event) => {
                        event.preventDefault();
                        handleScrollTo(item.href);
                      }}
                      className="cursor-pointer hover:text-foreground"
                    >
                      {item.name}
                    </a>
                    <motion.span
                      className="absolute -bottom-2 left-1/2 w-0 h-0.5 bg-primary/80 rounded-full shadow-[0_0_8px_rgba(139,92,246,0.8)]"
                      initial={{ width: 0, x: "-50%" }}
                      whileHover={{ width: "100%" }}
                      transition={{ duration: 0.3 }}
                    />
                  </motion.li>
                ))}
              </ul>
            </nav>

            {/* Actions: Theme & Mobile Toggle */}
            <div className="flex items-center gap-2">
              <ThemeToggle animationType="circle-spread" />

              {/* Mobile Menu Toggle */}
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                aria-label="Open navigation menu"
                aria-expanded={isMobileMenuOpen}
                aria-controls="mobile-navigation"
                className="lg:hidden min-h-11 min-w-11 text-foreground hover:text-primary transition-colors p-2"
              >
                <Menu size={24} />
              </button>
            </div>
          </div>

          {/* Mobile Sidebar */}
          <AnimatePresence>
            {isMobileMenuOpen && (
              <motion.dialog
                id="mobile-navigation"
                ref={dialog => { if (dialog && !dialog.open) dialog.showModal(); }}
                aria-label="Navigation"
                data-lenis-prevent
                onCancel={() => setIsMobileMenuOpen(false)}
                {...({
                  initial: "closed",
                  animate: "open",
                  exit: "closed",
                  variants: menuVariants,
                } as MotionProps)}
                className="fixed inset-0 m-0 h-dvh w-full max-w-none max-h-none border-0 z-40 bg-background text-foreground flex flex-col items-center justify-center"
              >
                <motion.button
                  onClick={() => setIsMobileMenuOpen(false)}
                  aria-label="Close navigation menu"
                  className="absolute top-6 right-6 min-h-11 min-w-11 flex items-center justify-center text-foreground"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <X size={32} />
                </motion.button>

                <motion.ul
                  {...({ variants: listVariants } as MotionProps)}
                  className="flex flex-col items-center justify-center h-full gap-4 py-20 overflow-y-auto"
                >
                  {navItems.map((item) => (
                    <motion.li key={item.name} {...({ variants: itemVariants } as MotionProps)}>
                      <a
                        href={item.href}
                        onClick={(event) => {
                          event.preventDefault();
                          handleScrollTo(item.href);
                        }}
                        className="inline-flex min-h-11 items-center text-3xl font-bold text-foreground hover:text-primary transition-colors cursor-pointer"
                      >
                        {item.name}
                      </a>
                    </motion.li>
                  ))}
                </motion.ul>
              </motion.dialog>
            )}
          </AnimatePresence>
        </motion.header>
      )}
    </AnimatePresence>
  );
}
