import { useLocation } from "react-router-dom";
import classes from "./header.module.css";
const Header: React.FC<{ heading?: string }> = ({ heading }) => {
  const location = useLocation();
  return (
    <header>
      <h1 className={classes.header}>
        {heading ? heading : location.pathname.split("/")[1]}
      </h1>
    </header>
  );
};

export default Header;
