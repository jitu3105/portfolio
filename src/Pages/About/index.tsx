import Header from "../../Components/Header";
import PageAnimator from "../../Components/PageAnimator";
import classes from "./about.module.css";
const About = () => {
  return (
    <PageAnimator>
      <Header />
      <div className={classes.aboutContainer}></div>
    </PageAnimator>
  );
};

export default About;
