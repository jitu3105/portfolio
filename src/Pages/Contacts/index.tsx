// import { useRef } from "react";
import Header from "../../Components/Header";
import PageAnimator from "../../Components/PageAnimator";
import classes from "./contacts.module.css";

const Contacts = () => {
  return (
    <PageAnimator>
      <Header />

      <div className={classes.contactsContainer}></div>
    </PageAnimator>
  );
};

export default Contacts;
