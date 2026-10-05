import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import { io } from "socket.io-client";

import "./Chat.css";


const socket = io(
  "http://localhost:5000",
  {
    autoConnect: false,
  }
);


function Chat() {

  const {
    conversationId,
  } = useParams();


  const navigate =
    useNavigate();


  const [
    messages,
    setMessages,
  ] = useState([]);


  const [
    text,
    setText,
  ] = useState("");

  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [chatError, setChatError] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showChatOptions, setShowChatOptions] = useState(false);
  const [recording, setRecording] = useState(false);
  const [callState, setCallState] = useState("idle");
  const [incomingCall, setIncomingCall] = useState(null);
  const [profilePhone, setProfilePhone] = useState(
    () => JSON.parse(localStorage.getItem("user") || "{}").phone || ""
  );
  const [theme, setTheme] = useState(
    () => localStorage.getItem(`twochat-theme-${conversationId}`) || "orange"
  );


  const [
    loading,
    setLoading,
  ] = useState(true);


  const [
    isTyping,
    setIsTyping,
  ] = useState(false);


  const [
    partnerOnline,
    setPartnerOnline,
  ] = useState(false);


  const [
    partner,
    setPartner,
  ] = useState(null);


  const messagesEndRef =
    useRef(null);


  const typingTimeoutRef =
    useRef(null);


  const textareaRef =
    useRef(null);

  const attachmentInputRef = useRef(null);
  const profileInputRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const recorderRef = useRef(null);
  const recordingStreamRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const pendingCandidatesRef = useRef([]);
  const partnerRef = useRef(null);
  const markDeliveredRef = useRef(() => {});
  const markReadRef = useRef(() => {});


  const token =
    localStorage.getItem(
      "token"
    );


  const currentUser =
    JSON.parse(
      localStorage.getItem(
        "user"
      )
    );


  function scrollToBottom() {

    messagesEndRef.current?.scrollIntoView(
      {
        behavior: "smooth",
      }
    );
  }


  function handleTyping(
    event
  ) {

    const value =
      event.target.value;


    setText(value);


    if (!value.trim()) {

      socket.emit(
        "stopTyping",
        {
          conversationId,

          userId:
            currentUser.id,
        }
      );

      return;
    }


    socket.emit(
      "typing",
      {
        conversationId,

        userId:
          currentUser.id,
      }
    );


    clearTimeout(
      typingTimeoutRef.current
    );


    typingTimeoutRef.current =
      setTimeout(
        () => {

          socket.emit(
            "stopTyping",
            {
              conversationId,

              userId:
                currentUser.id,
            }
          );

        },
        1500
      );
  }


  function handleKeyDown(
    event
  ) {

    if (
      event.key ===
        "Enter" &&
      !event.shiftKey
    ) {

      event.preventDefault();

      event.currentTarget.form?.requestSubmit();
    }
  }


  function handleEmoji(emoji) {
    setText((previousText) => `${previousText}${emoji}`);
    textareaRef.current?.focus();
  }

  function handleAttachmentSelected(event) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setChatError("Files must be smaller than 5 MB.");
      return;
    }

    setChatError("");
    setPendingAttachment(file);
  }

  async function toggleVoiceRecording() {
    if (recording && recorderRef.current) {
      recorderRef.current.stop();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordingStreamRef.current = stream;
      recordingChunksRef.current = [];
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size) {
          recordingChunksRef.current.push(event.data);
          const recordedSize = recordingChunksRef.current.reduce(
            (total, chunk) => total + chunk.size,
            0
          );
          if (recordedSize > 5 * 1024 * 1024 && recorder.state === "recording") {
            setChatError("Voice notes must be smaller than 5 MB.");
            recorder.stop();
          }
        }
      };
      recorder.onstop = () => {
        const blob = new Blob(recordingChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        const extension = blob.type.includes("mp4") ? "m4a" : "webm";
        if (blob.size <= 5 * 1024 * 1024) {
          setPendingAttachment(
            new File([blob], `voice-note.${extension}`, { type: blob.type })
          );
        }
        recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
        recorderRef.current = null;
        setRecording(false);
      };
      recorder.start();
      setRecording(true);
      setChatError("");
    } catch {
      setChatError("Microphone access is unavailable or was denied.");
    }
  }

  function createPeerConnection() {
    const peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    peerConnectionRef.current = peerConnection;
    localStreamRef.current?.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStreamRef.current);
    });
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("callIceCandidate", {
          conversationId,
          candidate: event.candidate,
        });
      }
    };
    peerConnection.ontrack = (event) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = event.streams[0];
        remoteAudioRef.current.play().catch(() => {});
      }
    };
    return peerConnection;
  }

  async function startVoiceCall() {
    try {
      localStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const peerConnection = createPeerConnection();
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      socket.emit("callOffer", { conversationId, offer });
      setCallState("outgoing");
      setChatError("");
    } catch {
      setChatError("Unable to start the voice call. Check microphone access.");
    }
  }

  async function answerVoiceCall() {
    if (!incomingCall) return;
    try {
      localStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const peerConnection = createPeerConnection();
      await peerConnection.setRemoteDescription(incomingCall.offer);
      for (const candidate of pendingCandidatesRef.current.splice(0)) {
        await peerConnection.addIceCandidate(candidate);
      }
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      socket.emit("callAnswer", { conversationId, answer });
      setIncomingCall(null);
      setCallState("connected");
    } catch {
      setChatError("Unable to answer the voice call.");
      endVoiceCall();
    }
  }

  function endVoiceCall(notify = true) {
    if (notify && callState !== "idle") {
      socket.emit("callEnd", { conversationId, reason: "ended" });
    }
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    pendingCandidatesRef.current = [];
    setIncomingCall(null);
    setCallState("idle");
  }

  function handleSelectedTheme(nextTheme) {
    setTheme(nextTheme);
    localStorage.setItem(`twochat-theme-${conversationId}`, nextTheme);
  }

  async function enableNotifications() {
    if ("Notification" in window) {
      await Notification.requestPermission();
    }
    setShowChatOptions(false);
  }

  async function updateProfilePicture(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 700 * 1024) {
      setChatError("Choose a PNG, JPEG, or WebP image smaller than 700 KB.");
      return;
    }

    try {
      const profilePicture = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const response = await fetch("http://localhost:5000/api/auth/profile-picture", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ profilePicture }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Profile photo update failed.");
      localStorage.setItem("user", JSON.stringify(data.user));
      setChatError("");
      setShowChatOptions(false);
    } catch (error) {
      setChatError(error.message || "Unable to update profile photo.");
    }
  }

  async function saveProfilePhone() {
    try {
      const response = await fetch("http://localhost:5000/api/auth/profile-phone", {
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
      setProfilePhone(data.user.phone);
      setChatError("");
      setShowChatOptions(false);
    } catch (error) {
      setChatError(error.message || "Unable to update phone number.");
    }
  }


  async function markMessagesAsDelivered() {

    try {

      const response =
        await fetch(
          `http://localhost:5000/api/conversations/${conversationId}/delivered`,
          {
            method:
              "PATCH",

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
            "Failed to mark messages as delivered."
        );
      }


      console.log(
        "Messages marked as delivered:",
        data.modifiedCount
      );

    } catch (error) {

      console.error(
        "Mark delivered error:",
        error
      );
    }
  }


  async function markMessagesAsRead() {

    try {

      const response =
        await fetch(
          `http://localhost:5000/api/conversations/${conversationId}/read`,
          {
            method:
              "PATCH",

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
            "Failed to mark messages as read."
        );
      }


      console.log(
        "Messages marked as read:",
        data.modifiedCount
      );


      /*
       * Tell Socket.IO that the
       * conversation has been read.
       */
      socket.emit(
        "messagesRead",
        {
          conversationId,

          userId:
            currentUser.id,
        }
      );


      /*
       * Immediately update our own
       * local copy.
       */
      setMessages(
        (previousMessages) =>
          previousMessages.map(
            (message) => {

              const isMine =
                String(
                  message.senderId
                ) ===
                String(
                  currentUser.id
                );


              if (isMine) {
                return message;
              }


              return {
                ...message,

                deliveredTo:
                  Array.from(
                    new Set([
                      ...(message.deliveredTo ||
                        []),

                      currentUser.id,
                    ])
                  ),

                readBy:
                  Array.from(
                    new Set([
                      ...(message.readBy ||
                        []),

                      currentUser.id,
                    ])
                  ),
              };
            }
          )
      );

    } catch (error) {

      console.error(
        "Mark read error:",
        error
      );
    }
  }


  useEffect(() => {

    if (
      !conversationId ||
      !token ||
      !currentUser?.id
    ) {
      return;
    }


    async function loadConversation() {

      try {

        const response =
          await fetch(
            `http://localhost:5000/api/conversations/${conversationId}`,
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
              "Failed to load conversation."
          );
        }


        const conversation =
          data.conversation;


        if (!conversation) {
          return;
        }


        const members =
          conversation.members ||
          [];


        const partnerId =
          members.find(
            (memberId) =>
              String(
                memberId
              ) !==
              String(
                currentUser.id
              )
          );


        let foundPartner =
          null;


        if (
          conversation.users &&
          Array.isArray(
            conversation.users
          )
        ) {

          foundPartner =
            conversation.users.find(
              (user) =>
                String(
                  user.id
                ) !==
                String(
                  currentUser.id
                )
            );
        }


        if (foundPartner) {

          partnerRef.current = foundPartner;
          setPartner(
            foundPartner
          );

        } else if (
          partnerId
        ) {

          const fallbackPartner = {
            id:
              partnerId,

            name:
              "Chat Partner",

            email:
              "",
          };
          partnerRef.current = fallbackPartner;
          setPartner(fallbackPartner);
        }

      } catch (error) {

        console.error(
          error
        );
      }
    }


    async function loadMessages() {

      try {

        const response =
          await fetch(
            `http://localhost:5000/api/messages/${conversationId}`,
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
              "Failed to load messages."
          );
        }


        setMessages(
          data.messages ||
            []
        );

      } catch (error) {

        console.error(
          error
        );

      } finally {

        setLoading(
          false
        );
      }
    }


    /*
     * NEW MESSAGE
     */
    function handleNewMessage(
      message
    ) {

      if (
        String(
          message.conversationId
        ) !==
        String(
          conversationId
        )
      ) {
        return;
      }


      if (
        document.hidden &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        new Notification(partnerRef.current?.name || "TwoChat", {
          body: message.text || message.attachment?.name || "Sent an attachment",
          icon: partnerRef.current?.profilePicture || undefined,
          tag: `twochat-${conversationId}`,
        });
      }


      setMessages(
        (previousMessages) => {

          const exists =
            previousMessages.some(
              (item) =>
                String(
                  item.id
                ) ===
                String(
                  message.id
                )
            );


          if (exists) {

            return previousMessages.map(
              (item) =>
                String(
                  item.id
                ) ===
                String(
                  message.id
                )
                  ? {
                      ...item,
                      ...message,
                    }
                  : item
            );
          }


          return [
            ...previousMessages,
            message,
          ];
        }
      );


      /*
       * If the partner sends a message
       * while this conversation is open,
       * immediately mark it read.
       */
      if (
        String(
          message.senderId
        ) !==
        String(
          currentUser.id
        )
      ) {

        markDeliveredRef.current();
        markReadRef.current();
      }
    }


    /*
     * DELIVERY / READ STATUS
     */
    function handleMessageStatusUpdated(
      data
    ) {

      if (
        String(
          data.conversationId
        ) !==
        String(
          conversationId
        )
      ) {
        return;
      }


      const userId =
        String(
          data.userId
        );


      setMessages(
        (previousMessages) =>
          previousMessages.map(
            (message) => {

              /*
               * Delivery update.
               */
              if (
                data.status ===
                "delivered"
              ) {

                /*
                 * Only update messages
                 * that were sent by us.
                 */
                const isMine =
                  String(
                    message.senderId
                  ) ===
                  String(
                    currentUser.id
                  );


                if (!isMine) {
                  return message;
                }


                return {
                  ...message,

                  deliveredTo:
                    Array.from(
                      new Set([
                        ...(message.deliveredTo ||
                          []),

                        userId,
                      ])
                    ),
                };
              }


              /*
               * Read update.
               */
              if (
                data.status ===
                "read"
              ) {

                const isMine =
                  String(
                    message.senderId
                  ) ===
                  String(
                    currentUser.id
                  );


                if (!isMine) {
                  return message;
                }


                return {
                  ...message,

                  deliveredTo:
                    Array.from(
                      new Set([
                        ...(message.deliveredTo ||
                          []),

                        userId,
                      ])
                    ),

                  readBy:
                    Array.from(
                      new Set([
                        ...(message.readBy ||
                          []),

                        userId,
                      ])
                    ),
                };
              }


              return message;
            }
          )
      );
    }


    /*
     * OLD READ EVENT
     *
     * Kept for compatibility.
     */
    function handleMessagesRead(
      data
    ) {

      if (
        String(
          data.conversationId
        ) !==
        String(
          conversationId
        )
      ) {
        return;
      }


      const readerId =
        String(
          data.userId
        );


      setMessages(
        (previousMessages) =>
          previousMessages.map(
            (message) => {

              const isMine =
                String(
                  message.senderId
                ) ===
                String(
                  currentUser.id
                );


              if (!isMine) {
                return message;
              }


              return {
                ...message,

                deliveredTo:
                  Array.from(
                    new Set([
                      ...(message.deliveredTo ||
                        []),

                      readerId,
                    ])
                  ),

                readBy:
                  Array.from(
                    new Set([
                      ...(message.readBy ||
                        []),

                      readerId,
                    ])
                  ),
              };
            }
          )
      );
    }


    /*
     * CONVERSATION USERS
     */
    function handleConversationUsers(
      userIds
    ) {

      const otherUserIsOnline =
        userIds.some(
          (userId) =>
            String(
              userId
            ) !==
            String(
              currentUser.id
            )
        );


      setPartnerOnline(
        otherUserIsOnline
      );
    }


    /*
     * USER STATUS
     */
    function handleUserStatus(
      data
    ) {

      if (
        String(
          data.userId
        ) ===
        String(
          currentUser.id
        )
      ) {
        return;
      }


      setPartnerOnline(
        data.online
      );


      /*
       * If the partner just became
       * online, the server has already
       * marked pending messages as
       * delivered.
       *
       * The actual blue check is
       * received through
       * messageStatusUpdated.
       */
    }


    /*
     * TYPING
     */
    function handleUserTyping(
      data
    ) {

      if (
        String(
          data.userId
        ) !==
        String(
          currentUser.id
        )
      ) {

        setIsTyping(
          true
        );
      }
    }


    /*
     * STOP TYPING
     */
    function handleUserStoppedTyping(
      data
    ) {

      if (
        String(
          data.userId
        ) !==
        String(
          currentUser.id
        )
      ) {

        setIsTyping(
          false
        );
      }
    }


    function handleCallIncoming(data) {
      if (String(data.conversationId) !== String(conversationId)) return;
      setIncomingCall(data);
      setCallState("incoming");
    }


    async function handleCallAnswered(data) {
      if (String(data.conversationId) !== String(conversationId)) return;
      const peerConnection = peerConnectionRef.current;
      if (!peerConnection) return;
      await peerConnection.setRemoteDescription(data.answer);
      for (const candidate of pendingCandidatesRef.current.splice(0)) {
        await peerConnection.addIceCandidate(candidate);
      }
      setCallState("connected");
    }


    async function handleCallIceCandidate(data) {
      if (String(data.conversationId) !== String(conversationId)) return;
      const peerConnection = peerConnectionRef.current;
      if (!peerConnection?.remoteDescription) {
        pendingCandidatesRef.current.push(data.candidate);
        return;
      }
      await peerConnection.addIceCandidate(data.candidate);
    }


    function handleCallEnded(data) {
      if (String(data.conversationId) === String(conversationId)) {
        peerConnectionRef.current?.close();
        peerConnectionRef.current = null;
        localStreamRef.current?.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
        pendingCandidatesRef.current = [];
        setIncomingCall(null);
        setCallState("idle");
      }
    }


    /*
     * Register listeners BEFORE
     * connecting.
     */
    socket.on(
      "newMessage",
      handleNewMessage
    );


    socket.on(
      "messageStatusUpdated",
      handleMessageStatusUpdated
    );


    socket.on(
      "messagesRead",
      handleMessagesRead
    );


    socket.on(
      "conversationUsers",
      handleConversationUsers
    );


    socket.on(
      "userStatus",
      handleUserStatus
    );


    socket.on(
      "userTyping",
      handleUserTyping
    );


    socket.on(
      "userStoppedTyping",
      handleUserStoppedTyping
    );


    socket.on("callIncoming", handleCallIncoming);
    socket.on("callAnswered", handleCallAnswered);
    socket.on("callIceCandidate", handleCallIceCandidate);
    socket.on("callEnded", handleCallEnded);


    /*
     * Connect socket.
     */
    socket.auth = { token };
    socket.connect();


    /*
     * Tell server that we are online.
     */
    socket.emit(
      "userOnline",
      currentUser.id
    );


    /*
     * Join this conversation.
     */
    socket.emit(
      "joinConversation",
      conversationId
    );


    /*
     * Load data.
     */
    loadConversation();

    loadMessages();


    /*
     * Opening the conversation
     * means messages are delivered
     * and read.
     */
    markDeliveredRef.current();
    queueMicrotask(() => markReadRef.current());


    return () => {

      socket.off(
        "newMessage",
        handleNewMessage
      );


      socket.off(
        "messageStatusUpdated",
        handleMessageStatusUpdated
      );


      socket.off(
        "messagesRead",
        handleMessagesRead
      );


      socket.off(
        "conversationUsers",
        handleConversationUsers
      );


      socket.off(
        "userStatus",
        handleUserStatus
      );


      socket.off(
        "userTyping",
        handleUserTyping
      );


      socket.off(
        "userStoppedTyping",
        handleUserStoppedTyping
      );


      socket.off("callIncoming", handleCallIncoming);
      socket.off("callAnswered", handleCallAnswered);
      socket.off("callIceCandidate", handleCallIceCandidate);
      socket.off("callEnded", handleCallEnded);


      clearTimeout(
        typingTimeoutRef.current
      );

      peerConnectionRef.current?.close();
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());


      socket.disconnect();
    };

  }, [
    conversationId,
    token,
    currentUser?.id,
  ]);


  markDeliveredRef.current = markMessagesAsDelivered;
  markReadRef.current = markMessagesAsRead;


  useEffect(() => {

    scrollToBottom();

  }, [
    messages,
    isTyping,
  ]);


  async function sendMessage(
    event
  ) {

    event.preventDefault();


    const cleanText =
      text.trim();
    const selectedFile = pendingAttachment;
    let attachment = null;


    if (!cleanText && !selectedFile) {
      return;
    }

    if (selectedFile) {
      try {
        const data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(selectedFile);
        });
        attachment = {
          name: selectedFile.name,
          type: selectedFile.type || "application/octet-stream",
          size: selectedFile.size,
          data,
        };
      } catch {
        setChatError("Unable to read this file.");
        return;
      }
    }


    const temporaryId =
      `temp-${Date.now()}`;


    const temporaryMessage = {
      id:
        temporaryId,

      conversationId,

      senderId:
        currentUser.id,

      text:
        cleanText,

      attachment,

      deliveredTo: [
        currentUser.id,
      ],

      readBy: [
        currentUser.id,
      ],

      createdAt:
        new Date(),

      status:
        "sending",
    };


    setMessages(
      (previousMessages) => [
        ...previousMessages,
        temporaryMessage,
      ]
    );


    setText("");
    setPendingAttachment(null);
    setChatError("");


    try {

      const response =
        await fetch(
          "http://localhost:5000/api/messages",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${token}`,
            },

            body:
              JSON.stringify({
                conversationId,

                text:
                  cleanText,

                attachment,
              }),
          }
        );


      const data =
        await response.json();


      if (!response.ok) {

        throw new Error(
          data.message ||
            "Failed to send message."
        );
      }


      /*
       * Replace temporary message
       * with the real message.
       */
      setMessages(
        (previousMessages) =>
          previousMessages.map(
            (message) =>
              message.id ===
              temporaryId
                ? data.message
                : message
          )
      );


      /*
       * Send through Socket.IO.
       *
       * server.js will check whether
       * the receiver is online.
       */
      socket.emit(
        "sendMessage",
        data.message
      );


      socket.emit(
        "stopTyping",
        {
          conversationId,

          userId:
            currentUser.id,
        }
      );


      clearTimeout(
        typingTimeoutRef.current
      );


      setTimeout(
        () => {
          textareaRef.current?.focus();
        },
        0
      );

    } catch (error) {

      console.error(
        "Send message error:",
        error
      );


      setMessages(
        (previousMessages) =>
          previousMessages.map(
            (message) =>
              message.id ===
              temporaryId
                ? {
                    ...message,

                    status:
                      "failed",

                    deliveredTo: [],

                    readBy: [],
                  }
                : message
          )
      );


      setText(
        cleanText
      );
      setPendingAttachment(selectedFile);
    }
  }


  function getMessageStatus(
    message
  ) {

    /*
     * FAILED
     */
    if (
      message.status ===
      "failed"
    ) {
      return "failed";
    }


    /*
     * READ
     */
    const otherUserHasRead =
      message.readBy?.some(
        (userId) =>
          String(
            userId
          ) !==
          String(
            currentUser?.id
          )
      );


    if (
      otherUserHasRead
    ) {
      return "read";
    }


    /*
     * DELIVERED
     */
    const otherUserHasReceived =
      message.deliveredTo?.some(
        (userId) =>
          String(
            userId
          ) !==
          String(
            currentUser?.id
          )
      );


    if (
      otherUserHasReceived
    ) {
      return "delivered";
    }


    /*
     * SENT / NOT DELIVERED
     */
    return "sent";
  }


  const partnerName =
    partner?.name ||
    partner?.username ||
    "Chat Partner";


  const partnerPhone = partner?.phone || "";


  const partnerInitial =
    partnerName
      .charAt(0)
      .toUpperCase();


  if (loading) {

    return (
      <div className="chat">

        <div className="chat-loading">

          <div className="loading-circle"></div>

          <p>
            Opening conversation...
          </p>

        </div>

      </div>
    );
  }


  return (
    <div className={`chat theme-${theme}`}>

      <header className="chat-header">

        <button
          className="back-button"
          type="button"
          onClick={() =>
            navigate(-1)
          }
          aria-label="Go back"
        >
          ←
        </button>


        <div className="chat-avatar">
          {partner?.profilePicture ? (
            <img src={partner.profilePicture} alt="" />
          ) : (
            <span>{partnerInitial}</span>
          )}


          {partnerOnline && (
            <span className="online-dot"></span>
          )}

        </div>


        <div className="chat-info">

          <h1>
            {partnerName}
          </h1>


          <p
            className={
              partnerOnline
                ? "online"
                : ""
            }
          >
            {isTyping
              ? "Typing..."
              : partnerOnline
              ? "Online"
              : partnerPhone || "Offline"}
          </p>

        </div>


        <button
          className="header-button"
          type="button"
          onClick={startVoiceCall}
          aria-label="Start voice call"
          title="Voice call"
        >
          ☎
        </button>

        <button
          className="header-button"
          type="button"
          onClick={() => setShowChatOptions((visible) => !visible)}
          aria-label="Chat settings"
          title="Chat settings"
        >
          ⋮
        </button>

        {showChatOptions && (
          <div className="chat-options">
            <strong>Chat theme</strong>
            <div className="theme-options" aria-label="Choose chat theme">
              {[
                ["orange", "Orange"],
                ["blue", "Blue"],
                ["midnight", "Midnight"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`theme-choice ${value} ${theme === value ? "selected" : ""}`}
                  onClick={() => handleSelectedTheme(value)}
                  aria-label={`${label} theme`}
                  title={label}
                />
              ))}
            </div>
            <button type="button" onClick={() => profileInputRef.current?.click()}>
              Change profile picture
            </button>
            <label className="profile-phone-field">
              Registered phone number
              <input
                type="tel"
                autoComplete="tel"
                placeholder="+1 555 123 4567"
                value={profilePhone}
                onChange={(event) => setProfilePhone(event.target.value)}
              />
            </label>
            <button type="button" onClick={saveProfilePhone}>
              Save phone number
            </button>
            <button type="button" onClick={enableNotifications}>
              Enable message notifications
            </button>
          </div>
        )}

      </header>

      <input
        ref={profileInputRef}
        className="visually-hidden"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={updateProfilePicture}
      />

      {callState !== "idle" && (
        <section className="call-status" aria-live="polite">
          <span>
            {callState === "incoming"
              ? `${partnerName} is calling`
              : callState === "outgoing"
              ? `Calling ${partnerName}...`
              : "Voice call connected"}
          </span>
          {callState === "incoming" && (
            <button type="button" onClick={answerVoiceCall}>Answer</button>
          )}
          <button type="button" onClick={() => endVoiceCall()}>
            {callState === "incoming" ? "Decline" : "End call"}
          </button>
          <audio ref={remoteAudioRef} autoPlay />
        </section>
      )}


      <main className="chat-messages">

        <div className="chat-start">

          <div className="start-icon">
            🔒
          </div>


          <h2>
            Private conversation
          </h2>


          <p>
            Messages in this conversation
            are private between you and{" "}
            {partnerName}.
          </p>

        </div>


        {messages.length ===
        0 ? (

          <div className="empty">

            <div className="empty-icon">
              💬
            </div>


            <h3>
              Start the conversation
            </h3>


            <p>
              Send your first message to{" "}
              {partnerName}.
            </p>

          </div>

        ) : (

          messages.map(
            (message) => {

              const isMine =
                String(
                  message.senderId
                ) ===
                String(
                  currentUser?.id
                );


              const time =
                message.createdAt
                  ? new Date(
                      message.createdAt
                    ).toLocaleTimeString(
                      [],
                      {
                        hour:
                          "2-digit",

                        minute:
                          "2-digit",
                      }
                    )
                  : "";


              const messageStatus =
                isMine
                  ? getMessageStatus(
                      message
                    )
                  : null;


              return (
                <div
                  key={
                    message.id
                  }
                  className={
                    isMine
                      ? "message mine"
                      : "message"
                  }
                >

                  {message.text && (
                    <p className="message-text">{message.text}</p>
                  )}

                  {message.attachment && (
                    <div className="message-attachment">
                      {message.attachment.type?.startsWith("image/") ? (
                        <a href={message.attachment.data} target="_blank" rel="noreferrer">
                          <img src={message.attachment.data} alt={message.attachment.name} />
                        </a>
                      ) : message.attachment.type?.startsWith("audio/") ? (
                        <audio controls src={message.attachment.data} />
                      ) : (
                        <a
                          href={message.attachment.data}
                          download={message.attachment.name}
                        >
                          ↧ {message.attachment.name}
                        </a>
                      )}
                    </div>
                  )}


                  <div className="message-bottom">

                    <span className="message-time">
                      {time}
                    </span>


                    {isMine && (
                      <span
                        className={
                          `message-check ${messageStatus}`
                        }
                        aria-label={
                          messageStatus
                        }
                      >

                        {messageStatus ===
                        "failed"
                          ? "🚫"
                          : "✓✓"}

                      </span>
                    )}

                  </div>

                </div>
              );
            }
          )
        )}


        {isTyping && (
          <div className="typing">

            <span></span>
            <span></span>
            <span></span>

          </div>
        )}


        <div
          ref={
            messagesEndRef
          }
        />

      </main>


      <form
        className="chat-form"
        onSubmit={
          sendMessage
        }
      >

        {showEmojiPicker && (
          <div className="emoji-picker" aria-label="Choose an emoji">
            {["😀", "😂", "🥰", "😍", "😊", "😉", "😎", "😭", "😮", "👍", "❤️", "🎉"].map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleEmoji(emoji)}
                aria-label={`Insert ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        <input
          ref={attachmentInputRef}
          className="visually-hidden"
          type="file"
          onChange={handleAttachmentSelected}
        />

        {pendingAttachment && (
          <div className="attachment-chip">
            <span>{pendingAttachment.name}</span>
            <button
              type="button"
              onClick={() => setPendingAttachment(null)}
              aria-label="Remove attachment"
            >
              ×
            </button>
          </div>
        )}

        {chatError && <p className="chat-error">{chatError}</p>}

        <button
          className="composer-tool"
          type="button"
          onClick={() => attachmentInputRef.current?.click()}
          aria-label="Attach a file"
          title="Attach a file"
        >
          ＋
        </button>

        <button
          className="emoji-button"
          type="button"
          onClick={() => setShowEmojiPicker((visible) => !visible)}
          aria-label="Add emoji"
          title="Add emoji"
        >
          ☺
        </button>


        <textarea
          ref={
            textareaRef
          }
          value={text}
          onChange={
            handleTyping
          }
          onKeyDown={
            handleKeyDown
          }
          placeholder={
            `Message ${partnerName}...`
          }
          rows="1"
        />


        <button
          className={`composer-tool voice-note ${recording ? "recording" : ""}`}
          type="button"
          onClick={toggleVoiceRecording}
          aria-label={recording ? "Stop recording voice note" : "Record voice note"}
          title={recording ? "Stop recording" : "Record voice note"}
        >
          {recording ? "■" : "🎙"}
        </button>


        <button
          className="send-button"
          type="submit"
          disabled={
            !text.trim() && !pendingAttachment
          }
          aria-label="Send message"
        >
          ➤
        </button>

      </form>

    </div>
  );
}


export default Chat;