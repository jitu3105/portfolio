import Header from "../../Components/Header";
import PageAnimator from "../../Components/PageAnimator";
import classes from "./home.module.css";
const Home = () => {
  return (
    <PageAnimator>
      <Header heading="WELCOME" />
      <div className={classes.homeContainer}>
        <p>
          My name is Jalaj Ghuge, I'm a full stack developer based in Greater
          Noida, Uttar-Pradesh, India.
        </p>
        <p>
          I love creating frontends as they provide a challenge of optimisation
          and its very interesting to develop, as it feels like a complex game.
        </p>

        <p>
          I love developing for the web as its compatibility on different
          devices and operating systems.
        </p>
      </div>
    </PageAnimator>
  );
};

export default Home;
