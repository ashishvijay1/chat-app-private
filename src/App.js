import React, { useState, useEffect, useRef } from 'react';
import SimplePeer from 'simple-peer';
import './App.css';

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
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);


  // ============================================
  // SOCKET CONNECTION
  // ============================================

  useEffect(() => {
    if (currentUser) {
      // Initialize local state for online users
      const allUserIds = USERS.map(u => u.id);
      setOnlineUsers(allUserIds);

      // Simulate real-time updates
      const interval = setInterval(() => {
        // Randomly toggle user online status for demo
        // In production, this would be handled by WebSocket
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [currentUser]);

  // ============================================
  // AUTH FUNCTIONS
  // ============================================

  const handleLogin = (username, password) => {
    const user = USERS.find(u => u.username === username && u.password === password);
    if (user) {
      setCurrentUser(user);
      localStorage.setItem('currentUser', JSON.stringify(user));
      // Load saved messages from localStorage
      const savedMessages = localStorage.getItem('messages');
      if (savedMessages) {
        setMessages(JSON.parse(savedMessages));
      }
      return true;
    }
    return false;
  };

  const handleLogout = () => {
    if (activeCall) {
      endCall();
    }
    setCurrentUser(null);
    setSelectedUser(null);
    setIncomingCall(null);
    localStorage.removeItem('currentUser');
  };

  // ============================================
  // CHAT FUNCTIONS
  // ============================================

  const sendMessage = (e) => {
    e?.preventDefault();
    if (!messageInput.trim() || !selectedUser) return;

    const newMessage = {
      id: Date.now(),
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      recipientId: selectedUser.id,
      text: messageInput,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: new Date().toLocaleDateString(),
    };

    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);
    localStorage.setItem('messages', JSON.stringify(updatedMessages));
    setMessageInput('');
  };

  const getConversationMessages = () => {
    if (!selectedUser) return [];
    return messages.filter(m => 
      (m.senderId === currentUser.id && m.recipientId === selectedUser.id) ||
      (m.senderId === selectedUser.id && m.recipientId === currentUser.id)
    ).sort((a, b) => a.id - b.id);
  };

  const clearChat = () => {
    if (window.confirm('Clear all messages with this user?')) {
      const updatedMessages = messages.filter(m =>
        !((m.senderId === currentUser.id && m.recipientId === selectedUser.id) ||
          (m.senderId === selectedUser.id && m.recipientId === currentUser.id))
      );
      setMessages(updatedMessages);
      localStorage.setItem('messages', JSON.stringify(updatedMessages));
    }
  };

  // ============================================
  // VOICE CALL FUNCTIONS
  // ============================================

  const initiateCall = async (targetUser) => {
    if (!targetUser) return;

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

      peer.on('signal', (offer) => {
        // In production, send this via WebSocket to the target user
        console.log('Call offer generated');
        // Simulate incoming call notification on the other user
        setIncomingCall({
          from: currentUser.id,
          fromName: currentUser.name,
          fromAvatar: currentUser.avatar,
          offer: offer,
          targetId: targetUser.id,
        });
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
    } catch (err) {
      alert('Microphone access denied. Please allow microphone access in browser settings.');
    }
  };

  const acceptCall = () => {
    if (!incomingCall) return;

    try {
      navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      }).then(stream => {
        localStreamRef.current = stream;

        const peer = new SimplePeer({
          initiator: false,
          trickleIce: false,
          stream: stream,
        });

        peerRef.current = peer;

        peer.on('signal', (answer) => {
          console.log('Call answer sent');
        });

        peer.on('stream', (remoteStream) => {
          console.log('Remote stream received');
        });

        peer.on('error', (err) => {
          console.error('Peer error:', err);
          endCall();
        });

        peer.signal(incomingCall.offer);

        setActiveCall({
          targetUserId: incomingCall.from,
          targetUserName: incomingCall.fromName,
          targetUserAvatar: incomingCall.fromAvatar,
        });
        setIncomingCall(null);
      });
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

  const conversationMessages = getConversationMessages();
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
              {USERS.filter(u => u.id !== currentUser.id).map(user => (
                <div
                  key={user.id}
                  className={`user-item ${selectedUser?.id === user.id ? 'active' : ''}`}
                  onClick={() => setSelectedUser(user)}
                >
                  <div className="user-avatar-container">
                    <span className="user-avatar">{user.avatar}</span>
                    <span className="online-indicator">🟢</span>
                  </div>
                  <div className="user-details">
                    <p className="user-name">{user.name}</p>
                    <p className="user-status">Online</p>
                  </div>
                  {selectedUser?.id === user.id && (
                    <button
                      className="call-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!activeCall) initiateCall(user);
                      }}
                      disabled={activeCall ? true : false}
                      title={activeCall ? 'Call in progress' : 'Start voice call'}
                    >
                      📞
                    </button>
                  )}
                </div>
              ))}
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
                      <p className="chat-status">🟢 Online</p>
                    </div>
                  </div>
                  <button className="clear-chat-btn" onClick={clearChat} title="Clear chat history">
                    🗑️
                  </button>
                </div>

                {/* MESSAGES */}
                <div className="messages-container">
                  {conversationMessages.length === 0 ? (
                    <div className="no-messages">
                      <p>No messages yet</p>
                      <p>Start the conversation!</p>
                    </div>
                  ) : (
                    conversationMessages.map(msg => (
                      <div key={msg.id} className={`message ${msg.senderId === currentUser.id ? 'sent' : 'received'}`}>
                        <div className="message-bubble">
                          <p className="message-text">{msg.text}</p>
                          <span className="message-time">{msg.timestamp}</span>
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

function ActiveCallOverlay({ targetUser, onEndCall }) {
  const [callDuration, setCallDuration] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

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
          <p className="call-duration">{formatDuration(callDuration)}</p>
        </div>
        <button onClick={onEndCall} className="end-call-btn">
          📞
        </button>
      </div>
    </div>
  );
}