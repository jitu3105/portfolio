// import { useEffect, useRef } from "react";
import { BrowserRouter } from "react-router-dom";
import Nav from "./Components/Nav";
import AnimatedRoutes from "./AnimatedRoutes";
function App() {
  return (
    <>
      <div id="app">
        <BrowserRouter>
          <Nav />
          <AnimatedRoutes />
        </BrowserRouter>
      </div>
    </>
  );
}

export default App;
