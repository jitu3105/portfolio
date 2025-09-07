import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Linkedin, Github, Mail } from "lucide-react";

function Footer() {
  return (
    <div className="container mx-auto px-4 text-xs ">
      <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
        {/* Copyright */}
        <p className="md:text-sm">
          &copy; 2025 Jalaj Ghuge. All rights reserved.
        </p>

        {/* Social Links */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            asChild
            className=" hover:text-blue-200 transform hover:scale-105 transition-all duration-200"
          >
            <a
              href="https://www.linkedin.com/in/jalaj-ghuge-b5bb65129/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn Profile"
            >
              <Linkedin className="h-5 w-5" />
            </a>
          </Button>
          {/* <Button
            variant="ghost"
            size="icon"
            asChild
            className="text-white hover:text-blue-200 hover:bg-blue-700 transform hover:scale-105 transition-all duration-200"
          >
            <a
              href="https://github.com/your-username"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub Profile"
            >
              <Github className="h-5 w-5" />
            </a>
          </Button> */}
          <Button
            variant="ghost"
            size="icon"
            asChild
            className="text-white hover:text-blue-200 hover:bg-blue-700 transform hover:scale-105 transition-all duration-200"
          >
            <a
              href="mailto:jalajghuge.official@example.com"
              aria-label="Email Contact"
            >
              <Mail className="h-5 w-5" />
            </a>
          </Button>
        </div>
      </div>

      {/* Separator */}
      <Separator className="my-2 bg-blue-200" />

      {/* Tagline */}
      <p className="text-center  text-blue-100">
        Crafting innovative web, mobile, and real-time solutions from Greater
        Noida
      </p>
    </div>
  );
}

export default Footer;
