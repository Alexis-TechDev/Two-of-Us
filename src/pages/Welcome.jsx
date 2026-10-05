import { Link } from "react-router-dom";
import "./Welcome.css";

function Welcome() {
  return (
    <section className="welcome">
      <div className="welcome-box">

        <div className="logo">
          <img className="logo-mark" src="/twochat-mark.svg" alt="" />

          <span className="logo-text">
            TwoChat
          </span>
        </div>

        <div className="welcome-content">
          <h1 className="title">
            Just the two of you.
          </h1>

          <p className="text">
            A private space to connect, chat, and share
            moments with someone who matters.
          </p>
        </div>

        <div className="welcome-actions">

          <Link
            to="/register"
            className="button button-primary"
          >
            Create Account
          </Link>

          <Link
            to="/login"
            className="button button-secondary"
          >
            Login
          </Link>

        </div>

      </div>
    </section>
  );
}

export default Welcome;