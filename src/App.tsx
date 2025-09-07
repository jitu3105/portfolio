import { useState } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import { BackgroundBeams } from "./components/ui/background-beams";
import { Button } from "./components/ui/button";
import { ThemeProvider } from "./components/theme-provider";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "./components/ui/card";
import Footer from "./Footer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Projects from "./components/projects";
import About from "./components/about";

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <BackgroundBeams className="pointer-events-none" />
      <Card className="bg-transparent border-none h-screen p-0 md:p-4">
        <Card className="border-none rounded-2xl h-full  backdrop-blur-xs bg-muted/5 ">
          <Tabs defaultValue="about" className=" h-full">
            <CardHeader className="flex items-cneter justify-between w-full md:w-11/12 md:mx-auto h-1/12">
              <h1 className="text-2xl md:text-4xl">Jalaj Ghuge.</h1>
              <TabsList>
                <TabsTrigger value="about">About</TabsTrigger>
                <TabsTrigger value="projects">Projects</TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent className="h-9/12">
              <TabsContent value="about" className="h-full">
                <About />
              </TabsContent>
              <TabsContent value="projects" className="h-full">
                <Projects />
              </TabsContent>
            </CardContent>
            <CardFooter className="h-2/12 w-full truncate">
              <Footer />
            </CardFooter>
          </Tabs>
        </Card>
      </Card>
    </ThemeProvider>
  );
}

export default App;
