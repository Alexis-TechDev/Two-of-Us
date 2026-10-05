import "./Partner.css";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import API_URL from "../api";

function Partner() {
  const navigate = useNavigate();

  const token = localStorage.getItem("token");

  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");

    const cleanPhone = phone.trim();

    if (!cleanPhone) {
      setError("Enter your partner's phone number.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/api/conversations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            partnerPhone: cleanPhone,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");

          navigate("/login");

          return;
        }

        setError(
          data.message ||
            "Unable to connect your partner."
        );

        return;
      }

      navigate(
        `/chat/${data.conversation.id}`
      );
    } catch (error) {
      console.error(
        "Partner connection error:",
        error
      );

      setError(
        "Unable to connect to the server."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="partner">
      <div className="partner-box">
        <button
          type="button"
          className="back"
          onClick={() => navigate("/")}
        >
          ← Back
        </button>

        <div className="partner-header">
          <div className="logo">
            <img src="/twochat-mark.svg" alt="" />
          </div>

          <h1>Connect your person</h1>

          <p>
            Connect using the phone number they registered with.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="partnerPhone">
              Phone number
            </label>

            <input
              id="partnerPhone"
              type="tel"
              autoComplete="tel"
              placeholder="+1 555 123 4567"
              onChange={(event) =>
                setPhone(event.target.value)
              }
              required
            />
          </div>

          {error && (
            <p className="error">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="button"
            disabled={loading}
          >
            {loading
              ? "Connecting..."
              : "Start Private Chat"}
          </button>
        </form>
      </div>
    </section>
  );
}

export default Partner;