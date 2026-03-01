import { Card, CardContent, CardHeader } from "./ui/card";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import { ScrollArea } from "./ui/scroll-area";

const About = () => {
  return (
    <div className="h-full min-h-0">
      <div className="grid md:grid-cols-2 gap-12 h-full items-stretch portrait:grid-rows-3">
        {/* LEFT SIDE */}
        <div className="flex justify-center items-center ">
          <img
            src="/about.svg"
            alt="About illustration"
            className="h-1/3 max-h-[350px] md:max-h-[450px] object-contain transition-all duration-500 hover:scale-105 h-full"
          />
        </div>

        {/* RIGHT SIDE */}
        <Card className="flex flex-col min-h-0 bg-background/70 backdrop-blur-xl border border-border/50 rounded-3xl shadow-2xl flex-1 portrait:row-span-2">
          <CardHeader className="pb-0">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              About Me
            </h2>
            <p className="text-primary mt-2 font-medium">
              Full Stack • Real-Time Systems • IoT Architect
            </p>
            <Separator className="mt-4" />
          </CardHeader>

          {/* 👇 KEY DIFFERENCE */}
          <ScrollArea className="flex-1 min-h-0 ">
            <CardContent className="p-8 md:p-10 flex flex-col gap-8 pt-0">
              <AboutContent />
            </CardContent>
          </ScrollArea>
        </Card>
      </div>
    </div>
  );
};

const AboutContent = () => (
  <>
    <p className="text-muted-foreground leading-relaxed text-lg">
      I’m a software engineer with{" "}
      <span className="font-semibold text-foreground">
        4+ years of experience
      </span>{" "}
      building scalable, high-performance systems across frontend and backend
      domains. I specialize in{" "}
      <span className="font-semibold text-foreground">
        real-time communication, streaming architectures, and IoT integrations
      </span>
      , delivering production-grade systems with performance and reliability at
      the core.
    </p>

    <div className="grid grid-cols-3 gap-4 text-center">
      <div>
        <h3 className="text-2xl md:text-3xl font-bold">4+</h3>
        <p className="text-xs md:text-sm text-muted-foreground">
          Years Experience
        </p>
      </div>
      <div>
        <h3 className="text-2xl md:text-3xl font-bold">20+</h3>
        <p className="text-xs md:text-sm text-muted-foreground">
          Projects Built
        </p>
      </div>
      <div>
        <h3 className="text-2xl md:text-3xl font-bold">Real-Time</h3>
        <p className="text-xs md:text-sm text-muted-foreground">
          Systems Focused
        </p>
      </div>
    </div>

    <div>
      <h4 className="font-semibold mb-4">Core Technologies</h4>
      <div className="flex flex-wrap gap-2">
        <Badge>React</Badge>
        <Badge>Node.js</Badge>
        <Badge>Python</Badge>
        <Badge>WebRTC</Badge>
        <Badge>MERN Stack</Badge>
        <Badge>MongoDB</Badge>
        <Badge>IoT Systems</Badge>
        <Badge>VPS / Cloud</Badge>
      </div>
    </div>

    <div className="space-y-4 text-muted-foreground leading-relaxed">
      <p>
        I design responsive React frontends optimized for performance and
        usability, while architecting scalable backend systems using Node.js and
        Python for API orchestration and real-time pipelines.
      </p>

      <p>
        My work includes low-latency WebRTC streaming platforms, GPS-based
        tracking systems, BLE configurators, and distributed real-time
        dashboards handling continuous telemetry.
      </p>

      <p>
        Recently, I built a scalable real-time simulation platform combining
        React + Node.js + Python, deployed on VPS with dynamic instance spawning
        — demonstrating strong system design and infrastructure thinking.
      </p>
    </div>

    <p className="font-medium text-foreground">
      I enjoy building systems that scale, solving complex engineering
      challenges, and turning ambitious ideas into reliable production software.
    </p>
  </>
);

export default About;
