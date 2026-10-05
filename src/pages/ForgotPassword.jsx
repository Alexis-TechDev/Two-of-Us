import { Link } from "react-router-dom";
import "./ForgotPassword.css";

function ForgotPassword() {
  return (
    <section className="forgot-password">
      <div className="forgot-box">

        <div className="forgot-header">
          <Link to="/login" className="back">
            ←
          </Link>

          <div className="logo">
            <div className="logo-mark">
              2
            </div>

            <span className="logo-text">
              TwoChat
            </span>
          </div>
        </div>

        <div className="forgot-content">
          <h1 className="title">
            Forgot your password?
          </h1>

          <p className="text">
            Enter the email address connected to your
            account and we'll send you instructions to
            reset your password.
          </p>
        </div>

        <form className="form">

          <div className="field">
            <label htmlFor="email">
              Email address
            </label>

            <input
              id="email"
              type="email"
              placeholder="Enter your email"
              autoComplete="email"
            />
          </div>

          <button
            type="submit"
            className="button"
          >
            Send Reset Link
          </button>

        </form>

        <p className="login-text">
          Remember your password?

          <Link
            to="/login"
            className="login-link"
          >
            Login
          </Link>
        </p>

      </div>
    </section>
  );
}

export default ForgotPassword;