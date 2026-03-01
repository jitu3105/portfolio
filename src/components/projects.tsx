import { StickyScroll } from "./sticky-scroll";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";

const Projects = () => {
  const projects = [
    {
      title: "Scalable Real-Time Simulation Platform",

      description: (
        <div className="space-y-10 max-w-3xl">
          {/* TECH STACK */}
          <div>
            <h4 className="text-xs uppercase tracking-widest text-muted-foreground mb-4">
              Technology Stack
            </h4>
            <div className="flex flex-wrap gap-3">
              <Badge className="px-3 py-1">React</Badge>
              <Badge className="px-3 py-1">Node.js</Badge>
              <Badge className="px-3 py-1">WebRTC</Badge>
              <Badge className="px-3 py-1">Python</Badge>
              <Badge className="px-3 py-1">MAVSDK</Badge>
              <Badge className="px-3 py-1">PX4 SITL</Badge>
              <Badge className="px-3 py-1">VPS Hosting</Badge>
            </div>
          </div>

          <Separator />

          {/* OVERVIEW */}
          <div>
            <h3 className="text-2xl font-semibold mb-4">Project Overview</h3>
            <p className="text-muted-foreground leading-relaxed text-lg">
              Engineered a scalable web-based simulation platform capable of
              spawning isolated real-time environments for concurrent users.
              Built to handle telemetry streaming, interactive 3D visualization,
              and low-latency communication pipelines.
            </p>
          </div>

          {/* KEY CAPABILITIES */}
          <div>
            <h3 className="text-2xl font-semibold mb-6">Core Capabilities</h3>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="p-6 rounded-xl bg-muted/30 border border-border/40">
                <h4 className="font-semibold mb-2">
                  Dynamic Instance Isolation
                </h4>
                <p className="text-sm text-muted-foreground">
                  Node.js backend dynamically spawns and manages isolated
                  simulation instances per user session.
                </p>
              </div>

              <div className="p-6 rounded-xl bg-muted/30 border border-border/40">
                <h4 className="font-semibold mb-2">
                  Real-Time Telemetry Dashboard
                </h4>
                <p className="text-sm text-muted-foreground">
                  Interactive React UI with live telemetry and 3D state
                  synchronization.
                </p>
              </div>

              <div className="p-6 rounded-xl bg-muted/30 border border-border/40">
                <h4 className="font-semibold mb-2">Low-Latency Streaming</h4>
                <p className="text-sm text-muted-foreground">
                  WebRTC-based transport optimized for real-time responsiveness
                  and efficiency.
                </p>
              </div>

              <div className="p-6 rounded-xl bg-muted/30 border border-border/40">
                <h4 className="font-semibold mb-2">Scalable VPS Deployment</h4>
                <p className="text-sm text-muted-foreground">
                  Deployed on VPS with automated instance lifecycle handling and
                  resource management.
                </p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="pt-6">
            <Button size="lg" asChild>
              <a
                href="https://dronesim.jalajghuge.co.in"
                target="_blank"
                rel="noopener noreferrer"
              >
                View Live Platform
              </a>
            </Button>
          </div>
        </div>
      ),

      content: (
        <Card className="relative overflow-hidden rounded-3xl group border-none shadow-2xl p-0 ">
          <img
            src="/dronesim.jpeg"
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent flex items-end p-10">
            <div>
              <h3 className="text-4xl font-bold text-white">DRONESIM</h3>
              <p className="text-white/70 mt-2">
                Real-Time Simulation Platform
              </p>
            </div>
          </div>
        </Card>
      ),
    },
  ];

  return (
    <div className="h-full md:px-16 py-10">
      <StickyScroll content={projects} contentClassName="rounded-3xl" />
    </div>
  );
};

export default Projects;
