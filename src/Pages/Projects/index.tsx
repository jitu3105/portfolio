// import { useRef } from "react";
import Header from "../../Components/Header";
import PageAnimator from "../../Components/PageAnimator";
import classes from "./projects.module.css";
const Projects = () => {
  return (
    <PageAnimator>
      <Header />
      <div className={classes.projectsContainer}></div>
    </PageAnimator>
  );
};

export default Projects;
