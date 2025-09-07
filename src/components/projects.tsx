import { StickyScroll } from "./sticky-scroll";
import { Card } from "./ui/card";

const Projects = () => {
  var projects = [
    {
      title: " Scalable Real-Time Simulation Platform",
      description: `
        Technologies: React, Node.js, WebRTC, Python, MAVSDK, PX4 SITL, VPS Hosting
        Developed a scalable, web-based simulation platform to emulate real-time systems, hosted on a Virtual Private Server (VPS) with dynamic instance spawning for concurrent user sessions. The frontend, built with React, features a responsive dashboard displaying live telemetry data (e.g., position, status) and a 3D model that updates dynamically to reflect system states, such as activation and mode transitions. The backend, powered by Node.js and Python, leverages MAVSDK to manage simulation instances and process real-time data, ensuring seamless scalability for multiple users. Integrated WebRTC for low-latency streaming of simulated data feeds, with custom overlays for enhanced visualization.
        Key features include:
        Dynamic Instance Management: Designed a Node.js backend to spawn and manage simulation instances on-demand, ensuring isolated sessions for concurrent users.
        Real-Time Visualization: Built a React frontend with a 3D model and telemetry dashboard, updating in real-time to reflect system changes.
        Low-Latency Streaming: Implemented WebRTC for efficient, real-time data streaming, optimized for performance and user interaction.
        Scalable Architecture: Deployed on a VPS with automated instance scaling, showcasing robust system design for high-demand environments.
        This project demonstrates my ability to architect scalable, real-time web applications, integrating front-end and back-end technologies to deliver user-centric solutions.`,
      content: (
        <>
          <Card className="w-full h-full p-0 relative">
            <p className="absolute h-full w-full bg-black/40 font-bold text-center flex items-center justify-center pb-30">
              DRONESIM
            </p>
            <img src="/dronesim.jpeg" className="w-full h-full object-cover" />
          </Card>
        </>
      ),
      link: "https://dronesim.jalajghuge.co.in",
    },
  ];
  return <StickyScroll content={projects} contentClassName="rounded-xl " />;
};

export default Projects;
