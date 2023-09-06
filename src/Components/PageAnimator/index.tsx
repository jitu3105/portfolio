// import { useRef } from "react";
import classes from "./pageAnimator.module.css";
import { motion } from "framer-motion";

const PageAnimator: React.FC<{ children: any }> = ({ children }) => {
  return (
    <motion.div
      className={`${classes.pageAnimatorContainer}`}
      initial={{ left: "100vw", boxShadow: "0 0 2vh black" }}
      transition={{ duration: 1.5 }}
      animate={{
        left: ["100vw", "100vw", "100vw", "0vw", "0vw"],
        boxShadow: [
          "0 0 2vh black",
          "0 0 2vh black",
          "0 0 2vh black",
          "0 0 2vh black",
          "0 0 0vh black",
        ],
      }}
      exit={{
        position: "absolute",
        left: ["0vw", "0vw", "100vw", "100vw", "100vw"],
        boxShadow: [
          "0 0 0vh black",
          "0 0 2vh black",
          "0 0 2vh black",
          "0 0 2vh black",
          "0 0 2vh black",
        ],
      }}
      id="heheh"
    >
      {children}
    </motion.div>
  );
};

export default PageAnimator;
