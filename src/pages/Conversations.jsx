import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { useNavigate } from "react-router-dom";
import API_URL from "../api";
import "./Conversations.css";

const socket = io(API_URL, {
  autoConnect: false,
});

function Conversations() {
  const navigate = useNavigate();
  const token =
    localStorage.getItem("token");

  const [conversations, setConversations] =
    useState([]);

  const [loading, setLoading] =
    useState(Boolean(token));

  const [search, setSearch] =
    useState("");

  const currentUser =
    JSON.parse(
      localStorage.getItem("user")
    );

  const [needsPhone, setNeedsPhone] =
    useState(() => !JSON.parse(localStorage.getItem("user") || "{}").phone);

  const [profilePhone, setProfilePhone] =
    useState(() => JSON.parse(localStorage.getItem("user") || "{}").phone || "");

  const [phoneError, setPhoneError] = useState("");

  useEffect(() => {
    async function loadConversations() {
      try {
        const response =
          await fetch(
            `${API_URL}/api/conversations`,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Failed to load conversations."
          );
        }

        setConversations(
          data.conversations || []
        );
      } catch (error) {
        console.error(
          "Load conversations error:",
          error
        );
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      loadConversations();
    }
  }, [token]);

  useEffect(() => {
    if (
      !token ||
      !currentUser?.id
    ) {
      return;
    }

    function handleConversationUpdated(
      data
    ) {
      if (!data?.conversationId) {
        return;
      }

      const isMine =
        String(data.message?.senderId) === String(currentUser.id);

      if (
        !isMine &&
        document.hidden &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        new Notification("TwoChat", {
          body: data.message?.text || data.message?.attachment?.name || "Sent an attachment",
          tag: `twochat-${data.conversationId}`,
        });
      }

      setConversations(
        (previousConversations) =>
          previousConversations.map(
            (conversation) => {
              if (
                String(
                  conversation.id
                ) !==
                String(
                  data.conversationId
                )
              ) {
                return conversation;
              }

              return {
                ...conversation,

                lastMessage:
                  data.message ||
                  conversation.lastMessage,

                updatedAt:
                  data.message?.createdAt ||
                  conversation.updatedAt,

                unreadCount: isMine
                  ? conversation.unreadCount || 0
                  : data.unread
                  ? (conversation.unreadCount ||
                      0) + 1
                  : conversation.unreadCount ||
                    0,
              };
            }
          )
      );
    }

    socket.on(
      "conversationUpdated",
      handleConversationUpdated
    );

    socket.auth = { token };
    if (!socket.connected) {
      socket.connect();
    }

    socket.emit(
      "userOnline",
      currentUser.id
    );

    return () => {
      socket.off(
        "conversationUpdated",
        handleConversationUpdated
      );

      socket.disconnect();
    };
  }, [
    token,
    currentUser?.id,
  ]);

  function openConversation(
    conversationId
  ) {
    navigate(
      `/chat/${conversationId}`
    );
  }

  async function enableNotifications() {
    if ("Notification" in window) {
      await Notification.requestPermission();
    }
  }

  async function saveProfilePhone(event) {
    event.preventDefault();
    setPhoneError("");

    try {
      const response = await fetch(`${API_URL}/api/auth/profile-phone`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ phone: profilePhone }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Phone number update failed.");
      localStorage.setItem("user", JSON.stringify(data.user));
      setNeedsPhone(false);
    } catch (error) {
      setPhoneError(error.message || "Unable to update phone number.");
    }
  }

  const filteredConversations =
    conversations.filter(
      (conversation) => {
        const partner =
          conversation.users?.find(
            (user) =>
              String(user.id) !==
              String(
                currentUser?.id
              )
          );

        const name =
          partner?.name || "";

        const phone =
          partner?.phone || "";

        const searchText =
          `${name} ${phone}`
            .toLowerCase();

        return searchText.includes(
          search.toLowerCase()
        );
      }
    );

  if (loading) {
    return (
      <div className="conversations-loading">
        <div className="loading-circle"></div>

        <p>
          Loading conversations...
        </p>
      </div>
    );
  }

  return (
    <div className="conversations">

      <header className="conversations-header">

        <div>
          <h1>
            TwoChat
          </h1>

          <p>
            Your conversations
          </p>
        </div>

        <div className="conversation-actions">
          <button
            className="notification-button"
            type="button"
            onClick={enableNotifications}
            aria-label="Enable message notifications"
            title="Enable message notifications"
          >
            🔔
          </button>
          <button
            className="new-chat"
            type="button"
            onClick={() => navigate("/partner")}
            aria-label="Start a new chat"
            title="Start a new chat"
          >
            +
          </button>
        </div>

      </header>

      {needsPhone && (
        <form className="phone-registration" onSubmit={saveProfilePhone}>
          <label htmlFor="registeredPhone">Add your registered phone number</label>
          <div>
            <input
              id="registeredPhone"
              type="tel"
              autoComplete="tel"
              placeholder="+1 555 123 4567"
              value={profilePhone}
              onChange={(event) => setProfilePhone(event.target.value)}
              required
            />
            <button type="submit">Save</button>
          </div>
          {phoneError && <p role="alert">{phoneError}</p>}
        </form>
      )}

      <div className="conversation-search">

        <input
          type="text"
          placeholder="Search conversations..."
          value={search}
          onChange={(event) =>
            setSearch(
              event.target.value
            )
          }
        />

      </div>

      <main className="conversation-list">

        {filteredConversations.length ===
        0 ? (
          <div className="conversation-empty">

            <div className="empty-icon">
              💬
            </div>

            <h2>
              {search
                ? "No conversations found"
                : "No conversations yet"}
            </h2>

            <p>
              {search
                ? "Try another name or phone number."
                : "Start a conversation with someone."}
            </p>

            {!search && (
              <button
                type="button"
                onClick={() =>
                  navigate(
                    "/partner"
                  )
                }
              >
                Start a chat
              </button>
            )}

          </div>
        ) : (
          filteredConversations.map(
            (conversation) => {

              const partner =
                conversation.users?.find(
                  (user) =>
                    String(user.id) !==
                    String(
                      currentUser?.id
                    )
                );

              const partnerName =
                partner?.name ||
                partner?.email ||
                "Chat Partner";

              const partnerInitial =
                partnerName
                  .charAt(0)
                  .toUpperCase();

              const lastMessage =
                conversation.lastMessage;

              const lastMessageText =
                lastMessage?.text ||
                (lastMessage?.attachment ? "Attachment" : "Start a conversation");

              const lastMessageTime =
                lastMessage?.createdAt
                  ? new Date(
                      lastMessage.createdAt
                    ).toLocaleTimeString(
                      [],
                      {
                        hour: "2-digit",
                        minute: "2-digit",
                      }
                    )
                  : "";

              return (
                <button
                  key={
                    conversation.id
                  }
                  className="conversation"
                  type="button"
                  onClick={() =>
                    openConversation(
                      conversation.id
                    )
                  }
                >

                  <div className="conversation-avatar">
                    {partner?.profilePicture ? (
                      <img src={partner.profilePicture} alt="" />
                    ) : partnerInitial}
                  </div>

                  <div className="conversation-content">

                    <div className="conversation-top">

                      <h2>
                        {partnerName}
                      </h2>

                      <span>
                        {
                          lastMessageTime
                        }
                      </span>

                    </div>

                    <div className="conversation-bottom">

                      <p>
                        {lastMessageText}
                      </p>

                      {conversation.unreadCount >
                        0 && (
                        <span className="unread">
                          {
                            conversation.unreadCount
                          }
                        </span>
                      )}

                    </div>

                  </div>

                </button>
              );
            }
          )
        )}

      </main>

    </div>
  );
}

export default Conversations;