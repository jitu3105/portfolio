import { Card, CardContent } from "./ui/card";

const About = () => {
  return (
    <Card className="h-full w-11/12 mx-auto bg-transparent border-none shadow-none">
      <CardContent className="h-full w-full flex flex-row gap-4  portrait:flex-col p-0">
        <img src="/about.svg" className="h-full portrait:h-3/12" />
        <Card className=" flex-1 h-full portrait:h-9/12 bg-muted/90 rounded-2xl ">
          <CardContent className="h-full flex flex-col gap-8 overflow-x-hidden ">
            <p>
              I’m a versatile software developer with 4 years of experience
              designing and building scalable, high-performance applications
              across frontend, backend, and full stack domains. Based in Greater
              Noida, India, I specialize in delivering robust solutions using
              technologies like React, Node.js, Python, WebRTC, and the MERN
              stack, with expertise in real-time systems and IoT integrations.
            </p>
            <p>
              My frontend skills center on crafting dynamic, responsive
              interfaces with React, ensuring seamless user experiences for web
              applications. On the backend, I’ve architected scalable systems
              using Node.js and Python, integrating APIs, real-time data
              processing, and cloud infrastructure (e.g., VPS hosting). I’ve
              built real-time platforms with WebRTC for low-latency streaming
              and developed IoT solutions, including GPS-based tracking systems
              and BLE device configurators, leveraging the MERN stack and
              embedded protocols.
            </p>
            <p>
              A recent personal project—a scalable real-time simulation
              platform—demonstrates my full stack capabilities, combining a
              React frontend with a Node.js and Python backend to deliver
              dynamic data visualization and streaming. Hosted on a VPS with
              dynamic instance spawning, this project showcases my ability to
              design end-to-end solutions that prioritize performance,
              scalability, and reliability.
            </p>
            <p>
              Passionate about tackling complex technical challenges, I thrive
              in dynamic environments and am eager to contribute to innovative
              projects worldwide, from web development to real-time systems and
              IoT. Whether building intuitive frontends, robust backends, or
              integrated full stack applications, I’m driven to create
              impactful, user-focused solutions.
            </p>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
};

export default About;
