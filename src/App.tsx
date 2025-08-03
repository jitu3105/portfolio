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

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <BackgroundBeams className="pointer-events-none" />
      <Card className="bg-transparent border-none h-screen p-0">
        <Card className="border-none rounded-2xl m-4 h-full  backdrop-blur-xs bg-muted/5 ">
          <CardHeader className="text-4xl">Jalaj Ghuge.</CardHeader>
          <CardContent className="h-full">HERO</CardContent>
          <CardFooter>
            <Footer />
          </CardFooter>
        </Card>
      </Card>
    </ThemeProvider>
  );
}

export default App;
