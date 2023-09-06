import { Link, useLocation } from "react-router-dom";
import me from "../../../public/ME.png";
import classes from "./nav.module.css";
const Nav = () => {
  const links = [
    { url: "/about", name: "about" },
    { url: "/projects", name: "projects" },
    { url: "/contact", name: "contact" },
  ];
  const location = useLocation();
  return (
    <nav className={classes.navContainer}>
      <section className={classes.logo}>
        <Link to="/" className={classes.me}>
          <img src={me} alt="" />
        </Link>
        <h1 className={classes.name}>Jalaj Ghuge</h1>
      </section>
      <section className={classes.links}>
        {links.map((link) => (
          <Link
            to={link.url}
            className={`${classes.link} ${
              location.pathname == link.url && classes.activeLink
            }`}
          >
            {link.name}
          </Link>
        ))}
      </section>
    </nav>
  );
};

export default Nav;
