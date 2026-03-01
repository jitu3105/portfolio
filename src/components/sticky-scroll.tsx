import React, { useEffect, useRef, useState } from "react";
import { useMotionValueEvent, useScroll, motion } from "motion/react";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";

export const StickyScroll = ({
  content,
  contentClassName,
}: {
  content: {
    title: string;
    description: React.ReactNode;
    content?: React.ReactNode;
    link?: string;
  }[];
  contentClassName?: string;
}) => {
  const [activeCard, setActiveCard] = useState(0);
  const ref = useRef<any>(null);

  const { scrollYProgress } = useScroll({
    container: ref,
    offset: ["start start", "end start"],
  });

  const cardLength = content.length;

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    const breakpoints = content.map((_, i) => i / cardLength);
    const closest = breakpoints.reduce((acc, point, i) => {
      const distance = Math.abs(latest - point);
      if (distance < Math.abs(latest - breakpoints[acc])) return i;
      return acc;
    }, 0);

    setActiveCard(closest);
  });

  const gradients = [
    "linear-gradient(to bottom right, #0f172a, #1e293b)",
    "linear-gradient(to bottom right, #111827, #1f2937)",
    "linear-gradient(to bottom right, #0c0a09, #1c1917)",
  ];

  const [backgroundGradient, setBackgroundGradient] = useState(gradients[0]);

  useEffect(() => {
    setBackgroundGradient(gradients[activeCard % gradients.length]);
  }, [activeCard]);

  return (
    <ScrollArea className="h-full w-full rounded-3xl">
      <motion.div
        animate={
          {
            // backgroundColor: backgroundColors[activeCard % backgroundColors.length],
          }
        }
        className="relative flex flex-col lg:flex-row min-h-full"
        // className="relative  flex flex-col lg:flex-row h-full  w-full
        //        overflow-y-auto rounded-3xl"
        ref={ref}
      >
        {/* LEFT CONTENT */}
        <div className="flex-1 px-6 md:px-16 lg:px-24 py-20">
          <div className="max-w-4xl mx-auto">
            {content.map((item, index) => (
              <div key={item.title + index} className="mb-32">
                <motion.h2
                  animate={{
                    opacity: activeCard === index ? 1 : 0.4,
                  }}
                  className="text-3xl md:text-4xl font-bold text-white"
                >
                  {item.title}
                </motion.h2>

                <motion.div
                  animate={{
                    opacity: activeCard === index ? 1 : 0.4,
                  }}
                  className="mt-8 lg:hidden"
                >
                  {content[activeCard].content ?? null}
                </motion.div>

                <motion.div
                  animate={{
                    opacity: activeCard === index ? 1 : 0.4,
                  }}
                  className="mt-10 text-lg leading-relaxed text-slate-300"
                >
                  {item.description}
                </motion.div>
              </div>
            ))}
            <div className="h-40" />
          </div>
        </div>

        {/* RIGHT PREVIEW */}
        <div
          style={{ background: backgroundGradient }}
          className="sticky top-20 hidden lg:flex 
                 h-fit w-fit
                 rounded-3xl overflow-hidden 
                 shadow-2xl items-center justify-center mr-16 p-0"
        >
          {content[activeCard].content ?? null}
        </div>
      </motion.div>
    </ScrollArea>
  );
};
