import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import About from "./Pages/About";
import Contacts from "./Pages/Contacts";
import Projects from "./Pages/Projects";
import Home from "./Pages/Home";

const AnimatedRoutes = () => {
  const location = useLocation();
  return (
    <div
      style={{ width: "100%", height: "100%", flex: 1, position: "relative" }}
    >
      <AnimatePresence>
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contacts />} />
          <Route path="/projects" element={<Projects />} />
        </Routes>
      </AnimatePresence>
    </div>
  );
};

export default AnimatedRoutes;
