import React, { useState, useEffect, useRef } from 'react';
import SimplePeer from 'simple-peer';
import './App.css';
import { initializeApp } from "firebase/app";
import { getDatabase, ref, push, onValue, set, remove, serverTimestamp } from "firebase/database";

// ============================================
// FIREBASE CONFIGURATION
// ============================================

const firebaseConfig = {
  apiKey: "AIzaSyCJFeafEzvNsoK50dEAd9QcEYcUm1GCk-o",
  authDomain: "chat-app-private-45321.firebaseapp.com",
  projectId: "chat-app-private-45321",
  storageBucket: "chat-app-private-45321.firebasestorage.app",
  messagingSenderId: "459816028295",
  appId: "1:459816028295:web:29d428b1c15cddcf959022",
  databaseURL: "https://chat-app-private-45321-default-rtdb.firebaseio.com"
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const database = getDatabase(firebaseApp);

// ============================================
// USERS DATA
// ============================================

const USERS = [
  { id: 1, username: 'ashish', password: 'ashish123', name: 'Ashish Vijay', avatar: '👨‍💻', color: '#667eea' },
  { id: 2, username: 'user2', password: 'user2123', name: 'Sarah Chen', avatar: '👩‍💼', color: '#764ba2' },
  { id: 3, username: 'user3', password: 'user3123', name: 'Marcus Dev', avatar: '👨‍🔬', color: '#f093fb' },
  { id: 4, username: 'user4', password: 'user4123', name: 'Emma Design', avatar: '👩‍🎨', color: '#4facfe' },
  { id: 5, username: 'user5', password: 'user5123', name: 'Alex Tech', avatar: '👨‍💻', color: '#43e97b' },
];

// ============================================
// MAIN APP COMPONENT
// ============================================

export default function ChatApp() {
  const [currentUser, setCurrentUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messageInput, setMessageInput] = useState('');
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [callDuration, setCallDuration] = useState(0);

  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const messagesUnsubscribe = useRef(null);
  const callsUnsubscribe = useRef(null);
  const usersUnsubscribe = useRef(null);

  // ============================================
  // LISTEN TO ONLINE USERS
  // ============================================

  useEffect(() => {
    if (!currentUser) return;

    // Mark current user as online
    const userRef = ref(database, `users/${currentUser.id}`);
    set(userRef, {
      id: currentUser.id,
      name: currentUser.name,
      online: true,
      timestamp: serverTimestamp(),
    });

    // Listen to all online users
    const usersRef = ref(database, 'users');
    const unsubscribe = onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const onlineUserIds = Object.keys(data).map(key => parseInt(key));
        setOnlineUsers(onlineUserIds.filter(id => id !== currentUser.id));
      }
    });

    usersUnsubscribe.current = unsubscribe;

    // Cleanup on logout
    return () => {
      if (unsubscribe) unsubscribe();
      remove(userRef);
    };
  }, [currentUser]);

  // ============================================
  // LISTEN TO MESSAGES
  // ============================================

  useEffect(() => {
    if (!currentUser || !selectedUser) return;

    const chatId = Math.min(currentUser.id, selectedUser.id) + '_' + Math.max(currentUser.id, selectedUser.id);
    const messagesRef = ref(database, `messages/${chatId}`);

    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const messagesList = Object.entries(data).map(([key, value]) => ({
          id: key,
          ...value
        }));
        setMessages(messagesList.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0)));
      } else {
        setMessages([]);
      }
    });

    messagesUnsubscribe.current = unsubscribe;

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [currentUser, selectedUser]);

  // ============================================
  // LISTEN TO INCOMING CALLS
  // ============================================

  useEffect(() => {
    if (!currentUser) return;

    const callsRef = ref(database, `calls/${currentUser.id}`);

    const unsubscribe = onValue(callsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const latestCall = Object.entries(data).pop();
        if (latestCall) {
          const [key, callData] = latestCall;
          if (callData.type === 'incoming' && !incomingCall) {
            setIncomingCall({
              from: callData.fromId,
              fromName: callData.fromName,
              fromAvatar: callData.fromAvatar,
              offer: callData.offer,
              callId: key,
            });
          }
        }
      }
    });

    callsUnsubscribe.current = unsubscribe;

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [currentUser, incomingCall]);

  // ============================================
  // CALL DURATION TIMER
  // ============================================

  useEffect(() => {
    let interval;
    if (activeCall) {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeCall]);

  // ============================================
  // AUTH FUNCTIONS
  // ============================================

  const handleLogin = (username, password) => {
    const user = USERS.find(u => u.username === username && u.password === password);
    if (user) {
      setCurrentUser(user);
      setMessages([]);
      return true;
    }
    return false;
  };

  const handleLogout = () => {
    if (activeCall) {
      endCall();
    }
    if (messagesUnsubscribe.current) messagesUnsubscribe.current();
    if (callsUnsubscribe.current) callsUnsubscribe.current();
    if (usersUnsubscribe.current) usersUnsubscribe.current();
    
    setCurrentUser(null);
    setSelectedUser(null);
    setIncomingCall(null);
    setMessages([]);
  };

  // ============================================
  // CHAT FUNCTIONS
  // ============================================

  const sendMessage = async (e) => {
    e?.preventDefault();
    if (!messageInput.trim() || !selectedUser || !currentUser) return;

    try {
      const chatId = Math.min(currentUser.id, selectedUser.id) + '_' + Math.max(currentUser.id, selectedUser.id);
      const messagesRef = ref(database, `messages/${chatId}`);

      await push(messagesRef, {
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderAvatar: currentUser.avatar,
        text: messageInput,
        timestamp: serverTimestamp(),
      });

      setMessageInput('');
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Error sending message. Please try again.');
    }
  };

  const clearChat = async () => {
    if (!window.confirm('Clear all messages with this user?')) return;

    try {
      const chatId = Math.min(currentUser.id, selectedUser.id) + '_' + Math.max(currentUser.id, selectedUser.id);
      const messagesRef = ref(database, `messages/${chatId}`);
      await remove(messagesRef);
      setMessages([]);
    } catch (error) {
      console.error('Error clearing chat:', error);
    }
  };

  // ============================================
  // VOICE CALL FUNCTIONS
  // ============================================

  const initiateCall = async (targetUser) => {
    if (!targetUser || !currentUser) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      localStreamRef.current = stream;

      const peer = new SimplePeer({
        initiator: true,
        trickleIce: false,
        stream: stream,
      });

      peerRef.current = peer;

      peer.on('signal', async (offer) => {
        try {
          const callsRef = ref(database, `calls/${targetUser.id}`);
          await push(callsRef, {
            type: 'incoming',
            fromId: currentUser.id,
            fromName: currentUser.name,
            fromAvatar: currentUser.avatar,
            offer: JSON.stringify(offer),
          });
        } catch (error) {
          console.error('Error sending call offer:', error);
        }
      });

      peer.on('stream', (remoteStream) => {
        console.log('Remote stream received');
      });

      peer.on('error', (err) => {
        console.error('Peer error:', err);
        endCall();
        alert('Call error: ' + err.message);
      });

      peer.on('close', () => {
        endCall();
      });

      setActiveCall({
        targetUserId: targetUser.id,
        targetUserName: targetUser.name,
        targetUserAvatar: targetUser.avatar,
      });
      setCallDuration(0);
    } catch (err) {
      alert('Microphone access denied. Please allow microphone access in browser settings.');
    }
  };

  const acceptCall = async () => {
    if (!incomingCall || !currentUser) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      localStreamRef.current = stream;

      const peer = new SimplePeer({
        initiator: false,
        trickleIce: false,
        stream: stream,
      });

      peerRef.current = peer;

      peer.on('signal', async (answer) => {
        try {
          const callsRef = ref(database, `calls/${incomingCall.from}`);
          await push(callsRef, {
            type: 'answer',
            fromId: currentUser.id,
            answer: JSON.stringify(answer),
          });
        } catch (error) {
          console.error('Error sending answer:', error);
        }
      });

      peer.on('stream', (remoteStream) => {
        console.log('Remote stream received');
      });

      peer.on('error', (err) => {
        console.error('Peer error:', err);
        endCall();
      });

      try {
        peer.signal(JSON.parse(incomingCall.offer));
      } catch (e) {
        console.log('Offer parse error:', e);
      }

      setActiveCall({
        targetUserId: incomingCall.from,
        targetUserName: incomingCall.fromName,
        targetUserAvatar: incomingCall.fromAvatar,
      });
      setIncomingCall(null);
      setCallDuration(0);
    } catch (err) {
      alert('Microphone access denied');
    }
  };

  const rejectCall = () => {
    setIncomingCall(null);
  };

  const endCall = () => {
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    setActiveCall(null);
    setIncomingCall(null);
    setCallDuration(0);
  };

  // ============================================
  // RENDER LOGIN
  // ============================================

  if (!currentUser) {
    return <LoginScreen users={USERS} onLogin={handleLogin} />;
  }

  // ============================================
  // RENDER CHAT APP
  // ============================================

  const selectedUserData = selectedUser ? USERS.find(u => u.id === selectedUser.id) : null;

  return (
    <div className="chat-app">
      {/* INCOMING CALL NOTIFICATION */}
      {incomingCall && (
        <IncomingCallNotification
          caller={USERS.find(u => u.id === incomingCall.from)}
          onAccept={acceptCall}
          onReject={rejectCall}
        />
      )}

      {/* ACTIVE CALL OVERLAY */}
      {activeCall && (
        <ActiveCallOverlay
          targetUser={USERS.find(u => u.id === activeCall.targetUserId)}
          onEndCall={endCall}
          duration={callDuration}
        />
      )}

      <div className="chat-container">
        {/* HEADER */}
        <header className="chat-header">
          <div className="header-content">
            <div className="header-title">
              <span className="logo">🔮</span>
              <div>
                <h1>Chat & Call</h1>
                <p>Private Team Communication</p>
              </div>
            </div>
            <div className="user-info">
              <span className="user-badge">
                {currentUser.avatar} {currentUser.name}
              </span>
              <button onClick={handleLogout} className="logout-btn">Logout</button>
            </div>
          </div>
        </header>

        <div className="chat-main">
          {/* USERS SIDEBAR */}
          <aside className="users-sidebar">
            <div className="sidebar-header">
              <h2>Team Members ({USERS.length - 1})</h2>
              <span className="online-count">{onlineUsers.length} online</span>
            </div>
            <div className="users-list">
              {USERS.filter(u => u.id !== currentUser.id).map(user => {
                const isOnline = onlineUsers.includes(user.id);
                return (
                  <div
                    key={user.id}
                    className={`user-item ${selectedUser?.id === user.id ? 'active' : ''}`}
                    onClick={() => setSelectedUser(user)}
                  >
                    <div className="user-avatar-container">
                      <span className="user-avatar">{user.avatar}</span>
                      <span className="online-indicator">{isOnline ? '🟢' : '⚪'}</span>
                    </div>
                    <div className="user-details">
                      <p className="user-name">{user.name}</p>
                      <p className="user-status">{isOnline ? 'Online' : 'Offline'}</p>
                    </div>
                    {selectedUser?.id === user.id && (
                      <button
                        className="call-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!activeCall && isOnline) initiateCall(user);
                        }}
                        disabled={activeCall || !isOnline}
                        title={!isOnline ? 'User offline' : activeCall ? 'Call in progress' : 'Start voice call'}
                      >
                        📞
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </aside>

          {/* CHAT AREA */}
          <main className="chat-area">
            {selectedUserData ? (
              <>
                {/* CHAT HEADER */}
                <div className="chat-area-header">
                  <div className="chat-user-info">
                    <span className="chat-avatar">{selectedUserData.avatar}</span>
                    <div>
                      <h2>{selectedUserData.name}</h2>
                      <p className="chat-status">{onlineUsers.includes(selectedUserData.id) ? '🟢 Online' : '⚪ Offline'}</p>
                    </div>
                  </div>
                  <button className="clear-chat-btn" onClick={clearChat} title="Clear chat history">
                    🗑️
                  </button>
                </div>

                {/* MESSAGES */}
                <div className="messages-container">
                  {messages.length === 0 ? (
                    <div className="no-messages">
                      <p>No messages yet</p>
                      <p>Start the conversation!</p>
                    </div>
                  ) : (
                    messages.map((msg, idx) => (
                      <div key={idx} className={`message ${msg.senderId === currentUser.id ? 'sent' : 'received'}`}>
                        <div className="message-bubble">
                          <p className="message-text">{msg.text}</p>
                          <span className="message-time">
                            {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* MESSAGE INPUT */}
                <form onSubmit={sendMessage} className="message-input-form">
                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder="Type a message..."
                    className="message-input"
                    autoFocus
                  />
                  <button type="submit" className="send-btn" disabled={!messageInput.trim()}>
                    ➤
                  </button>
                </form>
              </>
            ) : (
              <div className="no-user-selected">
                <p>👈 Select a team member to start chatting</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

// ============================================
// LOGIN SCREEN COMPONENT
// ============================================

function LoginScreen({ users, onLogin }) {
  const [username, setUsername] = useState('ashish');
  const [password, setPassword] = useState('ashish123');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onLogin(username, password)) {
      setError('');
    } else {
      setError('Invalid username or password');
    }
  };

  return (
    <div className="login-screen">
      <div className="login-container">
        <div className="login-header">
          <span className="login-logo">🔮</span>
          <h1>Chat & Call</h1>
          <p>Private Team Communication App</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              className="form-input"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="form-input"
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          {error && <p className="error-message">{error}</p>}

          <button type="submit" className="login-btn">Login</button>
        </form>

        <div className="test-credentials">
          <p>📋 Test Credentials</p>
          <div className="credentials-grid">
            {users.map(user => (
              <div key={user.id} className="credential-card">
                <button
                  type="button"
                  className="credential-btn"
                  onClick={() => {
                    setUsername(user.username);
                    setPassword(user.password);
                    setError('');
                  }}
                >
                  <span className="avatar">{user.avatar}</span>
                  <div className="credential-text">
                    <p className="credential-name">{user.name}</p>
                    <p className="credential-user">@{user.username}</p>
                  </div>
                </button>
              </div>
            ))}
          </div>
          <p className="credentials-note">Click a user to auto-fill credentials, then login</p>
        </div>

        <div className="login-footer">
          <p>🔒 Secure • 🌐 Browser-based • 📱 Works on all devices</p>
        </div>
      </div>
    </div>
  );
}

// ============================================
// INCOMING CALL NOTIFICATION
// ============================================

function IncomingCallNotification({ caller, onAccept, onReject }) {
  return (
    <div className="incoming-call-notification">
      <div className="notification-content">
        <span className="caller-avatar">{caller.avatar}</span>
        <p className="caller-text"><strong>{caller.name}</strong> is calling...</p>
        <div className="notification-buttons">
          <button onClick={onAccept} className="accept-btn">✅ Accept</button>
          <button onClick={onReject} className="reject-btn">❌ Reject</button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// ACTIVE CALL OVERLAY
// ============================================

function ActiveCallOverlay({ targetUser, onEndCall, duration }) {
  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="active-call-overlay">
      <div className="call-window">
        <div className="call-content">
          <span className="call-avatar">{targetUser.avatar}</span>
          <p className="call-label">In Call with</p>
          <p className="call-user">{targetUser.name}</p>
          <p className="call-duration">{formatDuration(duration)}</p>
        </div>
        <button onClick={onEndCall} className="end-call-btn">
          📞
        </button>
      </div>
    </div>
  );
}
