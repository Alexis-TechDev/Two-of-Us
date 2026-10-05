import "./Register.css";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import API_URL from "../api";

function Register() {
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm({
      ...form,
      [name]: value,
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setMessage("");
    setError("");
    setLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/api/auth/register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(form),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Registration failed.");
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      setMessage("Account created successfully!");

      navigate("/conversations");
    } catch (error) {
      console.error("Registration error:", error);

      setError(
        "Unable to connect to the server. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="register">
      <div className="register-box">
        <Link to="/" className="back">
          ← Back
        </Link>

        <div className="register-header">
          <img className="logo logo-mark" src="/twochat-mark.svg" alt="TwoChat" />

          <h1>Create your account</h1>

          <p>
            Create a private space for just the two of you.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="name">Name</label>

            <input
              id="name"
              name="name"
              type="text"
              placeholder="Your name"
              value={form.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="phone">Phone number</label>

            <input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              placeholder="+1 555 123 4567"
              value={form.phone}
              onChange={handleChange}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="email">Email (optional)</label>

            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={handleChange}
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>

            <div className="password">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Create a password"
                value={form.password}
                onChange={handleChange}
                minLength={8}
                required
              />

              <button
                type="button"
                className="show"
                onClick={() =>
                  setShowPassword(!showPassword)
                }
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div className="field">
            <label htmlFor="confirmPassword">
              Confirm password
            </label>

            <div className="password">
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirm ? "text" : "password"}
                placeholder="Repeat your password"
                value={form.confirmPassword}
                onChange={handleChange}
                minLength={8}
                required
              />

              <button
                type="button"
                className="show"
                onClick={() =>
                  setShowConfirm(!showConfirm)
                }
              >
                {showConfirm ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {error && (
            <p className="error">
              {error}
            </p>
          )}

          {message && (
            <p className="message">
              {message}
            </p>
          )}

          <button
            type="submit"
            className="button"
            disabled={loading}
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="login">
          Already have an account?{" "}
          <Link to="/login">Log in</Link>
        </p>
      </div>
    </section>
  );
}

export default Register;