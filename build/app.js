"use strict";
(() => {
  // src/online/socketClient.ts
  var AUTH_STORAGE_KEY = "travel_board_auth_user";
  var authClientState = {
    isReady: false,
    user: null
  };
  function loadSavedAuthUser() {
    try {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.username) return null;
      return parsed;
    } catch {
      return null;
    }
  }
  function saveAuthUser(user) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  }
  function createLocalAuthUser(username, displayName) {
    const cleanUsername = username.trim();
    return {
      id: cleanUsername.toLowerCase(),
      username: cleanUsername,
      displayName: displayName?.trim() || cleanUsername
    };
  }
  async function loginAccount(payload) {
    const username = payload.username.trim();
    if (!username) {
      throw new Error("Nh\u1EADp username tr\u01B0\u1EDBc.");
    }
    if (!payload.password) {
      throw new Error("Nh\u1EADp password tr\u01B0\u1EDBc.");
    }
    const user = createLocalAuthUser(username);
    authClientState.user = user;
    authClientState.isReady = true;
    saveAuthUser(user);
    return user;
  }
  async function registerAccount(payload) {
    const username = payload.username.trim();
    if (!username) {
      throw new Error("Nh\u1EADp username tr\u01B0\u1EDBc.");
    }
    if (!payload.password || payload.password.length < 6) {
      throw new Error("Password c\u1EA7n \xEDt nh\u1EA5t 6 k\xFD t\u1EF1.");
    }
    const user = createLocalAuthUser(username, payload.displayName);
    authClientState.user = user;
    authClientState.isReady = true;
    saveAuthUser(user);
    return user;
  }
  function logoutAccount() {
    authClientState.user = null;
    authClientState.isReady = true;
    onlineClientState.roomId = null;
    onlineClientState.playerId = null;
    onlineClientState.roomState = null;
    localStorage.removeItem(AUTH_STORAGE_KEY);
    clearSavedOnlineSession();
  }
  var socket = io("http://localhost:3001");
  var ONLINE_SESSION_STORAGE_KEY = "travel_board_online_session";
  var onlineClientState = {
    roomId: null,
    playerId: null,
    roomState: null
  };
  function clearLegacySharedOnlineSession() {
    localStorage.removeItem(ONLINE_SESSION_STORAGE_KEY);
  }
  clearLegacySharedOnlineSession();
  function saveOnlineSession(playerName) {
    if (!onlineClientState.roomId || !onlineClientState.playerId) return;
    localStorage.removeItem(ONLINE_SESSION_STORAGE_KEY);
    sessionStorage.setItem(
      ONLINE_SESSION_STORAGE_KEY,
      JSON.stringify({
        roomId: onlineClientState.roomId,
        playerId: onlineClientState.playerId,
        playerName: playerName ?? onlineClientState.roomState?.players[onlineClientState.playerId]?.name ?? "Player"
      })
    );
  }
  function getSavedOnlineSession() {
    const raw = sessionStorage.getItem(ONLINE_SESSION_STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      sessionStorage.removeItem(ONLINE_SESSION_STORAGE_KEY);
      return null;
    }
  }
  function clearSavedOnlineSession() {
    sessionStorage.removeItem(ONLINE_SESSION_STORAGE_KEY);
    localStorage.removeItem(ONLINE_SESSION_STORAGE_KEY);
    onlineClientState.roomId = null;
    onlineClientState.playerId = null;
    onlineClientState.roomState = null;
  }
  function initOnlineClient(onStateChange) {
    const savedUser = loadSavedAuthUser();
    authClientState.user = savedUser;
    authClientState.isReady = true;
    window.setTimeout(onStateChange, 0);
    socket.on("connect", () => {
      const savedSession = getSavedOnlineSession();
      if (!savedSession || onlineClientState.roomState) return;
      socket.emit("room:reconnect", savedSession);
    });
    socket.on("room:joined", (payload) => {
      onlineClientState.roomId = payload.roomId;
      onlineClientState.playerId = payload.playerId;
      onlineClientState.roomState = payload.state;
      saveOnlineSession(payload.state.players[payload.playerId]?.name);
      console.log("Joined room:", payload.roomId, "as", payload.playerId);
      onStateChange();
    });
    socket.on("room:state", (state) => {
      onlineClientState.roomState = state;
      onStateChange();
    });
    socket.on("game:error", (payload) => {
      alert(payload.message);
    });
    socket.on("connect_error", () => {
      console.warn("Kh\xF4ng k\u1EBFt n\u1ED1i \u0111\u01B0\u1EE3c socket server. Ki\u1EC3m tra server port 3001.");
    });
    socket.on("room:left", () => {
      clearSavedOnlineSession();
      onStateChange();
    });
  }
  function createOnlineRoom(playerName) {
    if (!socket.connected) {
      socket.connect();
    }
    socket.emit("room:create", {
      playerName
    });
  }
  function joinOnlineRoom(roomId, playerName) {
    if (!socket.connected) {
      socket.connect();
    }
    socket.emit("room:join", {
      roomId,
      playerName
    });
  }
  function reconnectOnlineRoom(roomId, playerId, playerName) {
    socket.emit("room:reconnect", {
      roomId,
      playerId,
      playerName
    });
  }
  function setOnlineReady(isReady) {
    if (!onlineClientState.roomId || !onlineClientState.playerId) {
      return;
    }
    socket.emit("room:setReady", {
      roomId: onlineClientState.roomId,
      playerId: onlineClientState.playerId,
      isReady
    });
  }
  function leaveOnlineRoom() {
    if (!onlineClientState.roomId || !onlineClientState.playerId) {
      clearSavedOnlineSession();
      return;
    }
    socket.emit("room:leave", {
      roomId: onlineClientState.roomId,
      playerId: onlineClientState.playerId
    });
    clearSavedOnlineSession();
  }
  function startOnlineGame() {
    if (!onlineClientState.roomId || !onlineClientState.playerId) {
      return;
    }
    socket.emit("game:start", {
      roomId: onlineClientState.roomId,
      playerId: onlineClientState.playerId
    });
  }
  function selectOnlineDraftCard(cardId) {
    if (!onlineClientState.roomId || !onlineClientState.playerId) {
      return;
    }
    socket.emit("draft:selectCard", {
      roomId: onlineClientState.roomId,
      playerId: onlineClientState.playerId,
      cardId
    });
  }
  function sendPlaceCard(payload) {
    if (!onlineClientState.roomId || !onlineClientState.playerId) {
      return;
    }
    socket.emit("planning:placeCard", {
      roomId: onlineClientState.roomId,
      playerId: onlineClientState.playerId,
      ...payload
    });
  }
  function sendDiscardCard(payload) {
    if (!onlineClientState.roomId || !onlineClientState.playerId) {
      return;
    }
    socket.emit("planning:discardCard", {
      roomId: onlineClientState.roomId,
      playerId: onlineClientState.playerId,
      ...payload
    });
  }
  function sendPayDebt(payload) {
    if (!onlineClientState.roomId || !onlineClientState.playerId) {
      return;
    }
    socket.emit("planning:payDebt", {
      roomId: onlineClientState.roomId,
      playerId: onlineClientState.playerId,
      ...payload
    });
  }
  function sendReturnBoardCard(payload) {
    if (!onlineClientState.roomId || !onlineClientState.playerId) {
      return;
    }
    socket.emit("planning:returnBoardCard", {
      roomId: onlineClientState.roomId,
      playerId: onlineClientState.playerId,
      ...payload
    });
  }

  // src/ui/mapSelection.ts
  function renderMapCardWrapper(content, extraClass = "") {
    return `<div class="map-card-col ${extraClass}">${content}</div>`;
  }
  function renderMapSelectionScreen() {
    const user = authClientState.user;
    const displayName = user?.displayName || user?.username || "Nh\xE0 L\u1EEF H\xE0nh";
    return `
    <div class="map-selection-screen">
      <header class="hub-topbar">
        <div class="hub-topbar__logo">TREKPOLOGY</div>
        <nav class="hub-topbar__nav">
          <button onclick="window.gotoDashboard()">\u2190 Quay l\u1EA1i Trang Ch\u1EE7</button>
        </nav>
        <div class="hub-topbar__user">${displayName}</div>
      </header>

      <div class="map-selection__container">
        <div class="map-selection__header">
          <h2>Ch\u1ECDn \u0110i\u1EC3m \u0110\u1EBFn</h2>
          <p>H\xE0nh tr\xECnh ti\u1EBFp theo c\u1EE7a b\u1EA1n s\u1EBD b\u1EAFt \u0111\u1EA7u t\u1EEB \u0111\xE2u?</p>
        </div>

        <div class="map-grid">

          ${renderMapCardWrapper(`
            <div class="map-card map-card--active">
              <div class="map-card__bg" style="background-image: url('./assets/saigon.jpg')"></div>
              <div class="map-card__overlay"></div>
              <div class="map-card__content">
                <span class="map-card__badge">\u0110\xE3 M\u1EDF Kho\xE1</span>
                <div class="map-card__info">
                  <h3 class="map-card__title">S\xC0I G\xD2N</h3>
                  <p class="map-card__desc">Th\xE0nh ph\u1ED1 kh\xF4ng ng\u1EE7, trung t\xE2m kinh t\u1EBF v\xE0 v\u0103n ho\xE1 s\xF4i \u0111\u1ED9ng b\u1EADc nh\u1EA5t.</p>
                </div>
                <div class="map-card__actions">
                  <button class="map-card__btn map-card__btn--primary" onclick="window.gotoOnlineLobby()">T\xECm Tr\u1EADn</button>
                  <button class="map-card__btn map-card__btn--secondary" onclick="window.gotoOnlineLobby()">T\u1EA1o Ph\xF2ng</button>
                </div>
              </div>
            </div>
          `)}

          ${renderMapCardWrapper(`
            <div class="map-card map-card--locked">
              <div class="map-card__bg" style="background-image: url('./assets/danang.jpg')"></div>
              <div class="map-card__overlay"></div>
              <div class="map-card__content">
                <span class="map-card__badge map-card__badge--locked">S\u1EAFp ra m\u1EAFt</span>
                <div class="map-card__info">
                  <h3 class="map-card__title">\u0110\xC0 N\u1EB4NG</h3>
                  <p class="map-card__desc">Th\xE0nh ph\u1ED1 \u0111\xE1ng s\u1ED1ng v\u1EDBi nh\u1EEFng c\xE2y c\u1EA7u \u0111\u1ED9c \u0111\xE1o v\xE0 b\u1EDD bi\u1EC3n quy\u1EBFn r\u0169.</p>
                </div>
              </div>
            </div>
          `)}

          ${renderMapCardWrapper(`
            <div class="map-card map-card--locked">
              <div class="map-card__bg" style="background-image: url('./assets/hanoi.jpeg')"></div>
              <div class="map-card__overlay"></div>
              <div class="map-card__content">
                <span class="map-card__badge map-card__badge--locked">S\u1EAFp ra m\u1EAFt</span>
                <div class="map-card__info">
                  <h3 class="map-card__title">H\xC0 N\u1ED8I</h3>
                  <p class="map-card__desc">Th\u1EE7 \u0111\xF4 ng\xE0n n\u0103m v\u0103n hi\u1EBFn, ph\u1ED1 c\u1ED5 th\xE2m tr\u1EA7m v\xE0 nh\u1EEFng g\xE1nh h\xE0ng hoa.</p>
                </div>
              </div>
            </div>
          `)}

          ${renderMapCardWrapper(`
            <div class="map-card map-card--locked">
              <div class="map-card__bg" style="background-image: url('https://images.unsplash.com/photo-1599839619722-39751411ea63?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80')"></div>
              <div class="map-card__overlay"></div>
              <div class="map-card__content">
                <span class="map-card__badge map-card__badge--locked">S\u1EAFp ra m\u1EAFt</span>
                <div class="map-card__info">
                  <h3 class="map-card__title">\u0110\xC0 L\u1EA0T</h3>
                  <p class="map-card__desc">Th\xE0nh ph\u1ED1 s\u01B0\u01A1ng m\xF9 l\xE3ng m\u1EA1n, r\u1EEBng th\xF4ng reo v\xE0 th\u1EDDi ti\u1EBFt se l\u1EA1nh quanh n\u0103m.</p>
                </div>
              </div>
            </div>
          `)}

        </div>
      </div>
    </div>
  `;
  }

  // src/ui/dashboard.ts
  var HERO_VIDEO_SRC = "./assets/videos/one-minute-in-vietnam.mp4";
  function initDashboardHub() {
    const media = document.getElementById("hub-hero-media");
    const video = document.getElementById("hub-hero-video");
    const hitarea = document.getElementById("hub-hero-video-hitarea");
    const muteButton = document.getElementById("hub-hero-video-mute");
    if (!media || !video || !hitarea || !muteButton) return;
    video.playsInline = true;
    video.volume = 0.85;
    const updateVideoStatus = () => {
      media.classList.toggle("hub-hero__media--paused", video.paused);
      muteButton.classList.toggle("hub-hero__video-mute--muted", video.muted);
      muteButton.classList.toggle("hub-hero__video-mute--unmuted", !video.muted);
      muteButton.setAttribute("aria-label", video.muted ? "B\u1EADt ti\u1EBFng video" : "T\u1EAFt ti\u1EBFng video");
      muteButton.setAttribute("aria-pressed", video.muted ? "true" : "false");
      if (video.paused) {
        hitarea.setAttribute("aria-label", "Ti\u1EBFp t\u1EE5c video");
        return;
      }
      hitarea.setAttribute("aria-label", "T\u1EA1m d\u1EEBng video");
    };
    const tryAutoplay = async () => {
      video.muted = false;
      try {
        await video.play();
        updateVideoStatus();
        return;
      } catch {
        video.muted = true;
        try {
          await video.play();
        } catch {
        }
        updateVideoStatus();
      }
    };
    muteButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      video.muted = !video.muted;
      if (!video.paused) {
        void video.play();
      }
      updateVideoStatus();
    });
    hitarea.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (video.paused) {
        void video.play();
      } else {
        video.pause();
      }
      updateVideoStatus();
    });
    video.addEventListener("play", updateVideoStatus);
    video.addEventListener("pause", updateVideoStatus);
    video.addEventListener("volumechange", updateVideoStatus);
    void tryAutoplay();
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      video.addEventListener("loadeddata", () => {
        void tryAutoplay();
      }, { once: true });
    }
  }
  function renderHubHeroMedia() {
    return `
    <div class="hub-hero__media" id="hub-hero-media">
      <div class="hub-hero__video-fallback" aria-hidden="true">
        <div class="hero-placeholder-pattern"></div>
      </div>
      <video
        id="hub-hero-video"
        class="hub-hero__video"
        autoplay
        loop
        playsinline
        preload="auto"
      >
        <source src="${HERO_VIDEO_SRC}" type="video/mp4" />
      </video>
      <div class="hub-hero__scrim" aria-hidden="true"></div>
      <button
        type="button"
        class="hub-hero__hitarea"
        id="hub-hero-video-hitarea"
        aria-label="\u0110i\u1EC1u khi\u1EC3n video n\u1EC1n"
      ></button>
      <button
        type="button"
        class="hub-hero__video-mute hub-hero__video-mute--muted"
        id="hub-hero-video-mute"
        aria-label="B\u1EADt ti\u1EBFng video"
        aria-pressed="true"
      >
        <svg class="hub-hero__video-mute-icon hub-hero__video-mute-icon--off" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            fill="currentColor"
            d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z"
          />
        </svg>
        <svg class="hub-hero__video-mute-icon hub-hero__video-mute-icon--on" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            fill="currentColor"
            d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"
          />
        </svg>
      </button>
    </div>
  `;
  }
  function renderHubAuthPanel() {
    return `
    <section class="hub-auth" id="hub-auth">
      <div class="hub-auth__header">
        <span class="hub-auth__eyebrow">T\xC0I KHO\u1EA2N</span>
        <h3 class="hub-auth__title">B\u1EAFt \u0111\u1EA7u h\xE0nh tr\xECnh</h3>
        <p class="hub-auth__lead">\u0110\u0103ng nh\u1EADp ho\u1EB7c t\u1EA1o t\xE0i kho\u1EA3n \u0111\u1EC3 t\u1EA1o ph\xF2ng, join b\u1EA1n b\xE8 v\xE0 l\u01B0u ti\u1EBFn tr\xECnh.</p>
      </div>

      <div class="hub-auth__tabs" role="tablist">
        <button
          type="button"
          class="hub-auth__tab is-active"
          data-hub-auth-tab="login"
          onclick="window.switchHubAuthTab('login')"
        >
          \u0110\u0103ng nh\u1EADp
        </button>
        <button
          type="button"
          class="hub-auth__tab"
          data-hub-auth-tab="register"
          onclick="window.switchHubAuthTab('register')"
        >
          \u0110\u0103ng k\xFD
        </button>
      </div>

      <div class="hub-auth__panels">
        <form id="hub-auth-login-form" class="hub-auth__panel is-active" data-hub-auth-panel="login">
          <label>
            Username
            <input id="hub-auth-login-username" autocomplete="username" placeholder="an" />
          </label>
          <label>
            Password
            <input id="hub-auth-login-password" autocomplete="current-password" type="password" placeholder="\u2022\u2022\u2022\u2022\u2022\u2022" />
          </label>
          <button type="submit">\u0110\u0103ng nh\u1EADp</button>
        </form>

        <form id="hub-auth-register-form" class="hub-auth__panel" data-hub-auth-panel="register">
          <label>
            T\xEAn hi\u1EC3n th\u1ECB
            <input id="hub-auth-register-display-name" placeholder="An" maxlength="18" />
          </label>
          <label>
            Username
            <input id="hub-auth-register-username" autocomplete="username" placeholder="an" />
          </label>
          <label>
            Password
            <input id="hub-auth-register-password" autocomplete="new-password" type="password" placeholder="\xEDt nh\u1EA5t 6 k\xFD t\u1EF1" />
          </label>
          <button type="submit">T\u1EA1o t\xE0i kho\u1EA3n</button>
        </form>
      </div>

      <div id="hub-auth-status" class="hub-auth__status" aria-live="polite"></div>
    </section>
  `;
  }
  function renderHubExplorePanel() {
    return `
    <section class="hub-explore">
      <h3 class="side-title">G\xF3c Kh\xE1m Ph\xE1</h3>

      <div class="news-item">
        <span class="news-badge news-badge--new">M\u1EDAI</span>
        <h4>Trekpology Alpha 1.0</h4>
        <p>Phi\xEAn b\u1EA3n \u0111\u1EA7u ti\xEAn ra m\u1EAFt v\u1EDBi b\u1EA3n \u0111\u1ED3 S\xE0i G\xF2n \u2014 h\u01A1n 60 \u0111\u1ECBa \u0111i\u1EC3m \u0111ang ch\u1EDD b\u1EA1n kh\xE1m ph\xE1.</p>
      </div>

      <div class="news-item">
        <span class="news-badge news-badge--culture">V\u0102N HO\xC1</span>
        <h4>Ch\xF9a B\xE0 Thi\xEAn H\u1EADu</h4>
        <p>Ng\xF4i ch\xF9a h\u01A1n 300 n\u0103m tu\u1ED5i t\u1EA1i Ch\u1EE3 L\u1EDBn \u2014 bi\u1EC3u t\u01B0\u1EE3ng v\u0103n ho\xE1 ng\u01B0\u1EDDi Hoa gi\u1EEFa l\xF2ng S\xE0i G\xF2n.</p>
      </div>

      <div class="news-item">
        <span class="news-badge news-badge--food">\u1EA8M TH\u1EF0C</span>
        <h4>B\xE1nh M\xEC S\xE0i G\xF2n</h4>
        <p>\u1ED4 b\xE1nh m\xEC \u0111\u1EB7c tr\u01B0ng v\u1EDBi nh\xE2n phong ph\xFA \u2014 \u0111\u1EA1i di\u1EC7n \u1EA9m th\u1EF1c \u0111\u01B0\u1EDDng ph\u1ED1 n\u1ED5i ti\u1EBFng to\xE0n c\u1EA7u.</p>
      </div>

      <div class="news-item">
        <span class="news-badge news-badge--nature">THI\xCAN NHI\xCAN</span>
        <h4>C\u1EA7n Gi\u1EDD Mangrove</h4>
        <p>Khu r\u1EEBng ng\u1EADp m\u1EB7n l\u1EDBn nh\u1EA5t \u0110\xF4ng Nam \xC1 n\u1EB1m ngay c\u1EEDa ng\xF5 S\xE0i G\xF2n \u2014 Di s\u1EA3n Sinh quy\u1EC3n UNESCO.</p>
      </div>

      <div class="news-item">
        <span class="news-badge news-badge--heritage">DI S\u1EA2N</span>
        <h4>B\u01B0u \u0110i\u1EC7n Trung T\xE2m</h4>
        <p>C\xF4ng tr\xECnh ki\u1EBFn tr\xFAc th\u1EF1c d\xE2n Ph\xE1p th\u1EBF k\u1EF7 19, do Gustave Eiffel thi\u1EBFt k\u1EBF \u2014 bi\u1EC3u t\u01B0\u1EE3ng S\xE0i G\xF2n.</p>
      </div>
    </section>
  `;
  }
  function renderHubTopbarUser(isLoggedIn, displayName) {
    if (!isLoggedIn) {
      return `
      <button
        type="button"
        class="hub-topbar__guest"
        onclick="window.focusHubAuthPanel()"
      >
        \u0110\u0103ng nh\u1EADp
      </button>
    `;
    }
    return `
    <div class="hub-topbar__account">
      <span class="hub-topbar__user">${displayName}</span>
      <button
        type="button"
        class="hub-topbar__logout"
        onclick="event.stopPropagation(); window.logoutFromAuthScreen()"
        title="\u0110\u0103ng xu\u1EA5t"
      >
        Tho\xE1t
      </button>
    </div>
  `;
  }
  function renderDashboard(isLoading = false) {
    const user = authClientState.user;
    const isLoggedIn = Boolean(user);
    const displayName = user?.displayName || user?.username || "Nh\xE0 L\u1EEF H\xE0nh";
    return `
    <div class="dashboard-hub ${isLoading ? "dashboard-hub--loading" : ""}">

      <!-- Modal: H\u01B0\u1EDBng D\u1EABn Ch\u01A1i -->
      <div class="hub-modal" id="modal-rules" onclick="if(event.target===this)this.classList.remove('hub-modal--open')">
        <div class="hub-modal__box">
          <button class="hub-modal__close" onclick="document.getElementById('modal-rules').classList.remove('hub-modal--open')">\u2715</button>
          <h2>H\u01B0\u1EDBng D\u1EABn Ch\u01A1i</h2>
          <div class="hub-modal__content">
            <h3>\u{1F3AF} M\u1EE5c ti\xEAu</h3>
            <p>M\u1ED7i ng\u01B0\u1EDDi ch\u01A1i x\xE2y d\u1EF1ng l\u1ECBch tr\xECnh du l\u1ECBch 5 ng\xE0y, thu th\u1EADp c\xE1c th\u1EBB \u0111\u1ECBa \u0111i\u1EC3m v\xE0 ghi c\xE0ng nhi\u1EC1u \u0111i\u1EC3m VP (\u0110i\u1EC3m H\xE0nh Tr\xECnh) c\xE0ng t\u1ED1t.</p>

            <h3>\u{1F0CF} Th\u1EBB b\xE0i</h3>
            <p>M\u1ED7i th\u1EBB \u0111\u1EA1i di\u1EC7n cho m\u1ED9t \u0111\u1ECBa \u0111i\u1EC3m du l\u1ECBch t\u1EA1i Vi\u1EC7t Nam \u2014 c\xF3 c\xE1c thu\u1ED9c t\xEDnh: Th\u1EC3 lo\u1EA1i (V\u0103n Ho\xE1, \u1EA8m Th\u1EF1c, Thi\xEAn Nhi\xEAn...), Chi ph\xED (Xu & Th\u1EC3 L\u1EF1c), v\xE0 \u0110i\u1EC3m VP.</p>

            <h3>\u2699\uFE0F M\u1ED9t l\u01B0\u1EE3t ch\u01A1i</h3>
            <ol>
              <li><strong>Draft:</strong> Ch\u1ECDn 1 th\u1EBB t\u1EEB tay b\xE0i chung, truy\u1EC1n ph\u1EA7n c\xF2n l\u1EA1i cho ng\u01B0\u1EDDi k\u1EBF ti\u1EBFp.</li>
              <li><strong>L\xEAn k\u1EBF ho\u1EA1ch:</strong> \u0110\u1EB7t c\xE1c th\u1EBB \u0111\xE3 ch\u1ECDn v\xE0o b\u1EA3ng l\u1ECBch tr\xECnh 5\xD75 c\u1EE7a b\u1EA1n.</li>
              <li><strong>T\xEDnh \u0111i\u1EC3m:</strong> Server t\xEDnh \u0111i\u1EC3m cu\u1ED1i m\u1ED7i ng\xE0y theo combo th\u1EBB.</li>
            </ol>

            <h3>\u{1F3C6} K\u1EBFt th\xFAc</h3>
            <p>Sau 5 ng\xE0y ch\u01A1i, ng\u01B0\u1EDDi c\xF3 t\u1ED5ng VP cao nh\u1EA5t gi\xE0nh chi\u1EBFn th\u1EAFng v\xE0 nh\u1EADn Ch\u1EE9ng Nh\u1EADn H\xE0nh Tr\xECnh.</p>
          </div>
        </div>
      </div>

      <!-- Modal: V\u1EC1 Ch\xFAng T\xF4i -->
      <div class="hub-modal" id="modal-about" onclick="if(event.target===this)this.classList.remove('hub-modal--open')">
        <div class="hub-modal__box">
          <button class="hub-modal__close" onclick="document.getElementById('modal-about').classList.remove('hub-modal--open')">\u2715</button>
          <h2>V\u1EC1 Ch\xFAng T\xF4i</h2>
          <div class="hub-modal__content">
            <p><strong>TREKPOLOGY</strong> l\xE0 t\u1EF1a game th\u1EBB b\xE0i chi\u1EBFn l\u01B0\u1EE3c l\u1EA5y c\u1EA3m h\u1EE9ng t\u1EEB v\u1EBB \u0111\u1EB9p v\u0103n ho\xE1 v\xE0 thi\xEAn nhi\xEAn Vi\u1EC7t Nam.</p>
            <p>Ch\xFAng t\xF4i tin r\u1EB1ng du l\u1ECBch kh\xF4ng ch\u1EC9 l\xE0 di chuy\u1EC3n \u2014 m\xE0 l\xE0 kh\xE1m ph\xE1, h\u1ECDc h\u1ECFi v\xE0 k\u1EBFt n\u1ED1i. M\u1ED7i th\u1EBB b\xE0i l\xE0 m\u1ED9t c\xE2u chuy\u1EC7n th\u1EADt t\u1EEB \u0111\u1EA5t n\u01B0\u1EDBc Vi\u1EC7t Nam.</p>
            <h3>\u{1F52E} S\u1EAFp ra m\u1EAFt</h3>
            <p>\u0110\xE0 L\u1EA1t \u2022 H\u1ED9i An \u2022 H\u1EA1 Long \u2022 H\xE0 N\u1ED9i</p>
            <p style="margin-top:16px; font-size:12px; opacity:0.6">Phi\xEAn b\u1EA3n Alpha 1.0 \u2014 2025</p>
          </div>
        </div>
      </div>

      <!-- Topbar -->
      <header class="hub-topbar">
        <div class="hub-topbar__logo">TREKPOLOGY</div>
        <nav class="hub-topbar__nav">
          <button onclick="document.getElementById('modal-rules').classList.add('hub-modal--open')">H\u01B0\u1EDBng D\u1EABn Ch\u01A1i</button>
          <button onclick="document.getElementById('modal-about').classList.add('hub-modal--open')">V\u1EC1 Ch\xFAng T\xF4i</button>
        </nav>
        ${renderHubTopbarUser(isLoggedIn, displayName)}
      </header>

      <!-- Body: 2 c\u1ED9t -->
      <div class="hub-body">

        <!-- C\u1ED9t tr\xE1i: Hero -->
        <div class="hub-hero">
          ${renderHubHeroMedia()}

          <div class="hub-hero__overlay">
            <div class="hub-hero__content">
              <p class="hero-eyebrow">GAME TH\u1EBA B\xC0I CHI\u1EBEN L\u01AF\u1EE2C</p>
              <h1 class="hero-title">Kh\xE1m Ph\xE1<br/>Vi\u1EC7t Nam</h1>
              <p class="hero-sub">X\xE2y d\u1EF1ng h\xE0nh tr\xECnh, thu th\u1EADp \u0111\u1ECBa \u0111i\u1EC3m,<br/>tr\u1EDF th\xE0nh nh\xE0 l\u1EEF h\xE0nh xu\u1EA5t s\u1EAFc nh\u1EA5t.</p>
              <button class="btn-play" onclick="window.gotoMapSelection()">
                \u25B6 &nbsp;B\u1EAET \u0110\u1EA6U H\xC0NH TR\xCCNH
              </button>
              ${!isLoggedIn ? `<p class="hero-auth-hint">\u0110\u0103ng nh\u1EADp \u1EDF panel b\xEAn ph\u1EA3i \u0111\u1EC3 v\xE0o ph\xF2ng online.</p>` : ""}
            </div>
          </div>
        </div>

        <!-- C\u1ED9t ph\u1EA3i: Auth ho\u1EB7c G\xF3c Kh\xE1m Ph\xE1 -->
        <aside class="hub-side">
          <div class="hub-side__inner">
            ${isLoggedIn ? renderHubExplorePanel() : renderHubAuthPanel()}
          </div>
        </aside>

      </div>
    </div>
  `;
  }

  // src/data/cards.phase1.ts
  var noEffect = {
    has_effect: false,
    effect_type: "NONE",
    effect_value: 0
  };
  var phase1SaiGonFoodCards = [
    {
      card_id: "SG_FOOD_001",
      name: "C\xE0 Ph\xEA B\u1EC7t Nh\xE0 Th\u1EDD \u0110\u1EE9c B\xE0",
      description: "Tr\u1EA3i nghi\u1EC7m v\u1EC9a h\xE8 chu\u1EA9n S\xE0i G\xF2n. Th\u1EE9c u\u1ED1ng si\xEAu r\u1EBB nh\u01B0ng b\u1EA1n ph\u1EA3i \u0111\xE1nh c\u01B0\u1EE3c v\u1EDBi th\u1EDDi ti\u1EBFt n\u1EAFng m\u01B0a b\u1EA5t ch\u1EE3t.",
      image_url: "assets/cards/saigon/food/sg_food_001.jpg",
      phase_pool: "SAIGON",
      tags: ["FOOD", "OUTDOOR"],
      cost: {
        xu: 1,
        la: 0
      },
      base_vp: 5,
      location: {
        lat: 10.7798,
        lng: 106.699,
        is_virtual: false,
        label: "Qu\u1EADn 1 - C\xF4ng vi\xEAn 30/4"
      },
      on_play_effect: noEffect,
      rarity: "COMMON",
      icon: "\u2615"
    },
    {
      card_id: "SG_FOOD_002",
      name: "B\xE1nh Tr\xE1ng N\u01B0\u1EDBng H\u1ED3 Con R\xF9a",
      description: "Pizza Vi\u1EC7t Nam gi\xF2n r\u1EE5m b\xEAn h\u1ED3 n\u01B0\u1EDBc. T\u1EE5 \u0111i\u1EC3m h\xF3ng gi\xF3 l\xFD t\u01B0\u1EDFng nh\u01B0ng kh\xF3i b\u1EE5i giao th\xF4ng l\xE0 \u0111i\u1EC1u kh\xF4ng th\u1EC3 tr\xE1nh kh\u1ECFi.",
      image_url: "assets/cards/saigon/food/sg_food_002.jpg",
      phase_pool: "SAIGON",
      tags: ["FOOD", "OUTDOOR"],
      cost: {
        xu: 1,
        la: 0
      },
      base_vp: 5,
      location: {
        lat: 10.7828,
        lng: 106.6955,
        is_virtual: false,
        label: "Qu\u1EADn 3 - V\xF2ng xoay C\xF4ng tr\u01B0\u1EDDng Qu\u1ED1c T\u1EBF"
      },
      on_play_effect: noEffect,
      rarity: "COMMON",
      icon: "\u{1F355}"
    },
    {
      card_id: "SG_FOOD_003",
      name: "C\xE0 Ph\xEA V\u1EE3t Cheo Leo",
      description: "H\u01B0\u01A1ng v\u1ECB th\u1EDDi gian \u0111\u1ECDng l\u1EA1i trong qu\xE1n c\xE0 ph\xEA v\u1EE3t l\xE2u \u0111\u1EDDi nh\u1EA5t th\xE0nh ph\u1ED1. Y\xEAn b\xECnh, r\u1EBB v\xE0 an to\xE0n tuy\u1EC7t \u0111\u1ED1i.",
      image_url: "assets/cards/saigon/food/sg_food_003.jpg",
      phase_pool: "SAIGON",
      tags: ["FOOD", "INDOOR"],
      cost: {
        xu: 1,
        la: 0
      },
      base_vp: 8,
      location: {
        lat: 10.7685,
        lng: 106.678,
        is_virtual: false,
        label: "Qu\u1EADn 3 - Gi\xE1p ranh Qu\u1EADn 10"
      },
      on_play_effect: noEffect,
      rarity: "COMMON",
      icon: "\u2615"
    },
    {
      card_id: "SG_FOOD_004",
      name: "Ph\xE1 L\u1EA5u B\xF2 C\xF4 Oanh",
      description: "Ch\xE9n ph\xE1 l\u1EA5u \u0111\u1ECF au, th\u01A1m l\u1EEBng n\u01B0\u1EDBc c\u1ED1t d\u1EEBa \u0103n k\xE8m b\xE1nh m\xEC n\xF3ng gi\xF2n. Ng\u1ED3i gh\u1EBF s\xFAp v\u1EC9a h\xE8 ng\u1EAFm xe c\u1ED9 qua l\u1EA1i \u0111\xFAng ch\u1EA5t d\xE2n ch\u01A1i Qu\u1EADn 4.",
      image_url: "assets/cards/saigon/food/sg_food_004.jpg",
      phase_pool: "SAIGON",
      tags: ["FOOD", "OUTDOOR"],
      cost: {
        xu: 1,
        la: 0
      },
      base_vp: 5,
      location: {
        lat: 10.7598,
        lng: 106.7015,
        is_virtual: false,
        label: "Qu\u1EADn 4 - \u0110\u01B0\u1EDDng T\xF4n \u0110\u1EA3n"
      },
      on_play_effect: noEffect,
      rarity: "COMMON",
      icon: "\u{1F372}"
    },
    {
      card_id: "SG_FOOD_005",
      name: "S\xFAp Cua Ch\u1EE3 T\xE2n \u0110\u1ECBnh",
      description: "Ch\xE9n s\xFAp n\xF3ng h\u1ED5i, \u0111\u1EB7c ru\u1ED9t c\u1EA1nh ng\xF4i ch\u1EE3 h\u1ED3ng bi\u1EC3u t\u01B0\u1EE3ng. C\u1EE9u \u0111\xF3i nhanh g\u1ECDn cho h\xE0nh tr\xECnh d\xE0i.",
      image_url: "assets/cards/saigon/food/sg_food_005.jpg",
      phase_pool: "SAIGON",
      tags: ["FOOD", "OUTDOOR"],
      cost: {
        xu: 1,
        la: 0
      },
      base_vp: 5,
      location: {
        lat: 10.7895,
        lng: 106.6881,
        is_virtual: false,
        label: "Qu\u1EADn 1 - Ch\u1EE3 T\xE2n \u0110\u1ECBnh"
      },
      on_play_effect: noEffect,
      rarity: "COMMON",
      icon: "\u{1F963}"
    },
    {
      card_id: "SG_FOOD_006",
      name: "B\xE1nh M\xEC Hu\u1EF3nh Hoa",
      description: "\u1ED4 b\xE1nh m\xEC n\u1EB7ng tr\u1ECBch pate, \u0103n m\u1ED9t n\u1EEDa c\u0169ng \u0111\u1EE7 no. \u0110\u1ED5i l\u1EA1i, b\u1EA1n ph\u1EA3i ki\xEAn nh\u1EABn x\u1EBFp h\xE0ng mua mang \u0111i.",
      image_url: "assets/cards/saigon/food/sg_food_006.jpg",
      phase_pool: "SAIGON",
      tags: ["FOOD", "OUTDOOR"],
      cost: {
        xu: 2,
        la: 0
      },
      base_vp: 10,
      location: {
        lat: 10.7715,
        lng: 106.6931,
        is_virtual: false,
        label: "Qu\u1EADn 1 - \u0110\u01B0\u1EDDng L\xEA Th\u1ECB Ri\xEAng"
      },
      on_play_effect: noEffect,
      rarity: "UNCOMMON",
      icon: "\u{1F956}"
    },
    {
      card_id: "SG_FOOD_007",
      name: "Ph\u1ED1 \u1EA8m Th\u1EF1c H\u1ED3 Th\u1ECB K\u1EF7",
      description: "Thi\xEAn \u0111\u01B0\u1EDDng \u0103n v\u1EB7t v\xE0 m\xF9i hoa t\u01B0\u01A1i \u0111an xen. \u0102n no c\u0103ng b\u1EE5ng nh\u01B0ng r\xE3 r\u1EDDi \u0111\xF4i ch\xE2n v\xEC chen l\u1EA5n.",
      image_url: "assets/cards/saigon/food/sg_food_007.jpg",
      phase_pool: "SAIGON",
      tags: ["FOOD", "OUTDOOR"],
      cost: {
        xu: 2,
        la: 1
      },
      base_vp: 15,
      location: {
        lat: 10.7671,
        lng: 106.6773,
        is_virtual: false,
        label: "Qu\u1EADn 10 - Ch\u1EE3 Hoa"
      },
      on_play_effect: noEffect,
      rarity: "UNCOMMON",
      icon: "\u{1F362}"
    },
    {
      card_id: "SG_FOOD_008",
      name: "C\xE0 Ph\xEA Chung C\u01B0 42 Nguy\u1EC5n Hu\u1EC7",
      description: "Tr\u1EA1m ngh\u1EC9 ch\xE2n ho\xE0i c\u1ED5 nh\xECn ra ph\u1ED1 \u0111i b\u1ED9 hi\u1EC7n \u0111\u1EA1i. N\u01A1i tr\xFA m\u01B0a ho\xE0n h\u1EA3o gi\u1EEFa l\u1ECBch tr\xECnh c\u1EA1n ki\u1EC7t.",
      image_url: "assets/cards/saigon/food/sg_food_008.jpg",
      phase_pool: "SAIGON",
      tags: ["FOOD", "INDOOR"],
      cost: {
        xu: 2,
        la: 0
      },
      base_vp: 12,
      location: {
        lat: 10.7743,
        lng: 106.7031,
        is_virtual: false,
        label: "Qu\u1EADn 1 - Ph\u1ED1 \u0111i b\u1ED9 Nguy\u1EC5n Hu\u1EC7"
      },
      on_play_effect: noEffect,
      rarity: "UNCOMMON",
      icon: "\u2615"
    },
    {
      card_id: "SG_FOOD_009",
      name: "Ph\u1ED1 S\u1EE7i C\u1EA3o H\xE0 T\xF4n Quy\u1EC1n",
      description: "Ti\u1EBFng g\u1ECDi m\xF3n r\xF4m r\u1EA3 c\u1EA3 g\xF3c ph\u1ED1 ng\u01B0\u1EDDi Hoa. N\u1EB1m xa trung t\xE2m n\xEAn h\xE3y c\u1EA9n th\u1EADn b\u1EABy kho\u1EA3ng c\xE1ch di chuy\u1EC3n.",
      image_url: "assets/cards/saigon/food/sg_food_009.jpg",
      phase_pool: "SAIGON",
      tags: ["FOOD", "OUTDOOR"],
      cost: {
        xu: 2,
        la: 0
      },
      base_vp: 12,
      location: {
        lat: 10.7592,
        lng: 106.6558,
        is_virtual: false,
        label: "Qu\u1EADn 11 - Khu Ch\u1EE3 L\u1EDBn"
      },
      on_play_effect: noEffect,
      rarity: "UNCOMMON",
      icon: "\u{1F95F}"
    },
    {
      card_id: "SG_FOOD_010",
      name: "C\u01A1m T\u1EA5m Ba Ghi\u1EC1n",
      description: "Mi\u1EBFng s\u01B0\u1EDDn n\u01B0\u1EDBng than to b\u1EB1ng c\xE1i \u0111\u0129a. Tr\u1EA3i nghi\u1EC7m no n\xEA.",
      image_url: "assets/cards/saigon/food/sg_food_010.jpg",
      phase_pool: "SAIGON",
      tags: ["FOOD", "INDOOR"],
      cost: {
        xu: 2,
        la: 1
      },
      base_vp: 15,
      location: {
        lat: 10.7951,
        lng: 106.6781,
        is_virtual: false,
        label: "Ph\xFA Nhu\u1EADn - C\u01B0 x\xE1 Nguy\u1EC5n V\u0103n Tr\u1ED7i"
      },
      on_play_effect: noEffect,
      rarity: "UNCOMMON",
      icon: "\u{1F35A}"
    },
    {
      card_id: "SG_FOOD_011",
      name: "Ph\u1ED1 \u1ED0c V\u0129nh Kh\xE1nh",
      description: "M\xF9i b\u01A1 t\u1ECFi v\xE0 m\u1EE1 h\xE0nh n\u1EE9c m\u0169i. \u0110\u1EA1i di\u1EC7n xu\u1EA5t s\u1EAFc nh\u1EA5t cho v\u0103n h\xF3a \u0103n \u1ED1c c\u1EE7a gi\u1EDBi tr\u1EBB th\xE0nh ph\u1ED1.",
      image_url: "assets/cards/saigon/food/sg_food_011.jpg",
      phase_pool: "SAIGON",
      tags: ["FOOD", "OUTDOOR"],
      cost: {
        xu: 2,
        la: 0
      },
      base_vp: 12,
      location: {
        lat: 10.7601,
        lng: 106.7029,
        is_virtual: false,
        label: "Qu\u1EADn 4 - B\u1EDD k\xE8"
      },
      on_play_effect: noEffect,
      rarity: "UNCOMMON",
      icon: "\u{1F41A}"
    },
    {
      card_id: "SG_FOOD_012",
      name: "B\xE1nh X\xE8o \u0110inh C\xF4ng Tr\xE1ng",
      description: "Ti\u1EC7m b\xE1nh x\xE8o mi\u1EC1n Nam truy\u1EC1n th\u1ED1ng \u1EA9n trong h\u1EBBm. V\u1EEBa gi\xF2n.",
      image_url: "assets/cards/saigon/food/sg_food_012.jpg",
      phase_pool: "SAIGON",
      tags: ["FOOD", "INDOOR"],
      cost: {
        xu: 2,
        la: 0
      },
      base_vp: 10,
      location: {
        lat: 10.7901,
        lng: 106.689,
        is_virtual: false,
        label: "Qu\u1EADn 1 - G\u1EA7n ch\u1EE3 T\xE2n \u0110\u1ECBnh"
      },
      on_play_effect: noEffect,
      rarity: "UNCOMMON",
      icon: "\u{1F95E}"
    },
    {
      card_id: "SG_FOOD_013",
      name: "Ch\xE8 H\xE0 K\xFD Ch\u1EE3 L\u1EDBn",
      description: "Ch\xE8 tr\u1EE9ng g\xE0 tr\xE0, ch\xE8 m\xE8 \u0111en tr\u1EE9 danh. \u0110i\u1EC3m ch\u1ED1t ng\u1ECDt ng\xE0o sau chuy\u1EBFn kh\xE1m ph\xE1 v\u0103n h\xF3a ph\u1ED1 T\xE0u.",
      image_url: "assets/cards/saigon/food/sg_food_013.jpg",
      phase_pool: "SAIGON",
      tags: ["FOOD", "INDOOR"],
      cost: {
        xu: 2,
        la: 0
      },
      base_vp: 10,
      location: {
        lat: 10.7516,
        lng: 106.6622,
        is_virtual: false,
        label: "Qu\u1EADn 5 - Ch\xE2u V\u0103n Li\xEAm"
      },
      on_play_effect: noEffect,
      rarity: "UNCOMMON",
      icon: "\u{1F367}"
    },
    {
      card_id: "SG_FOOD_014",
      name: "Ph\u1EDF H\xF2a Pasteur",
      description: "Bi\u1EC3u t\u01B0\u1EE3ng Ph\u1EDF mi\u1EC1n Nam n\u1ED5i ti\u1EBFng v\u1EDBi kh\xE1ch qu\u1ED1c t\u1EBF. Kh\xF4ng gian l\u1ECBch s\u1EF1, gi\xE1 cao nh\u01B0ng tr\u1EA3i nghi\u1EC7m tr\xF2n tr\u1ECBa.",
      image_url: "assets/cards/saigon/food/sg_food_014.jpg",
      phase_pool: "SAIGON",
      tags: ["FOOD", "INDOOR"],
      cost: {
        xu: 3,
        la: 0
      },
      base_vp: 15,
      location: {
        lat: 10.7892,
        lng: 106.6896,
        is_virtual: false,
        label: "Qu\u1EADn 3 - \u0110\u01B0\u1EDDng Pasteur"
      },
      on_play_effect: noEffect,
      rarity: "EPIC",
      icon: "\u{1F35C}"
    },
    {
      card_id: "SG_FOOD_015",
      name: "L\u1EA9u C\xE1 K\xE8o B\xE0 Huy\u1EC7n Thanh Quan",
      description: "N\u1ED3i l\u1EA9u chua l\xE1 giang s\xF4i s\xF9ng s\u1EE5c c\xF9ng c\xE1 k\xE8o t\u01B0\u01A1i r\xF3i. Bi\u1EC3u t\u01B0\u1EE3ng nh\u1EADu lai rai c\u1EF1c k\u1EF3 b\xE9n m\u1ED3i c\u1EE7a ng\u01B0\u1EDDi mi\u1EC1n Nam.",
      image_url: "assets/cards/saigon/food/sg_food_015.jpg",
      phase_pool: "SAIGON",
      tags: ["FOOD", "INDOOR"],
      cost: {
        xu: 3,
        la: 0
      },
      base_vp: 18,
      location: {
        lat: 10.7785,
        lng: 106.6858,
        is_virtual: false,
        label: "Qu\u1EADn 3 - B\xE0 Huy\u1EC7n Thanh Quan"
      },
      on_play_effect: noEffect,
      rarity: "EPIC",
      icon: "\u{1F372}"
    },
    /**
     * Tài liệu hiện đang nhảy từ SG_FOOD_015 sang SG_FOOD_017.
     * SG_FOOD_016 chưa có dữ liệu, không tự thêm để tránh sai thiết kế.
     */
    {
      card_id: "SG_FOOD_017",
      name: "Dimsum Ti\u1EBFn Ph\xE1t",
      description: "B\u1EEFa s\xE1ng xa x\u1EC9 ki\u1EC3u Qu\u1EA3ng \u0110\xF4ng. \u0110\xE1nh \u0111\u1ED5i s\u1ED1 ti\u1EC1n l\u1EDBn \u0111\u1EC3 thu v\u1EC1 l\u01B0\u1EE3ng \u0111i\u1EC3m kh\u1ED5ng l\u1ED3 ngay t\u1EEB l\xFAc b\xECnh minh.",
      image_url: "assets/cards/saigon/food/sg_food_017.jpg",
      phase_pool: "SAIGON",
      tags: ["FOOD", "INDOOR"],
      cost: {
        xu: 4,
        la: 0
      },
      base_vp: 25,
      location: {
        lat: 10.7538,
        lng: 106.6631,
        is_virtual: false,
        label: "Qu\u1EADn 5 - Khu Ch\u1EE3 L\u1EDBn"
      },
      on_play_effect: noEffect,
      rarity: "EPIC",
      icon: "\u{1F95F}"
    },
    {
      card_id: "SG_FOOD_018",
      name: "Nh\xE0 H\xE0ng Chay Hum",
      description: "Kh\xF4ng gian thi\u1EC1n t\u1ECBnh, th\u1EE9c \u0103n thanh l\u1ECDc. M\u1ECDi mu\u1ED9n phi\u1EC1n tan bi\u1EBFn, c\u01A1 th\u1EC3 b\u1EA1n \u0111\u01B0\u1EE3c h\u1ED3i ph\u1EE5c sinh l\u1EF1c ho\xE0n to\xE0n.",
      image_url: "assets/cards/saigon/food/sg_food_018.jpg",
      phase_pool: "SAIGON",
      tags: ["FOOD", "INDOOR"],
      cost: {
        xu: 4,
        la: 0
      },
      base_vp: 15,
      location: {
        lat: 10.7811,
        lng: 106.6914,
        is_virtual: false,
        label: "Qu\u1EADn 3 - V\xF5 V\u0103n T\u1EA7n"
      },
      on_play_effect: {
        has_effect: true,
        effect_type: "RECOVER_LA",
        effect_value: 1
      },
      rarity: "EPIC",
      icon: "\u{1F957}"
    },
    {
      card_id: "SG_FOOD_019",
      name: "\u0102n T\u1ED1i Du Thuy\u1EC1n S\xF4ng S\xE0i G\xF2n",
      description: "Th\u01B0\u1EDFng th\u1EE9c b\xEDt t\u1EBFt v\xE0 r\u01B0\u1EE3u vang tr\xF4i d\u1ECDc d\xF2ng s\xF4ng r\u1EF1c s\xE1ng \xE1nh \u0111\xE8n. Tr\u1EA3i nghi\u1EC7m \u0111\u1EAFt \u0111\u1ECF nh\u01B0ng x\u1EE9ng \u0111\xE1ng t\u1EEBng \u0111\u1ED3ng.",
      image_url: "assets/cards/saigon/food/sg_food_019.jpg",
      phase_pool: "SAIGON",
      tags: ["FOOD", "ACTION"],
      cost: {
        xu: 5,
        la: 0
      },
      base_vp: 35,
      location: {
        lat: 10.763,
        lng: 106.7071,
        is_virtual: false,
        label: "Qu\u1EADn 4 - B\u1EBFn c\u1EA3ng Nh\xE0 R\u1ED3ng"
      },
      on_play_effect: noEffect,
      rarity: "LEGENDARY",
      icon: "\u26F4\uFE0F"
    },
    {
      card_id: "SG_FOOD_020",
      name: "T\u1EA7ng 79 Landmark 81",
      description: "B\u1EEFa \u0103n tr\xEAn \u0111\u1EC9nh b\u1EA7u tr\u1EDDi S\xE0i G\xF2n. B\u1EA1n \u0111\u1ED1t ng\xF3t ngh\xE9t 60% ng\xE2n s\xE1ch kh\u1EDFi \u0111i\u1EC3m \u0111\u1EC3 gi\xE1ng \u0111\xF2n ch\xED m\u1EA1ng v\u1EC1 \u0111i\u1EC3m s\u1ED1.",
      image_url: "assets/cards/saigon/food/sg_food_020.jpg",
      phase_pool: "SAIGON",
      tags: ["FOOD", "INDOOR"],
      cost: {
        xu: 6,
        la: 0
      },
      base_vp: 45,
      location: {
        lat: 10.795,
        lng: 106.7218,
        is_virtual: false,
        label: "B\xECnh Th\u1EA1nh - Vinhomes Central Park"
      },
      on_play_effect: noEffect,
      rarity: "LEGENDARY",
      icon: "\u{1F3D9}\uFE0F"
    },
    {
      card_id: "SG_FOOD_021",
      name: "C\u01A1m Qu\xEA D\u01B0\u1EE3ng B\u1EA7u",
      description: "M\xE2m c\u01A1m qu\xEA m\u1ED9c m\u1EA1c v\u1EDBi tr\u1EE9ng chi\xEAn, canh chua nh\u01B0ng \u0111\u01B0\u1EE3c ph\u1EE5c v\u1EE5 trong kh\xF4ng gian sang tr\u1ECDng b\u1EADc nh\u1EA5t. Tr\u1EA3i nghi\u1EC7m t\xECm v\u1EC1 tu\u1ED5i th\u01A1 nh\u01B0ng v\u1EDBi m\u1ED9t c\xE1i gi\xE1 c\u1EE7a ng\u01B0\u1EDDi tr\u01B0\u1EDFng th\xE0nh.",
      image_url: "assets/cards/saigon/food/sg_food_021.jpg",
      phase_pool: "SAIGON",
      tags: ["FOOD", "INDOOR"],
      cost: {
        xu: 5,
        la: 0
      },
      base_vp: 35,
      location: {
        lat: 10.7725,
        lng: 106.6901,
        is_virtual: false,
        label: "Khu v\u1EF1c trung t\xE2m"
      },
      on_play_effect: noEffect,
      rarity: "LEGENDARY",
      icon: "\u{1F35A}"
    }
  ];
  var phase1Cards = [
    ...phase1SaiGonFoodCards
  ];

  // src/data/cardMapper.ts
  function getMainTag(tags) {
    if (tags.includes("FOOD")) return "FOOD";
    if (tags.includes("CULTURE")) return "CULTURE";
    if (tags.includes("ACTION")) return "ACTION";
    if (tags.includes("UTILITY")) return "UTILITY";
    return tags[0] ?? "FOOD";
  }
  function getTagLabel(tag) {
    switch (tag) {
      case "FOOD":
        return "\u1EA8m th\u1EF1c";
      case "CULTURE":
        return "V\u0103n h\xF3a";
      case "ACTION":
        return "Kh\xE1m ph\xE1";
      case "UTILITY":
        return "Ti\u1EC7n \xEDch";
      case "OUTDOOR":
        return "Ngo\xE0i tr\u1EDDi";
      case "INDOOR":
        return "Trong nh\xE0";
      default:
        return "Kh\xE1c";
    }
  }
  function getRarityLabel(rarity) {
    switch (rarity) {
      case "COMMON":
        return "\u2605";
      case "UNCOMMON":
        return "\u2605\u2605";
      case "EPIC":
        return "\u2605\u2605\u2605\u2605";
      case "LEGENDARY":
        return "\u2605\u2605\u2605\u2605\u2605";
      default:
        return "\u2605";
    }
  }
  function getUiRarity(rarity) {
    switch (rarity) {
      case "COMMON":
        return "common";
      case "UNCOMMON":
        return "uncommon";
      case "EPIC":
        return "epic";
      case "LEGENDARY":
        return "legendary";
      default:
        return "common";
    }
  }
  function getBonusText(card) {
    if (card.on_play_effect.has_effect) {
      if (card.on_play_effect.effect_type === "RECOVER_LA") {
        return `Khi \u0111\u1EB7t xu\u1ED1ng: h\u1ED3i ${card.on_play_effect.effect_value} th\u1EC3 l\u1EF1c`;
      }
      if (card.on_play_effect.effect_type === "RECOVER_XU") {
        return `Khi \u0111\u1EB7t xu\u1ED1ng: h\u1ED3i ${card.on_play_effect.effect_value} xu`;
      }
      if (card.on_play_effect.effect_type === "GAIN_VP") {
        return `Khi \u0111\u1EB7t xu\u1ED1ng: +${card.on_play_effect.effect_value} VP`;
      }
    }
    if (card.tags.includes("FOOD")) {
      return "N\u1EBFu c\xF3 2 l\xE1 \u1EA8m th\u1EF1c: +5 VP";
    }
    if (card.tags.includes("CULTURE")) {
      return "N\u1EBFu c\xF3 2 l\xE1 V\u0103n h\xF3a: +8 VP";
    }
    if (card.tags.includes("ACTION")) {
      return "N\u1EBFu \u0111\u1EB7t sau l\xE1 Kh\xE1m ph\xE1: +10 VP";
    }
    return "Kh\xF4ng c\xF3 hi\u1EC7u \u1EE9ng \u0111\u1EB7c bi\u1EC7t";
  }
  function getShortName(name) {
    const trimmed = name.trim();
    const manualShortNames = {
      "C\xE0 Ph\xEA B\u1EC7t Nh\xE0 Th\u1EDD \u0110\u1EE9c B\xE0": "C\xE0 Ph\xEA B\u1EC7t",
      "B\xE1nh Tr\xE1ng N\u01B0\u1EDBng H\u1ED3 Con R\xF9a": "B\xE1nh Tr\xE1ng",
      "C\xE0 Ph\xEA V\u1EE3t Cheo Leo": "C\xE0 Ph\xEA V\u1EE3t",
      "Ph\xE1 L\u1EA5u B\xF2 C\xF4 Oanh": "Ph\xE1 L\u1EA5u",
      "S\xFAp Cua Ch\u1EE3 T\xE2n \u0110\u1ECBnh": "S\xFAp Cua",
      "B\xE1nh M\xEC Hu\u1EF3nh Hoa": "B\xE1nh M\xEC",
      "Ph\u1ED1 \u1EA8m Th\u1EF1c H\u1ED3 Th\u1ECB K\u1EF7": "H\u1ED3 Th\u1ECB K\u1EF7",
      "C\xE0 Ph\xEA Chung C\u01B0 42 Nguy\u1EC5n Hu\u1EC7": "C\xE0 Ph\xEA 42",
      "Ph\u1ED1 S\u1EE7i C\u1EA3o H\xE0 T\xF4n Quy\u1EC1n": "S\u1EE7i C\u1EA3o",
      "C\u01A1m T\u1EA5m Ba Ghi\u1EC1n": "C\u01A1m T\u1EA5m",
      "Ph\u1ED1 \u1ED0c V\u0129nh Kh\xE1nh": "\u1ED0c V\u0129nh Kh\xE1nh",
      "B\xE1nh X\xE8o \u0110inh C\xF4ng Tr\xE1ng": "B\xE1nh X\xE8o",
      "Ch\xE8 H\xE0 K\xFD Ch\u1EE3 L\u1EDBn": "Ch\xE8 H\xE0 K\xFD",
      "Ph\u1EDF H\xF2a Pasteur": "Ph\u1EDF H\xF2a",
      "L\u1EA9u C\xE1 K\xE8o B\xE0 Huy\u1EC7n Thanh Quan": "L\u1EA9u C\xE1 K\xE8o",
      "Dimsum Ti\u1EBFn Ph\xE1t": "Dimsum",
      "Nh\xE0 H\xE0ng Chay Hum": "Chay Hum",
      "\u0102n T\u1ED1i Du Thuy\u1EC1n S\xF4ng S\xE0i G\xF2n": "Du Thuy\u1EC1n T\u1ED1i",
      "T\u1EA7ng 79 Landmark 81": "Landmark 81",
      "C\u01A1m Qu\xEA D\u01B0\u1EE3ng B\u1EA7u": "D\u01B0\u1EE3ng B\u1EA7u",
      // Các tên dùng trong demo / phase khác nếu có
      "Du Thuy\u1EC1n H\u1EA1 Long": "Du Thuy\u1EC1n",
      "Ch\u1EE3 \u0110\xEAm \u0110\xE0 L\u1EA1t": "Ch\u1EE3 \u0110\xEAm"
    };
    if (manualShortNames[trimmed]) {
      return manualShortNames[trimmed];
    }
    if (trimmed.length <= 14) {
      return trimmed;
    }
    const words = trimmed.split(/\s+/);
    if (words.length <= 3) {
      return trimmed;
    }
    return words.slice(0, 3).join(" ");
  }
  function getShortCity(city) {
    const trimmed = city.trim();
    const manualShortCities = {
      "Qu\u1EADn 1 - C\xF4ng vi\xEAn 30/4": "Q.1",
      "Qu\u1EADn 3 - V\xF2ng xoay C\xF4ng tr\u01B0\u1EDDng Qu\u1ED1c T\u1EBF": "Q.3",
      "Qu\u1EADn 3 - Gi\xE1p ranh Qu\u1EADn 10": "Q.3",
      "Qu\u1EADn 4 - \u0110\u01B0\u1EDDng T\xF4n \u0110\u1EA3n": "Q.4",
      "Qu\u1EADn 1 - Ch\u1EE3 T\xE2n \u0110\u1ECBnh": "Q.1",
      "Qu\u1EADn 1 - \u0110\u01B0\u1EDDng L\xEA Th\u1ECB Ri\xEAng": "Q.1",
      "Qu\u1EADn 10 - Ch\u1EE3 Hoa": "Q.10",
      "Qu\u1EADn 1 - Ph\u1ED1 \u0111i b\u1ED9 Nguy\u1EC5n Hu\u1EC7": "Q.1",
      "Qu\u1EADn 11 - Khu Ch\u1EE3 L\u1EDBn": "Q.11",
      "Ph\xFA Nhu\u1EADn - C\u01B0 x\xE1 Nguy\u1EC5n V\u0103n Tr\u1ED7i": "Ph\xFA Nhu\u1EADn",
      "Qu\u1EADn 4 - B\u1EDD k\xE8": "Q.4",
      "Qu\u1EADn 1 - G\u1EA7n ch\u1EE3 T\xE2n \u0110\u1ECBnh": "Q.1",
      "Qu\u1EADn 5 - Ch\xE2u V\u0103n Li\xEAm": "Q.5",
      "Qu\u1EADn 3 - \u0110\u01B0\u1EDDng Pasteur": "Q.3",
      "Qu\u1EADn 3 - B\xE0 Huy\u1EC7n Thanh Quan": "Q.3",
      "Qu\u1EADn 5 - Khu Ch\u1EE3 L\u1EDBn": "Q.5",
      "Qu\u1EADn 3 - V\xF5 V\u0103n T\u1EA7n": "Q.3",
      "Qu\u1EADn 4 - B\u1EBFn c\u1EA3ng Nh\xE0 R\u1ED3ng": "Q.4",
      "B\xECnh Th\u1EA1nh - Vinhomes Central Park": "B\xECnh Th\u1EA1nh",
      "Khu v\u1EF1c trung t\xE2m": "Trung t\xE2m",
      // Các city demo / phase khác nếu có
      "S\xE0i G\xF2n": "S\xE0i G\xF2n",
      "H\xE0 N\u1ED9i": "H\xE0 N\u1ED9i",
      "\u0110\xE0 L\u1EA1t": "\u0110\xE0 L\u1EA1t",
      "\u0110\xE0 N\u1EB5ng": "\u0110\xE0 N\u1EB5ng",
      "Qu\u1EA3ng Ninh": "Qu\u1EA3ng Ninh"
    };
    if (manualShortCities[trimmed]) {
      return manualShortCities[trimmed];
    }
    if (trimmed.length <= 12) {
      return trimmed;
    }
    if (trimmed.includes("Qu\u1EADn")) {
      const match = trimmed.match(/Quận\s*\d+/i);
      if (match) {
        return match[0].replace("Qu\u1EADn", "Q.");
      }
    }
    return trimmed.slice(0, 12).trim() + "...";
  }
  function mapGameCardToTravelCard(card) {
    const mainTag = getMainTag(card.tags);
    const city = card.location.label ?? card.phase_pool;
    return {
      id: card.card_id,
      name: card.name,
      shortName: getShortName(card.name),
      city,
      shortCity: getShortCity(city),
      image: card.image_url,
      rarity: getUiRarity(card.rarity),
      rarityLabel: getRarityLabel(card.rarity),
      vp: card.base_vp,
      coin: card.cost.xu,
      stamina: card.cost.la,
      tag: mainTag.toLowerCase(),
      tagLabel: getTagLabel(mainTag),
      tags: card.tags,
      onPlayEffect: card.on_play_effect,
      icon: card.icon,
      description: card.description,
      bonusText: getBonusText(card)
    };
  }

  // src/game/constants.ts
  var STARTING_COIN = 3;
  var STARTING_STAMINA = 2;
  var HAND_SIZE = 5;
  var TURN_DURATION_SECONDS = 15;
  var PHASE_DAYS = 5;
  var DRAFT_PICK_SECONDS = 10;
  var days = [1, 2, 3, 4, 5];
  var rows = ["S\xE1ng", "Tr\u01B0a", "Chi\u1EC1u", "T\u1ED1i", "Khuya"];

  // src/game/board.ts
  function createEmptyBoardSlots() {
    return rows.map(() => days.map(() => null));
  }
  function getCurrentDayPlacedCards(boardSlots, dayIndex) {
    const cards = [];
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const card = boardSlots[rowIndex]?.[dayIndex] ?? null;
      if (card) {
        cards.push(card);
      }
    }
    return cards;
  }
  function getBoardCardByPosition(boardSlots, rowIndex, colIndex) {
    return boardSlots[rowIndex]?.[colIndex] ?? null;
  }
  function getCardTagKeys(card) {
    if (card.tags && card.tags.length > 0) {
      return card.tags.map((tag) => tag.toUpperCase());
    }
    return [card.tag.toUpperCase()];
  }
  function countCardsWithTag(cards, tag) {
    return cards.filter((card) => getCardTagKeys(card).includes(tag)).length;
  }

  // src/game/draft.ts
  function getActiveDraftPlayerIndex() {
    return 1;
  }
  function getCurrentDraftPlayer(draftPlayers2, activeIndex = getActiveDraftPlayerIndex()) {
    return draftPlayers2[activeIndex];
  }

  // src/game/scoring.ts
  function calculateScoreBreakdown({
    placedCards,
    getBoardDisplayName: getBoardDisplayName2
  }) {
    const baseVP = placedCards.reduce((sum, card) => sum + card.vp, 0);
    const spentCoin = placedCards.reduce((sum, card) => sum + card.coin, 0);
    const spentStamina = placedCards.reduce((sum, card) => sum + card.stamina, 0);
    const lines = [];
    let bonusVP = 0;
    const foodCount = countCardsByTag(placedCards, "FOOD");
    const cultureCount = countCardsByTag(placedCards, "CULTURE");
    const actionCount = countCardsByTag(placedCards, "ACTION");
    if (foodCount >= 2) {
      const foodBonus = 5;
      bonusVP += foodBonus;
      lines.push(`Combo \u1EA8m th\u1EF1c x${foodCount}: +${foodBonus} VP`);
    }
    if (cultureCount >= 2) {
      const cultureBonus = 8;
      bonusVP += cultureBonus;
      lines.push(`Combo V\u0103n h\xF3a x${cultureCount}: +${cultureBonus} VP`);
    }
    if (actionCount >= 2) {
      const actionBonus = 10;
      bonusVP += actionBonus;
      lines.push(`Chu\u1ED7i Kh\xE1m ph\xE1 x${actionCount}: +${actionBonus} VP`);
    }
    for (const card of placedCards) {
      const effect = card.onPlayEffect;
      if (!effect?.has_effect) continue;
      if (effect.effect_type === "GAIN_VP") {
        bonusVP += effect.effect_value;
        lines.push(`${getBoardDisplayName2(card)}: +${effect.effect_value} VP`);
      }
    }
    if (lines.length === 0) {
      lines.push("Ch\u01B0a c\xF3 bonus n\xE0o \u0111\u01B0\u1EE3c k\xEDch ho\u1EA1t");
    }
    return {
      baseVP,
      bonusVP,
      totalVP: baseVP + bonusVP,
      spentCoin,
      spentStamina,
      usedSlots: placedCards.length,
      lines
    };
  }
  function getBoardTokenType(card) {
    return card?.boardTokenType ?? null;
  }
  function isDebtTokenCard(card) {
    return getBoardTokenType(card) === "debt";
  }
  function isLockTokenCard(card) {
    return getBoardTokenType(card) === "lock";
  }
  function getDebtTokenAmount(card) {
    return card?.debtAmount ?? 0;
  }
  function buildSimulationReplaySteps({
    boardSlots,
    currentDayIndex: currentDayIndex2,
    dayLabel,
    rows: rows2,
    getCardTagKeys: getCardTagKeys3,
    countCardsWithTag: countCardsWithTag2,
    getCurrentDayPlacedCards: getCurrentDayPlacedCards3
  }) {
    const steps = [];
    const dayIndex = currentDayIndex2;
    const daySummary = {
      dayIndex,
      label: dayLabel,
      vp: 0,
      steps: 0
    };
    const currentDayCards = getCurrentDayPlacedCards3(dayIndex);
    let previousCard = null;
    for (let rowIndex = 0; rowIndex < rows2.length; rowIndex += 1) {
      const card = boardSlots[rowIndex]?.[dayIndex] ?? null;
      const timeLabel = rows2[rowIndex];
      if (!card) {
        steps.push({
          id: `empty_${dayIndex}_${rowIndex}`,
          dayIndex,
          rowIndex,
          dayLabel,
          timeLabel,
          title: "Kh\xF4ng c\xF3 ho\u1EA1t \u0111\u1ED9ng",
          subtitle: "Kh\xF4ng c\xF3 ho\u1EA1t \u0111\u1ED9ng, xem nh\u01B0 th\u1EDDi gian ngh\u1EC9 / di chuy\u1EC3n.",
          vpDelta: 0,
          coinDelta: 0,
          staminaDelta: 0,
          isEmpty: true
        });
        continue;
      }
      if (isDebtTokenCard(card)) {
        const debtPenalty = -20;
        daySummary.vp += debtPenalty;
        daySummary.steps += 1;
        steps.push({
          id: card.id,
          dayIndex,
          rowIndex,
          dayLabel,
          timeLabel,
          title: "Token n\u1EE3",
          subtitle: `N\u1EE3 ti\u1EC1n ${getDebtTokenAmount(card)} xu`,
          vpDelta: debtPenalty,
          coinDelta: 0,
          staminaDelta: 0,
          isDebtPenalty: true,
          isBoardToken: true
        });
        continue;
      }
      if (isLockTokenCard(card)) {
        steps.push({
          id: card.id,
          dayIndex,
          rowIndex,
          dayLabel,
          timeLabel,
          title: "B\u1ECB kh\xF3a",
          subtitle: "Ki\u1EC7t s\u1EE9c, kh\xF4ng th\u1EC3 x\u1EBFp ho\u1EA1t \u0111\u1ED9ng.",
          vpDelta: 0,
          coinDelta: 0,
          staminaDelta: 0,
          isBoardToken: true
        });
        continue;
      }
      const tagKeys = getCardTagKeys3(card);
      let comboText = "";
      if (tagKeys.includes("FOOD") && countCardsWithTag2(currentDayCards, "FOOD") >= 2) {
        comboText = "Combo \u1EA8m th\u1EF1c \u0111ang k\xEDch ho\u1EA1t";
      } else if (tagKeys.includes("CULTURE") && countCardsWithTag2(currentDayCards, "CULTURE") >= 2) {
        comboText = "Combo V\u0103n h\xF3a \u0111ang k\xEDch ho\u1EA1t";
      } else if (tagKeys.includes("ACTION") && countCardsWithTag2(currentDayCards, "ACTION") >= 2) {
        comboText = "Chu\u1ED7i Kh\xE1m ph\xE1 \u0111ang k\xEDch ho\u1EA1t";
      }
      const randomEvent = getDeterministicRandomScanEvent(card, dayIndex, rowIndex);
      const distanceEvent = previousCard ? getDistanceEvent(previousCard, card, dayIndex, rowIndex) : null;
      const activeEvent = distanceEvent ?? randomEvent;
      const eventVpDelta = activeEvent?.vpDelta ?? 0;
      const eventStaminaDelta = activeEvent?.staminaDelta ?? 0;
      const stepVP = card.vp + eventVpDelta;
      daySummary.vp += stepVP;
      daySummary.steps += 1;
      steps.push({
        id: card.id,
        dayIndex,
        rowIndex,
        dayLabel,
        timeLabel,
        title: card.name,
        subtitle: `${card.city} \u2022 ${card.tagLabel}`,
        vpDelta: stepVP,
        coinDelta: -card.coin,
        staminaDelta: -card.stamina + eventStaminaDelta,
        comboText,
        eventText: activeEvent?.text,
        eventType: activeEvent?.type,
        eventVpDelta,
        eventStaminaDelta,
        distanceKm: activeEvent?.distanceKm,
        isBadEvent: activeEvent?.isBad === true
      });
      previousCard = card;
    }
    return { steps, daySummaries: [daySummary] };
  }
  function calculateSimulationResult({
    boardSlots,
    currentDayIndex: currentDayIndex2,
    dayLabel,
    rows: rows2,
    getBoardDisplayName: getBoardDisplayName2,
    getCardTagKeys: getCardTagKeys3,
    countCardsWithTag: countCardsWithTag2,
    getCurrentDayPlacedCards: getCurrentDayPlacedCards3
  }) {
    const breakdown = calculateScoreBreakdown({
      placedCards: getCurrentDayPlacedCards3(),
      getBoardDisplayName: getBoardDisplayName2
    });
    const warnings = [];
    const events = [];
    const { steps: replaySteps, daySummaries } = buildSimulationReplaySteps({
      boardSlots,
      currentDayIndex: currentDayIndex2,
      dayLabel,
      rows: rows2,
      getCardTagKeys: getCardTagKeys3,
      countCardsWithTag: countCardsWithTag2,
      getCurrentDayPlacedCards: getCurrentDayPlacedCards3
    });
    const debtPenalty = replaySteps.reduce((sum, step) => {
      return step.isDebtPenalty ? sum + Math.abs(step.vpDelta) : sum;
    }, 0);
    const eventModifier = replaySteps.reduce((sum, step) => {
      if (step.eventType === "promo" || step.eventType === "storm") {
        return sum + (step.eventVpDelta ?? 0);
      }
      return sum;
    }, 0);
    const distancePenalty = replaySteps.reduce((sum, step) => {
      if (step.eventType === "distance") {
        return sum + Math.abs(step.eventVpDelta ?? 0);
      }
      return sum;
    }, 0);
    if (breakdown.usedSlots === 0) {
      warnings.push("Ch\u01B0a c\xF3 th\u1EBB n\xE0o tr\xEAn l\u1ECBch tr\xECnh.");
    }
    if (breakdown.usedSlots > 0 && breakdown.bonusVP === 0) {
      warnings.push("L\u1ECBch tr\xECnh ch\u01B0a k\xEDch ho\u1EA1t combo n\xE0o.");
    }
    for (let rowIndex = 0; rowIndex < boardSlots.length; rowIndex += 1) {
      const filledInRow = boardSlots[rowIndex].filter((_, colIndex) => colIndex === currentDayIndex2).filter((card) => card !== null).length;
      if (filledInRow >= 4) {
        warnings.push(`${rows2[rowIndex]} c\xF3 l\u1ECBch d\xE0y, n\xEAn ch\u1EEBa \xF4 ngh\u1EC9/di chuy\u1EC3n.`);
      }
    }
    if (warnings.length === 0) {
      warnings.push("L\u1ECBch tr\xECnh hi\u1EC7n t\u1EA1i \u1ED5n \u0111\u1EC3 m\xF4 ph\u1ECFng MVP.");
    }
    for (const step of replaySteps) {
      if (step.eventText) {
        events.push(`${step.timeLabel}: ${step.eventText}`);
      }
    }
    if (events.length === 0) {
      events.push("Kh\xF4ng c\xF3 event ph\xE1t sinh trong ng\xE0y n\xE0y.");
    }
    const replayBaseAndEventVP = replaySteps.reduce((sum, step) => {
      return sum + step.vpDelta;
    }, 0);
    const comboOnlyVP = breakdown.bonusVP;
    const finalVP = replayBaseAndEventVP + comboOnlyVP;
    return {
      ...breakdown,
      debtPenalty,
      eventModifier,
      distancePenalty,
      finalVP,
      warnings,
      events,
      replaySteps,
      daySummaries,
      lines: [
        ...breakdown.lines,
        `Debt penalty: -${debtPenalty} VP`,
        `Event modifier: ${eventModifier >= 0 ? "+" : ""}${eventModifier} VP`,
        `Distance penalty: -${distancePenalty} VP`,
        `Final VP: ${finalVP}`
      ]
    };
  }
  function hashStringToUnit(input) {
    let hash = 2166136261;
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) / 4294967295;
  }
  function getDeterministicRandomScanEvent(card, dayIndex, rowIndex) {
    const roll = hashStringToUnit(`${card.id}|${dayIndex}|${rowIndex}|scan-event`);
    if (roll >= 0.15) return null;
    const eventRoll = hashStringToUnit(`${card.id}|${dayIndex}|${rowIndex}|event-type`);
    if (eventRoll < 1 / 3) {
      return {
        type: "promo",
        text: "Khuy\u1EBFn m\xE3i: +10 VP",
        vpDelta: 10,
        staminaDelta: 0,
        isBad: false
      };
    }
    if (eventRoll < 2 / 3) {
      return {
        type: "traffic",
        text: "K\u1EB9t xe: -8 th\u1EC3 l\u1EF1c",
        vpDelta: 0,
        staminaDelta: -8,
        isBad: true
      };
    }
    return {
      type: "storm",
      text: "M\u01B0a gi\xF4ng: -10 VP",
      vpDelta: -10,
      staminaDelta: 0,
      isBad: true
    };
  }
  function getCardLocation(card) {
    const rawCard = card;
    if (typeof rawCard.lat === "number" && typeof rawCard.lng === "number") {
      return {
        lat: rawCard.lat,
        lng: rawCard.lng
      };
    }
    if (rawCard.location && typeof rawCard.location === "object" && typeof rawCard.location.lat === "number" && typeof rawCard.location.lng === "number") {
      return {
        lat: rawCard.location.lat,
        lng: rawCard.location.lng
      };
    }
    return null;
  }
  function getPseudoDistanceKm(previousCard, currentCard, dayIndex, rowIndex) {
    const previousLocation = getCardLocation(previousCard);
    const currentLocation = getCardLocation(currentCard);
    if (previousLocation && currentLocation) {
      return calculateDistanceKm(previousLocation, currentLocation);
    }
    if (previousCard.city !== currentCard.city) {
      return 22 + Math.round(hashStringToUnit(`${previousCard.id}|${currentCard.id}|distance`) * 18);
    }
    return 4 + Math.round(hashStringToUnit(`${previousCard.id}|${currentCard.id}|same-city|${dayIndex}|${rowIndex}`) * 12);
  }
  function getDistanceEvent(previousCard, currentCard, dayIndex, rowIndex) {
    const distanceKm = getPseudoDistanceKm(previousCard, currentCard, dayIndex, rowIndex);
    if (distanceKm <= 20) return null;
    return {
      type: "distance",
      text: "Kho\u1EA3ng c\xE1ch > 20km",
      vpDelta: -30,
      staminaDelta: 0,
      distanceKm,
      isBad: true
    };
  }
  function calculateDistanceKm(from, to) {
    const earthRadiusKm = 6371;
    const deltaLat = toRadians(to.lat - from.lat);
    const deltaLng = toRadians(to.lng - from.lng);
    const lat1 = toRadians(from.lat);
    const lat2 = toRadians(to.lat);
    const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
    return Math.round(earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }
  function toRadians(value) {
    return value * Math.PI / 180;
  }
  function getCardTagKeys2(card) {
    if (card.tags && card.tags.length > 0) {
      return card.tags.map((tag) => tag.toUpperCase());
    }
    return [card.tag.toUpperCase()];
  }
  function countCardsByTag(cards, tag) {
    return cards.filter((card) => getCardTagKeys2(card).includes(tag)).length;
  }

  // src/game/deck.ts
  function createInitialDeck({
    cards,
    fallbackCards,
    handSize
  }) {
    if (cards.length >= handSize) {
      return cards;
    }
    return [
      ...cards,
      ...fallbackCards.slice(0, handSize - cards.length)
    ];
  }
  function shuffleCards(cards) {
    const shuffled = [...cards];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      const temp = shuffled[index];
      shuffled[index] = shuffled[randomIndex];
      shuffled[randomIndex] = temp;
    }
    return shuffled;
  }
  function returnUnplayedHandToDeck({
    deck: deck2,
    playerHand: playerHand2,
    shuffleCards: shuffleCards3
  }) {
    if (playerHand2.length === 0) {
      return {
        deck: deck2,
        playerHand: playerHand2
      };
    }
    return {
      deck: shuffleCards3([...deck2, ...playerHand2]),
      playerHand: []
    };
  }

  // src/game/resources.ts
  function getRemainingResources({
    totals,
    startingCoin,
    startingStamina
  }) {
    return {
      coin: Math.max(0, startingCoin - totals.coin),
      stamina: Math.max(0, startingStamina - totals.stamina)
    };
  }
  function getCardAffordability({
    card,
    remaining
  }) {
    const missingCoin = Math.max(0, card.coin - remaining.coin);
    const missingStamina = Math.max(0, card.stamina - remaining.stamina);
    return {
      canAfford: missingCoin === 0 && missingStamina === 0,
      missingCoin,
      missingStamina
    };
  }
  function getCardAffordabilityMessage(affordability) {
    const reasons = [];
    if (affordability.missingCoin > 0) {
      reasons.push(`thi\u1EBFu ${affordability.missingCoin} xu`);
    }
    if (affordability.missingStamina > 0) {
      reasons.push(`thi\u1EBFu ${affordability.missingStamina} th\u1EC3 l\u1EF1c`);
    }
    if (reasons.length === 0) {
      return "\u0110\u1EE7 t\xE0i nguy\xEAn \u0111\u1EC3 \u0111\u1EB7t l\xE1 n\xE0y";
    }
    return `Kh\xF4ng \u0111\u1EE7 t\xE0i nguy\xEAn: ${reasons.join(", ")}`;
  }

  // src/audio/gameAudio.ts
  var GAME_SOUND_FILES = {
    deal: "assets/sounds/card-deal.mp3",
    returnDeck: "assets/sounds/card-return-deck.mp3",
    cardSelect: "assets/sounds/card-select.mp3",
    cardPlace: "assets/sounds/card-place.mp3",
    button: "assets/sounds/ui-click.mp3",
    scanCell: "assets/sounds/scan-cell.mp3",
    scanBad: "assets/sounds/scan-bad.mp3",
    eventTraffic: "assets/sounds/event-traffic.mp3",
    eventDistance: "assets/sounds/event-distance.mp3",
    eventStorm: "assets/sounds/event-storm.mp3",
    eventPromo: "assets/sounds/event-promo.mp3"
  };
  var gameAudioContext = null;
  var isGameAudioUnlocked = false;
  var lastButtonSoundAt = 0;
  var lastCardSelectSoundAt = 0;
  var lastDealSoundAt = 0;
  var lastReturnSoundAt = 0;
  var gameAudioElements = {};
  var activeGameFileSounds = {};
  var activeGameFileSoundTimers = {};
  function getGameAudioContext() {
    const AudioContextConstructor = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextConstructor) return null;
    if (!gameAudioContext) {
      gameAudioContext = new AudioContextConstructor();
    }
    return gameAudioContext;
  }
  function getGameAudioElement(name) {
    if (!gameAudioElements[name]) {
      const audio = new Audio(GAME_SOUND_FILES[name]);
      audio.preload = "auto";
      audio.crossOrigin = "anonymous";
      const volumeByName = {
        deal: 0.78,
        returnDeck: 0.68,
        cardSelect: 0.82,
        cardPlace: 0.76,
        button: 0.6,
        scanCell: 0.62,
        scanBad: 0.72,
        eventTraffic: 0.62,
        eventDistance: 0.72,
        eventStorm: 0.7,
        eventPromo: 0.74
      };
      const playbackRateByName = {
        deal: 1.08,
        returnDeck: 1,
        cardSelect: 1.08,
        cardPlace: 0.95,
        button: 1.05,
        scanCell: 1.14,
        scanBad: 0.96,
        eventTraffic: 1.06,
        eventDistance: 1.02,
        eventStorm: 1,
        eventPromo: 1.08
      };
      audio.volume = volumeByName[name];
      audio.playbackRate = playbackRateByName[name];
      gameAudioElements[name] = audio;
    }
    return gameAudioElements[name];
  }
  function unlockGameAudio() {
    const audioContext = getGameAudioContext();
    if (audioContext?.state === "suspended") {
      audioContext.resume();
    }
    getGameAudioElement("deal").load();
    getGameAudioElement("returnDeck").load();
    getGameAudioElement("cardSelect").load();
    getGameAudioElement("cardPlace").load();
    getGameAudioElement("button").load();
    getGameAudioElement("scanCell").load();
    getGameAudioElement("scanBad").load();
    getGameAudioElement("eventTraffic").load();
    getGameAudioElement("eventDistance").load();
    getGameAudioElement("eventStorm").load();
    getGameAudioElement("eventPromo").load();
    isGameAudioUnlocked = true;
  }
  function playFileSound(name, options) {
    if (!isGameAudioUnlocked) return;
    if (options?.exclusive) {
      activeGameFileSounds[name]?.pause();
      activeGameFileSounds[name] = void 0;
      if (activeGameFileSoundTimers[name] !== void 0) {
        window.clearTimeout(activeGameFileSoundTimers[name]);
        activeGameFileSoundTimers[name] = void 0;
      }
    }
    const baseAudio = getGameAudioElement(name);
    const audio = baseAudio.cloneNode(true);
    audio.volume = options?.volume ?? baseAudio.volume;
    audio.playbackRate = options?.playbackRate ?? baseAudio.playbackRate;
    audio.currentTime = options?.startTime ?? 0;
    if (options?.exclusive) {
      activeGameFileSounds[name] = audio;
    }
    audio.play().catch(() => {
    });
    if (options?.durationMs !== void 0) {
      activeGameFileSoundTimers[name] = window.setTimeout(() => {
        audio.pause();
        activeGameFileSounds[name] = void 0;
        activeGameFileSoundTimers[name] = void 0;
      }, options.durationMs);
    }
  }
  function createGameGain(audioContext, volume) {
    const gain = audioContext.createGain();
    gain.gain.setValueAtTime(Math.max(1e-4, volume), audioContext.currentTime);
    gain.connect(audioContext.destination);
    return gain;
  }
  function createCardPaperBuffer(audioContext, duration, roughness = 1) {
    const sampleRate = audioContext.sampleRate;
    const frameCount = Math.max(1, Math.floor(sampleRate * duration));
    const buffer = audioContext.createBuffer(1, frameCount, sampleRate);
    const data = buffer.getChannelData(0);
    let brown = 0;
    let crackleHold = 0;
    for (let index = 0; index < frameCount; index += 1) {
      const progress = index / frameCount;
      const attack = Math.min(1, progress / 0.045);
      const release = Math.pow(1 - progress, 2.05);
      const white = Math.random() * 2 - 1;
      brown = (brown + 0.035 * white) / 1.035;
      if (Math.random() > 0.985) {
        crackleHold = (Math.random() * 2 - 1) * 0.65 * roughness;
      } else {
        crackleHold *= 0.82;
      }
      data[index] = (white * 0.55 + brown * 5.8 + crackleHold * 0.42) * attack * release;
    }
    return buffer;
  }
  function playFilteredPaperSound(options) {
    const audioContext = getGameAudioContext();
    if (!audioContext || !isGameAudioUnlocked) return;
    const duration = options.duration ?? 0.11;
    const startDelay = options.startDelay ?? 0;
    const volume = options.volume ?? 0.06;
    const startTime = audioContext.currentTime + startDelay;
    const source = audioContext.createBufferSource();
    const highpass = audioContext.createBiquadFilter();
    const lowpass = audioContext.createBiquadFilter();
    const bandpass = audioContext.createBiquadFilter();
    const gain = createGameGain(audioContext, volume);
    const panner = audioContext.createStereoPanner?.();
    source.buffer = createCardPaperBuffer(audioContext, duration, options.roughness ?? 1);
    source.playbackRate.setValueAtTime(options.playbackRate ?? 1, startTime);
    highpass.type = "highpass";
    highpass.frequency.setValueAtTime(options.highpass ?? 240, startTime);
    highpass.Q.setValueAtTime(0.55, startTime);
    bandpass.type = "bandpass";
    bandpass.frequency.setValueAtTime(options.bandpass ?? 1800, startTime);
    bandpass.Q.setValueAtTime(0.85, startTime);
    lowpass.type = "lowpass";
    lowpass.frequency.setValueAtTime(options.lowpass ?? 4200, startTime);
    lowpass.Q.setValueAtTime(0.6, startTime);
    gain.gain.setValueAtTime(1e-4, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + duration * 0.12);
    gain.gain.exponentialRampToValueAtTime(1e-4, startTime + duration);
    source.connect(highpass);
    highpass.connect(bandpass);
    bandpass.connect(lowpass);
    if (panner) {
      panner.pan.setValueAtTime(options.pan ?? 0, startTime);
      lowpass.connect(panner);
      panner.connect(gain);
    } else {
      lowpass.connect(gain);
    }
    source.start(startTime);
    source.stop(startTime + duration + 0.02);
  }
  function playCardThump(startDelay = 0, volume = 0.05) {
    playFilteredPaperSound({
      duration: 0.045,
      volume,
      startDelay,
      highpass: 55,
      bandpass: 260,
      lowpass: 900,
      playbackRate: 0.72,
      roughness: 0.55
    });
  }
  function playGameSound(name) {
    const now = performance.now();
    if (name === "button") {
      if (now - lastButtonSoundAt < 35) return;
      lastButtonSoundAt = now;
      playFileSound("button", {
        volume: 0.72,
        playbackRate: 1.06,
        startTime: 0,
        durationMs: 260,
        exclusive: true
      });
      return;
    }
    if (name === "cardSelect") {
      if (now - lastCardSelectSoundAt < 80) return;
      lastCardSelectSoundAt = now;
      playFileSound("cardSelect", {
        volume: 0.84,
        playbackRate: 1.06,
        startTime: 0.02
      });
      return;
    }
    if (name === "cardPlace") {
      playFileSound("cardPlace", {
        volume: 0.86,
        playbackRate: 0.98,
        startTime: 0.01,
        durationMs: 420,
        exclusive: true
      });
      return;
    }
    if (name === "deal") {
      if (now - lastDealSoundAt < 430) return;
      lastDealSoundAt = now;
      playFileSound("deal", {
        volume: 0.82,
        playbackRate: 1.12,
        startTime: 0.08
      });
      return;
    }
    if (name === "returnDeck") {
      if (now - lastReturnSoundAt < 850) return;
      lastReturnSoundAt = now;
      playFileSound("returnDeck", {
        volume: 0.72,
        playbackRate: 1.02,
        startTime: 0.02,
        durationMs: 520,
        exclusive: true
      });
      return;
    }
    if (name === "scanCell") {
      playFileSound("scanCell", {
        volume: 0.62,
        playbackRate: 1.14,
        startTime: 0,
        durationMs: 260,
        exclusive: true
      });
      return;
    }
    if (name === "scanBad") {
      playFileSound("scanBad", {
        volume: 0.76,
        playbackRate: 0.96,
        startTime: 0,
        durationMs: 420,
        exclusive: true
      });
      return;
    }
    if (name === "eventTraffic") {
      playFileSound("eventTraffic", {
        volume: 0.62,
        playbackRate: 1.06,
        startTime: 0,
        durationMs: 980,
        exclusive: true
      });
      return;
    }
    if (name === "eventDistance") {
      playFileSound("eventDistance", {
        volume: 0.72,
        playbackRate: 1.02,
        startTime: 0,
        durationMs: 650,
        exclusive: true
      });
      return;
    }
    if (name === "eventStorm") {
      playFileSound("eventStorm", {
        volume: 0.7,
        playbackRate: 1,
        startTime: 0,
        durationMs: 1120,
        exclusive: true
      });
      return;
    }
    if (name === "eventPromo") {
      playFileSound("eventPromo", {
        volume: 0.74,
        playbackRate: 1.08,
        startTime: 0,
        durationMs: 820,
        exclusive: true
      });
      return;
    }
    if (name === "reject") {
      playFilteredPaperSound({
        duration: 0.06,
        volume: 0.055,
        highpass: 90,
        bandpass: 420,
        lowpass: 1100,
        playbackRate: 0.7,
        roughness: 0.8
      });
      playCardThump(0.05, 0.045);
    }
  }
  function setupGameAudioDelegation() {
    document.addEventListener(
      "pointerdown",
      (event) => {
        unlockGameAudio();
        const target = event.target;
        if (!target) return;
        const isHandOrDraftCard = Boolean(
          target.closest("[data-hand-card-id], [data-draft-card-id], .hand-card, .daily-draft-card")
        );
        const boardMiniCard = target.closest(".board-mini");
        if (isHandOrDraftCard) {
          return;
        }
        if (boardMiniCard) {
          playGameSound("cardSelect");
          return;
        }
        playGameSound("button");
      },
      true
    );
  }

  // src/export/certificate.ts
  var CERTIFICATE_HISTORY_STORAGE_KEY = "travel_board_certificate_history";
  function getExportFileSafeName(value) {
    return value.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 64) || "lich-trinh";
  }
  function buildTravelTimelineExport() {
    const boardSlots = getBoardSlots();
    const breakdown = getCurrentScoreBreakdown();
    const remaining = getRemainingResources2();
    const createdAt = (/* @__PURE__ */ new Date()).toISOString();
    const timeline = days.map((day, dayIndex) => {
      return {
        day,
        label: `Ng\xE0y ${day}`,
        slots: rows.map((timeLabel, rowIndex) => {
          const card = boardSlots[rowIndex]?.[dayIndex] ?? null;
          return {
            timeLabel,
            card: card ? {
              id: card.id,
              name: card.name,
              city: card.city,
              tag: card.tag,
              tagLabel: card.tagLabel,
              vp: card.vp,
              coin: card.coin,
              stamina: card.stamina,
              description: card.description
            } : null
          };
        })
      };
    });
    return {
      version: 1,
      createdAt,
      playerName: getDisplayPlayerName(),
      phaseNumber,
      currentDay: days[currentDayIndex],
      score: {
        baseVP: breakdown.baseVP,
        bonusVP: breakdown.bonusVP,
        totalVP: simulationResult?.finalVP ?? breakdown.totalVP,
        accumulatedVP
      },
      resources: {
        spentCoin: breakdown.spentCoin,
        spentStamina: breakdown.spentStamina,
        remainingCoin: remaining.coin,
        remainingStamina: remaining.stamina,
        usedSlots: breakdown.usedSlots
      },
      timeline
    };
  }
  function getCertificateHistoryStorageKey() {
    return `${CERTIFICATE_HISTORY_STORAGE_KEY}:${onlineClientState.roomId ?? "local"}:${onlineClientState.playerId ?? currentPlayerId}`;
  }
  function loadCertificateHistory() {
    try {
      const raw = localStorage.getItem(getCertificateHistoryStorageKey());
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  function saveCertificateHistory(phases) {
    localStorage.setItem(getCertificateHistoryStorageKey(), JSON.stringify(phases));
  }
  function getPhaseStyleLabel(cards) {
    if (cards.length === 0) return "Ch\u01B0a c\xF3 d\u1EEF li\u1EC7u";
    const tagCounts = /* @__PURE__ */ new Map();
    for (const card of cards) {
      const key = card.tag || "unknown";
      const current = tagCounts.get(key) ?? {
        label: card.tagLabel || card.tag || "Kh\xE1c",
        count: 0
      };
      current.count += 1;
      tagCounts.set(key, current);
    }
    const sorted = [...tagCounts.values()].sort((a, b) => b.count - a.count);
    if (sorted.length >= 2 && sorted[0].count === sorted[1].count) {
      return "K\u1EBFt h\u1EE3p";
    }
    return sorted[0]?.label ?? "K\u1EBFt h\u1EE3p";
  }
  function createCertificatePhaseSnapshot(phaseToSnapshot = phaseNumber) {
    const boardSlots = getBoardSlots();
    const daysSnapshot = days.map((day, dayIndex) => {
      return {
        day,
        label: `Ng\xE0y ${day}`,
        slots: rows.map((timeLabel, rowIndex) => {
          const card = boardSlots[rowIndex]?.[dayIndex] ?? null;
          return {
            timeLabel,
            card: card ? {
              id: card.id,
              name: card.name,
              city: card.city,
              tag: card.tag,
              tagLabel: card.tagLabel,
              vp: card.vp,
              coin: card.coin,
              stamina: card.stamina,
              description: card.description
            } : null
          };
        })
      };
    });
    const cards = [];
    for (const day of daysSnapshot) {
      for (const slot of day.slots) {
        if (slot.card) {
          cards.push(slot.card);
        }
      }
    }
    const completedDays = daysSnapshot.filter((day) => {
      return day.slots.some((slot) => slot.card !== null);
    }).length;
    const completedSlots = cards.length;
    const phaseScore = cards.reduce((sum, card) => {
      return sum + card.vp;
    }, 0);
    return {
      phaseNumber: phaseToSnapshot,
      phaseScore,
      completedDays,
      completedSlots,
      styleLabel: getPhaseStyleLabel(cards),
      days: daysSnapshot,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  function rememberCurrentCertificatePhase() {
    if (!isOnlineRoomActive()) return;
    if (!onlineClientState.roomState) return;
    if (onlineClientState.roomState.phase === "lobby" || onlineClientState.roomState.phase === "draft") return;
    const snapshot = createCertificatePhaseSnapshot(phaseNumber);
    if (snapshot.completedSlots <= 0) return;
    const history = loadCertificateHistory();
    const nextHistory = history.filter((phase) => phase.phaseNumber !== snapshot.phaseNumber);
    nextHistory.push(snapshot);
    nextHistory.sort((a, b) => a.phaseNumber - b.phaseNumber);
    saveCertificateHistory(nextHistory);
  }
  function getCertificateExportData() {
    rememberCurrentCertificatePhase();
    const history = loadCertificateHistory();
    const currentSnapshot = createCertificatePhaseSnapshot(phaseNumber);
    const merged = history.filter((phase) => phase.phaseNumber !== currentSnapshot.phaseNumber);
    if (currentSnapshot.completedSlots > 0) {
      merged.push(currentSnapshot);
    }
    merged.sort((a, b) => a.phaseNumber - b.phaseNumber);
    const phases = [1, 2, 3].map((phaseNumberToFind) => {
      return merged.find((phase) => phase.phaseNumber === phaseNumberToFind) ?? {
        phaseNumber: phaseNumberToFind,
        phaseScore: 0,
        completedDays: 0,
        completedSlots: 0,
        styleLabel: "Ch\u01B0a ho\xE0n th\xE0nh",
        days: days.map((day) => ({
          day,
          label: `Ng\xE0y ${day}`,
          slots: rows.map((timeLabel) => ({
            timeLabel,
            card: null
          }))
        })),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
    });
    const totalScore = phases.reduce((sum, phase) => sum + phase.phaseScore, 0);
    const completedPhaseCount = phases.filter((phase) => phase.completedSlots > 0).length;
    const completedSlots = phases.reduce((sum, phase) => sum + phase.completedSlots, 0);
    const completedDays = phases.reduce((sum, phase) => sum + phase.completedDays, 0);
    return {
      version: 1,
      exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
      playerName: getDisplayPlayerName(),
      roomId: onlineClientState.roomId ?? "LOCAL",
      totalScore,
      completedPhaseCount,
      completedDays,
      completedSlots,
      phases
    };
  }
  function buildTravelCertificateHtml() {
    const data = getCertificateExportData();
    const safeDataJson = JSON.stringify(data).replace(/</g, "\\u003c");
    return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Ch\u1EE9ng nh\u1EADn h\xE0nh tr\xECnh - ${data.playerName}</title>
  <style>
    :root {
      --ink: #4e3325;
      --muted: rgba(78, 51, 37, 0.68);
      --gold: #d99a2b;
      --gold-dark: #9b641f;
      --paper: #fff7e8;
      --paper-2: #f3e3c6;
      --violet: #7c3aed;
      --green: #4f7d2b;
      --blue: #2563eb;
    }

    * {
      box-sizing: border-box;
      text-rendering: optimizeLegibility;
    }

    html {
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    body {
      margin: 0;
      min-height: 100vh;
      background:
        radial-gradient(circle at 50% 0%, rgba(255,255,255,.92), transparent 38%),
        linear-gradient(180deg, #efe1c8, #d7bd8d);
      color: var(--ink);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, "Helvetica Neue", sans-serif;
      display: grid;
      place-items: center;
      padding: 22px;
    }

    button {
      font: inherit;
    }

    .certificate {
      width: min(980px, 100%);
      background:
        radial-gradient(circle at 15% 8%, rgba(255,255,255,.9), transparent 26%),
        radial-gradient(circle at 85% 92%, rgba(255,255,255,.55), transparent 30%),
        linear-gradient(180deg, #fff8ea, #f3dfb8);
      border: 3px double rgba(168, 111, 31, .72);
      border-radius: 28px;
      box-shadow:
        0 28px 80px rgba(82, 49, 19, .24),
        inset 0 0 0 10px rgba(255,255,255,.32);
      padding: 34px;
      position: relative;
      overflow: hidden;
    }

    .certificate::before,
    .certificate::after {
      content: "";
      position: absolute;
      width: 360px;
      height: 360px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(217,154,43,.12), transparent 68%);
      pointer-events: none;
    }

    .certificate::before {
      left: -170px;
      top: -170px;
    }

    .certificate::after {
      right: -170px;
      bottom: -170px;
    }

    .toolbar {
      position: sticky;
      top: 0;
      z-index: 4;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-bottom: 12px;
      font-family: system-ui, sans-serif;
    }

    .toolbar button {
      cursor: pointer;
      border: 0;
      border-radius: 999px;
      padding: 10px 14px;
      color: white;
      background: linear-gradient(135deg, #8b5cf6, #6d28d9);
      font-weight: 800;
      box-shadow: 0 10px 18px rgba(109, 40, 217, .22);
    }

    .header {
      position: relative;
      z-index: 1;
      text-align: center;
    }

    .compass {
      width: 54px;
      height: 54px;
      margin: 0 auto 8px;
      display: grid;
      place-items: center;
      border: 2px solid rgba(155, 100, 31, .36);
      border-radius: 50%;
      color: var(--gold-dark);
      font-size: 30px;
      background: rgba(255,255,255,.36);
    }

    .header h1 {
      margin: 0;
      font-family: "Segoe UI", Arial, "Helvetica Neue", sans-serif;
      font-size: clamp(34px, 5vw, 58px);
      font-weight: 900;
      letter-spacing: .02em;
      text-transform: uppercase;
      text-shadow: 0 2px 0 rgba(255,255,255,.65);
    }

    .subtitle {
      margin-top: 8px;
      color: var(--gold-dark);
      font-size: 20px;
    }

    .player {
      margin-top: 22px;
      font-family: "Segoe UI", Arial, "Helvetica Neue", sans-serif;
      font-size: clamp(34px, 4.4vw, 54px);
      font-weight: 900;
      line-height: 1.15;
    }

    .score-panel {
      width: min(620px, 100%);
      margin: 20px auto 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 18px;
      border: 2px solid rgba(188, 129, 48, .52);
      border-radius: 22px;
      padding: 14px 24px;
      background: rgba(255,255,255,.42);
      box-shadow: inset 0 1px 0 rgba(255,255,255,.78), 0 10px 22px rgba(111, 69, 24, .08);
    }

    .score-panel span {
      font-size: 21px;
      font-weight: 800;
    }

    .score-panel strong {
      color: #d97706;
      font-size: clamp(52px, 7vw, 86px);
      line-height: .9;
    }

    .hint {
      margin: 0;
      color: var(--muted);
      font-size: 16px;
    }

    .phase-tabs {
      margin: 28px 0 18px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      position: relative;
      z-index: 1;
    }

    .phase-tab {
      cursor: pointer;
      border: 2px solid rgba(182, 126, 47, .36);
      border-radius: 20px;
      background: rgba(255,255,255,.44);
      padding: 14px;
      color: var(--ink);
      box-shadow: inset 0 1px 0 rgba(255,255,255,.74);
      transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease;
    }

    .phase-tab:hover,
    .phase-tab.is-active {
      transform: translateY(-2px);
      border-color: rgba(124, 58, 237, .5);
      box-shadow: 0 12px 22px rgba(87, 49, 20, .12), inset 0 1px 0 rgba(255,255,255,.8);
    }

    .phase-tab h2 {
      margin: 0 0 8px;
      color: var(--phase-color);
      font-size: 22px;
    }

    .phase-tab p {
      margin: 6px 0;
      color: var(--muted);
      font-size: 15px;
    }

    .phase-tab strong {
      color: var(--phase-color);
      font-size: 22px;
    }

    .timeline {
      position: relative;
      z-index: 1;
      border: 2px solid rgba(174, 116, 39, .32);
      border-radius: 24px;
      padding: 20px;
      background: rgba(255,255,255,.38);
    }

    .timeline-head {
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 16px;
    }

    .timeline-head h3 {
      margin: 0;
      font-size: 28px;
    }

    .timeline-head span {
      color: var(--muted);
      font-size: 15px;
    }

    .days {
      display: grid;
      gap: 14px;
    }

    .day-card {
      border: 1px solid rgba(174, 116, 39, .28);
      border-radius: 18px;
      background: rgba(255, 251, 239, .78);
      padding: 14px;
    }

    .day-card h4 {
      margin: 0 0 10px;
      color: var(--phase-color);
      font-size: 20px;
    }

    .slots {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 8px;
    }

    .slot {
      min-height: 116px;
      border: 1px dashed rgba(160, 115, 66, .46);
      border-radius: 14px;
      padding: 10px;
      background: rgba(255,255,255,.45);
    }

    .slot em {
      display: block;
      color: var(--gold-dark);
      font-style: normal;
      font-weight: 900;
      margin-bottom: 6px;
    }

    .slot strong {
      display: block;
      min-height: 34px;
      font-size: 15px;
      line-height: 1.12;
    }

    .slot span {
      color: #15803d;
      display: block;
      font-weight: 900;
      margin-top: 7px;
    }

    .slot small {
      color: var(--muted);
      display: block;
      margin-top: 4px;
      line-height: 1.25;
    }

    .empty {
      opacity: .58;
    }

    .badges {
      margin-top: 18px;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      position: relative;
      z-index: 1;
    }

    .badge {
      border: 1px solid rgba(174, 116, 39, .28);
      border-radius: 999px;
      background: rgba(255,255,255,.42);
      padding: 12px;
      text-align: center;
      color: var(--ink);
      font-weight: 800;
    }

    .footer {
      margin-top: 24px;
      text-align: center;
      color: var(--muted);
      font-size: 15px;
      position: relative;
      z-index: 1;
    }

    .signature {
      display: block;
      margin-top: 6px;
      color: var(--ink);
      font-size: 28px;
      font-style: italic;
    }

    @media print {
      body {
        background: white;
        padding: 0;
      }

      .toolbar {
        display: none;
      }

      .certificate {
        box-shadow: none;
        border-radius: 0;
        width: 100%;
      }
    }

    @media (max-width: 760px) {
      .certificate {
        padding: 22px;
      }

      .phase-tabs,
      .badges {
        grid-template-columns: 1fr;
      }

      .slots {
        grid-template-columns: 1fr;
      }

      .score-panel {
        flex-direction: column;
        gap: 4px;
      }
    }
  </style>
</head>
<body>
  <main class="certificate">
    <div class="toolbar">
      <button onclick="window.print()">In / L\u01B0u PDF</button>
    </div>

    <section class="header">
      <div class="compass">\u2726</div>
      <h1>Ch\u1EE9ng nh\u1EADn h\xE0nh tr\xECnh</h1>
      <div class="subtitle">T\u1ED5ng k\u1EBFt 3 phase</div>
      <div class="player" id="playerName"></div>

      <div class="score-panel">
        <span>T\u1ED4NG \u0110I\u1EC2M</span>
        <strong id="totalScore"></strong>
        <span>VP</span>
      </div>

      <p class="hint">B\u1EA5m v\xE0o t\u1EEBng phase \u0111\u1EC3 xem chi ti\u1EBFt h\xE0nh tr\xECnh ng\xE0y 1 \u2192 5.</p>
    </section>

    <section class="phase-tabs" id="phaseTabs"></section>

    <section class="timeline" id="timeline"></section>

    <section class="badges">
      <div class="badge">\u{1F37D}\uFE0F \u1EA8m th\u1EF1c n\u1ED5i b\u1EADt</div>
      <div class="badge">\u{1F4C5} L\u1ECBch tr\xECnh hi\u1EC7u qu\u1EA3</div>
      <div class="badge">\u{1F3D4}\uFE0F Kh\xE1m ph\xE1 b\u1EC1n b\u1EC9</div>
      <div class="badge">\u{1F3C6} Ho\xE0n th\xE0nh 3 phase</div>
    </section>

    <footer class="footer">
      <div id="exportDate"></div>
      <span class="signature">Travel Board Online</span>
    </footer>
  </main>

  <script>
    const certificateData = ${safeDataJson};
    let activePhaseNumber = certificateData.phases.find((phase) => phase.completedSlots > 0)?.phaseNumber ?? 1;

    function escapeHtml(value) {
      return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    function getPhaseColor(phaseNumber) {
      if (phaseNumber === 1) return "#4f7d2b";
      if (phaseNumber === 2) return "#2563eb";
      return "#7c3aed";
    }

    function renderPhaseTabs() {
      const root = document.querySelector("#phaseTabs");

      root.innerHTML = certificateData.phases.map((phase) => {
        const isActive = phase.phaseNumber === activePhaseNumber;
        const color = getPhaseColor(phase.phaseNumber);

        return \`
          <button class="phase-tab \${isActive ? "is-active" : ""}" style="--phase-color: \${color}" onclick="selectPhase(\${phase.phaseNumber})">
            <h2>PHASE \${phase.phaseNumber}</h2>
            <p>\u0110i\u1EC3m: <strong>\${phase.phaseScore} VP</strong></p>
            <p>Ng\xE0y ho\xE0n th\xE0nh: \${phase.completedDays}/5</p>
            <p>Phong c\xE1ch: \${escapeHtml(phase.styleLabel)}</p>
          </button>
        \`;
      }).join("");
    }

    function renderTimeline() {
      const phase = certificateData.phases.find((item) => item.phaseNumber === activePhaseNumber) ?? certificateData.phases[0];
      const root = document.querySelector("#timeline");
      const color = getPhaseColor(phase.phaseNumber);

      root.style.setProperty("--phase-color", color);

      root.innerHTML = \`
        <div class="timeline-head">
          <div>
            <h3>Chi ti\u1EBFt Phase \${phase.phaseNumber}</h3>
            <span>\${phase.completedSlots} slot \u2022 \${phase.completedDays}/5 ng\xE0y \u2022 \${phase.phaseScore} VP</span>
          </div>
        </div>

        <div class="days">
          \${phase.days.map((day) => {
            const hasAnyCard = day.slots.some((slot) => slot.card);

            return \`
              <article class="day-card \${hasAnyCard ? "" : "empty"}">
                <h4>\${escapeHtml(day.label)}</h4>
                <div class="slots">
                  \${day.slots.map((slot) => {
                    if (!slot.card) {
                      return \`
                        <div class="slot empty">
                          <em>\${escapeHtml(slot.timeLabel)}</em>
                          <strong>Ngh\u1EC9 / Di chuy\u1EC3n</strong>
                          <small>Ch\u01B0a c\xF3 ho\u1EA1t \u0111\u1ED9ng</small>
                        </div>
                      \`;
                    }

                    return \`
                      <div class="slot">
                        <em>\${escapeHtml(slot.timeLabel)}</em>
                        <strong>\${escapeHtml(slot.card.name)}</strong>
                        <small>\${escapeHtml(slot.card.city || "Kh\xF4ng r\xF5 khu v\u1EF1c")}</small>
                        <span>+\${slot.card.vp} VP</span>
                        <small>\${escapeHtml(slot.card.tagLabel || slot.card.tag)}</small>
                      </div>
                    \`;
                  }).join("")}
                </div>
              </article>
            \`;
          }).join("")}
        </div>
      \`;
    }

    function selectPhase(phaseNumber) {
      activePhaseNumber = phaseNumber;
      renderPhaseTabs();
      renderTimeline();
    }

    document.querySelector("#playerName").textContent = certificateData.playerName;
    document.querySelector("#totalScore").textContent = certificateData.totalScore;
    document.querySelector("#exportDate").textContent = "Ng\xE0y xu\u1EA5t: " + new Date(certificateData.exportedAt).toLocaleDateString("vi-VN");
    renderPhaseTabs();
    renderTimeline();
  <\/script>
</body>
</html>`;
  }
  function downloadTravelCertificateHtml() {
    const data = getCertificateExportData();
    const baseName = getExportFileSafeName(
      `${data.playerName}-chung-nhan-hanh-trinh-3-phase`
    );
    downloadTextFile(
      `${baseName}.html`,
      buildTravelCertificateHtml(),
      "text/html;charset=utf-8"
    );
  }
  function formatTravelTimelineAsText() {
    const data = buildTravelTimelineExport();
    const lines = [];
    lines.push("L\u1EEE KH\xC1CH B\xC0N C\u1EDC - L\u1ECACH TR\xCCNH DU L\u1ECACH");
    lines.push(`Ng\u01B0\u1EDDi ch\u01A1i: ${data.playerName}`);
    lines.push(`Phase: ${data.phaseNumber}`);
    lines.push(`Ng\xE0y xu\u1EA5t: ${new Date(data.createdAt).toLocaleString("vi-VN")}`);
    lines.push("");
    lines.push("T\u1ED4NG K\u1EBET");
    lines.push(`- \u0110i\u1EC3m ng\xE0y: ${data.score.totalVP} VP`);
    lines.push(`- T\u1ED5ng phase hi\u1EC7n t\u1EA1i: ${data.score.accumulatedVP} VP`);
    lines.push(`- Xu \u0111\xE3 d\xF9ng: ${data.resources.spentCoin}`);
    lines.push(`- Th\u1EC3 l\u1EF1c \u0111\xE3 d\xF9ng: ${data.resources.spentStamina}`);
    lines.push(`- Slot \u0111\xE3 d\xF9ng: ${data.resources.usedSlots}/25`);
    lines.push("");
    for (const day of data.timeline) {
      const hasAnyCard = day.slots.some((slot) => slot.card !== null);
      if (!hasAnyCard) continue;
      lines.push(day.label.toUpperCase());
      for (const slot of day.slots) {
        if (!slot.card) {
          lines.push(`- ${slot.timeLabel}: Ngh\u1EC9 / Di chuy\u1EC3n`);
          continue;
        }
        lines.push(
          `- ${slot.timeLabel}: ${slot.card.name} (${slot.card.city || "Kh\xF4ng r\xF5 khu v\u1EF1c"})`
        );
        lines.push(
          `  Tag: ${slot.card.tagLabel || slot.card.tag} \u2022 VP: ${slot.card.vp} \u2022 Xu: ${slot.card.coin} \u2022 Th\u1EC3 l\u1EF1c: ${slot.card.stamina}`
        );
        if (slot.card.description) {
          lines.push(`  Ghi ch\xFA: ${slot.card.description}`);
        }
      }
      lines.push("");
    }
    return lines.join("\n");
  }
  function downloadTextFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }
  function downloadTravelTimeline(format) {
    const data = buildTravelTimelineExport();
    const baseName = getExportFileSafeName(
      `${data.playerName}-phase-${data.phaseNumber}-lich-trinh`
    );
    if (format === "json") {
      downloadTextFile(
        `${baseName}.json`,
        JSON.stringify(data, null, 2),
        "application/json;charset=utf-8"
      );
      return;
    }
    downloadTextFile(
      `${baseName}.txt`,
      formatTravelTimelineAsText(),
      "text/plain;charset=utf-8"
    );
  }
  async function copyTravelTimelineToClipboard() {
    const text = formatTravelTimelineAsText();
    try {
      await navigator.clipboard.writeText(text);
      alert("\u0110\xE3 copy l\u1ECBch tr\xECnh v\xE0o clipboard.");
    } catch {
      prompt("Copy l\u1ECBch tr\xECnh:", text);
    }
  }

  // src/app.ts
  var app = document.getElementById("app");
  var playersLeftBase = [
    {
      id: "p2",
      rank: 3,
      name: "C\u01B0\u1EDDng",
      score: 180,
      coin: 890,
      stamina: 20,
      usedSlots: 3
    },
    {
      id: "p1",
      rank: 1,
      name: "An",
      score: 0,
      coin: STARTING_COIN,
      stamina: STARTING_STAMINA,
      usedSlots: 0,
      active: true
    }
  ];
  var playersRight = [
    {
      id: "p3",
      rank: 3,
      name: "Minh",
      score: 190,
      coin: 720,
      stamina: 15,
      usedSlots: 3
    },
    {
      id: "p4",
      rank: 3,
      name: "Kh\xE1nh",
      score: 240,
      coin: 720,
      stamina: 15,
      usedSlots: 3
    }
  ];
  var images = {
    coffee: "https://images.unsplash.com/photo-1517701550927-30cf4ba1f0d5?auto=format&fit=crop&w=1000&q=80",
    bridge: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1000&q=80",
    sea: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1000&q=80",
    food: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1000&q=80",
    market: "https://images.unsplash.com/photo-1563492065599-3520f775eeed?auto=format&fit=crop&w=1000&q=80",
    night: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=1000&q=80",
    temple: "https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1000&q=80"
  };
  var fallbackHandCards = [
    {
      id: "fallback_coffee",
      name: "C\xE0 Ph\xEA Tr\u1EE9ng",
      shortName: "C\xE0 Ph\xEA Tr\u1EE9ng",
      city: "H\xE0 N\u1ED9i",
      shortCity: "H\xE0 N\u1ED9i",
      image: images.coffee,
      rarity: "uncommon",
      rarityLabel: "\u2605\u2605",
      vp: 12,
      coin: 30,
      stamina: 5,
      tag: "food",
      tagLabel: "\u1EA8m th\u1EF1c",
      icon: "\u2615",
      description: "M\u1ED9t ly c\xE0 ph\xEA tr\u1EE9ng b\xE9o m\u1ECBn, r\u1EA5t h\u1EE3p \u0111\u1EC3 m\u1EDF \u0111\u1EA7u h\xE0nh tr\xECnh kh\xE1m ph\xE1 ph\u1ED1 c\u1ED5 H\xE0 N\u1ED9i.",
      bonusText: "N\u1EBFu c\xF3 2 tag \u1EA8m th\u1EF1c: +5 VP"
    },
    {
      id: "fallback_bridge",
      name: "C\u1EA7u V\xE0ng",
      shortName: "C\u1EA7u V\xE0ng",
      city: "\u0110\xE0 N\u1EB5ng",
      shortCity: "\u0110\xE0 N\u1EB5ng",
      image: images.bridge,
      rarity: "epic",
      rarityLabel: "\u2605\u2605\u2605\u2605",
      vp: 45,
      coin: 150,
      stamina: 35,
      tag: "culture",
      tagLabel: "V\u0103n h\xF3a",
      icon: "\u{1F3DB}\uFE0F",
      description: "B\u0103ng qua c\xE2y c\u1EA7u tr\xEAn m\xE2y v\u1EDBi khung c\u1EA3nh ngo\u1EA1n m\u1EE5c, m\u1ED9t \u0111i\u1EC3m \u0111\u1EBFn c\xF3 gi\xE1 tr\u1ECB cao.",
      bonusText: "N\u1EBFu c\xF3 3 tag V\u0103n h\xF3a: +15 VP"
    },
    {
      id: "fallback_cruise",
      name: "Du Thuy\u1EC1n H\u1EA1 Long",
      shortName: "Du Thuy\u1EC1n",
      city: "Qu\u1EA3ng Ninh",
      shortCity: "Qu\u1EA3ng Ninh",
      image: images.sea,
      rarity: "legendary",
      rarityLabel: "\u2605\u2605\u2605\u2605\u2605",
      vp: 85,
      coin: 400,
      stamina: 60,
      tag: "nature",
      tagLabel: "Thi\xEAn nhi\xEAn",
      icon: "\u26F5",
      description: "Kh\xE1m ph\xE1 v\u1ECBnh H\u1EA1 Long gi\u1EEFa nh\u1EEFng d\xE3y n\xFAi \u0111\xE1 v\xF4i k\u1EF3 v\u0129, \u0111i\u1EC3m cao nh\u01B0ng t\u1ED1n t\xE0i nguy\xEAn.",
      bonusText: "N\u1EBFu c\xF3 4 l\xE1 kh\xE1c nhau: +30 VP"
    },
    {
      id: "fallback_banhmi",
      name: "B\xE1nh M\xEC Hu\u1EF3nh Hoa",
      shortName: "B\xE1nh M\xEC",
      city: "S\xE0i G\xF2n",
      shortCity: "S\xE0i G\xF2n",
      image: images.food,
      rarity: "common",
      rarityLabel: "\u2605",
      vp: 14,
      coin: 28,
      stamina: 4,
      tag: "food",
      tagLabel: "\u1EA8m th\u1EF1c",
      icon: "\u{1F956}",
      description: "M\u1ED9t m\xF3n \u0103n \u0111\u01B0\u1EDDng ph\u1ED1 n\u1ED5i ti\u1EBFng, r\u1EBB, d\u1EC5 gh\xE9p combo v\u1EDBi c\xE1c \u0111i\u1EC3m \u1EA9m th\u1EF1c kh\xE1c.",
      bonusText: "N\u1EBFu \u0111i c\xF9ng 1 l\xE1 \u1EA8m th\u1EF1c kh\xE1c: +4 VP"
    },
    {
      id: "fallback_night_market",
      name: "Ch\u1EE3 \u0110\xEAm \u0110\xE0 L\u1EA1t",
      shortName: "Ch\u1EE3 \u0110\xEAm",
      city: "\u0110\xE0 L\u1EA1t",
      shortCity: "\u0110\xE0 L\u1EA1t",
      image: images.night,
      rarity: "common",
      rarityLabel: "\u2605",
      vp: 15,
      coin: 32,
      stamina: 6,
      tag: "night",
      tagLabel: "Bu\u1ED5i t\u1ED1i",
      icon: "\u{1F319}",
      description: "Kh\xF4ng kh\xED nh\u1ED9n nh\u1ECBp v\u1EC1 \u0111\xEAm, ph\xF9 h\u1EE3p n\u1ED1i chu\u1ED7i l\u1ECBch tr\xECnh t\u1ED1i v\xE0 t\u1EA1o \u0111i\u1EC3m \u1ED5n \u0111\u1ECBnh.",
      bonusText: "N\u1EBFu \u0111i sau 1 l\xE1 bu\u1ED5i T\u1ED1i: +6 VP"
    }
  ];
  function normalizeCardImage(card) {
    if (card.image && card.image.trim().length > 0) {
      return card;
    }
    return {
      ...card,
      image: images.food
    };
  }
  function createInitialDeck2() {
    return createInitialDeck({
      cards: phase1Cards.map(mapGameCardToTravelCard).map(normalizeCardImage),
      fallbackCards: fallbackHandCards,
      handSize: HAND_SIZE
    });
  }
  function shuffleCards2(cards) {
    return shuffleCards(cards);
  }
  function returnUnplayedHandToDeck2() {
    const result = returnUnplayedHandToDeck({
      deck,
      playerHand,
      shuffleCards: shuffleCards2
    });
    deck = result.deck;
    playerHand = result.playerHand;
  }
  function getCurrentDayLabel() {
    return `Ng\xE0y ${days[currentDayIndex]}`;
  }
  function getCurrentPhaseLabel() {
    return `Phase ${phaseNumber}`;
  }
  function isOnlineRoomActive() {
    return Boolean(onlineClientState.roomId && onlineClientState.playerId && onlineClientState.roomState);
  }
  function isOnlineGameOver() {
    return onlineClientState.roomState?.phase === "gameover";
  }
  function getOnlineFinalRankings() {
    const state = onlineClientState.roomState;
    if (!state) return [];
    return playerIds.map((playerId) => {
      const player = state.players[playerId];
      return {
        playerId,
        name: player.name,
        score: player.score,
        coin: player.coin,
        stamina: player.stamina,
        usedSlots: player.usedSlots,
        isConnected: player.isConnected
      };
    }).sort((first, second) => {
      if (second.score !== first.score) return second.score - first.score;
      if (second.coin !== first.coin) return second.coin - first.coin;
      return second.stamina - first.stamina;
    });
  }
  function getOnlineSelfState() {
    return onlineClientState.roomState?.self ?? null;
  }
  function getOnlineSelfDraftPool() {
    return getOnlineSelfState()?.draftPool ?? null;
  }
  function getOnlineDraftDisplayPool() {
    if (!isOnlineRoomActive()) return null;
    return onlineDraftDisplayPool ?? getOnlineSelfDraftPool();
  }
  function getDraftPoolSignature(cards) {
    return (cards ?? []).map((card) => card.id).join(",");
  }
  function setOnlineDraftDisplayPoolFromServer() {
    const serverPool = getOnlineSelfDraftPool();
    onlineDraftDisplayPool = serverPool ? [...serverPool] : null;
    onlineDraftPendingPool = null;
  }
  function getOnlineSelfHand() {
    return getOnlineSelfState()?.hand ?? null;
  }
  function getOnlineSelectedDraftCardId() {
    return getOnlineSelfState()?.selectedDraftCardId ?? null;
  }
  function getDraftVisualSelectedCardId() {
    return getOnlineSelectedDraftCardId() ?? draftSelectedCardId;
  }
  function getOnlinePlayer(playerId) {
    if (!playerId || !onlineClientState.roomState) return null;
    return onlineClientState.roomState.players[playerId] ?? null;
  }
  function getDisplayPlayerName() {
    const selfPlayerId = onlineClientState.playerId ?? currentPlayerId;
    const onlineSelf = getOnlinePlayer(selfPlayerId);
    return onlineSelf?.name ?? "Player";
  }
  function getCompactPhaseDayLabel() {
    return `${getCurrentPhaseLabel()} \u2022 ${getCurrentDayLabel()}`.toUpperCase();
  }
  function getOnlineSelfPublicPlayer() {
    const selfPlayerId = onlineClientState.playerId;
    if (!selfPlayerId || !onlineClientState.roomState) return null;
    return onlineClientState.roomState.players[selfPlayerId] ?? null;
  }
  function getConnectedLobbyPlayers() {
    const state = onlineClientState.roomState;
    if (!state) return [];
    return playerIds.map((playerId) => state.players[playerId]).filter((player) => player.isConnected);
  }
  function canCurrentPlayerStartRoom() {
    const state = onlineClientState.roomState;
    if (!state || state.phase !== "lobby") return false;
    if (onlineClientState.playerId !== "p1") return false;
    const connectedPlayers = getConnectedLobbyPlayers();
    return connectedPlayers.length > 0 && connectedPlayers.every((player) => player.isReady);
  }
  function renderOnlineEntryScreen() {
    const savedSession = getSavedOnlineSession();
    return `
    <main class="online-entry-screen">
      <section class="online-entry-card">
        <div class="online-entry-card__brand">
          <span>L\u1EEE KH\xC1CH B\u1EA0N C\u1EDC</span>
          <h1>Online Room</h1>
          <p>T\u1EA1o ph\xF2ng, m\u1EDDi b\u1EA1n b\xE8 b\u1EB1ng m\xE3 ph\xF2ng, r\u1ED3i b\u1EAFt \u0111\u1EA7u khi m\u1ECDi ng\u01B0\u1EDDi s\u1EB5n s\xE0ng.</p>
          <p class="online-entry-card__welcome">
            Xin ch\xE0o, <strong>${authClientState.user?.displayName ?? authClientState.user?.username ?? "Nh\xE0 L\u1EEF H\xE0nh"}</strong>
          </p>
          <button
            type="button"
            class="online-entry-card__back"
            onclick="event.stopPropagation(); window.gotoDashboard()"
          >
            \u2190 Quay l\u1EA1i trang ch\u1EE7
          </button>
        </div>

        <div class="online-entry-grid">
          <form class="online-entry-form" onsubmit="event.preventDefault(); event.stopPropagation(); window.createRoomFromLobby()">
            <h2>T\u1EA1o ph\xF2ng</h2>
            <label>
              T\xEAn c\u1EE7a b\u1EA1n
              <input id="lobby-create-name" value="${authClientState.user?.displayName ?? "An"}" maxlength="18" />
            </label>
            <button
              type="button"
              onclick="event.preventDefault(); event.stopPropagation(); window.createRoomFromLobby()"
            >
              T\u1EA1o ph\xF2ng
            </button>
          </form>

          <form class="online-entry-form" onsubmit="event.preventDefault(); event.stopPropagation(); window.joinRoomFromLobby()">
            <h2>V\xE0o ph\xF2ng</h2>
            <label>
              T\xEAn c\u1EE7a b\u1EA1n
              <input id="lobby-join-name" value="${authClientState.user?.displayName ?? "Player"}" maxlength="18" />
            </label>
            <label>
              Room code
              <input id="lobby-room-code" placeholder="ABC123" maxlength="8" />
            </label>
            <button
              type="button"
              onclick="event.preventDefault(); event.stopPropagation(); window.joinRoomFromLobby()"
            >
              Join ph\xF2ng
            </button>
            <p class="online-entry-form__note">Slot offline \u0111\xE3 c\xF3 ch\u1EE7 ch\u1EC9 c\xF3 th\u1EC3 quay l\u1EA1i b\u1EB1ng Reconnect, kh\xF4ng join l\u1EA1i b\u1EB1ng code.</p>
          </form>
        </div>

        ${savedSession ? `
              <div class="online-entry-card__resume">
                <div>
                  <strong>Phi\xEAn c\u0169</strong>
                  <span>Room ${savedSession.roomId} \u2022 ${savedSession.playerId} \u2022 ${savedSession.playerName}</span>
                </div>
                <button onclick="event.stopPropagation(); reconnectSavedRoomFromLobby()">Reconnect</button>
                <button class="online-entry-card__ghost" onclick="event.stopPropagation(); clearSavedRoomFromLobby()">X\xF3a l\u01B0u</button>
              </div>
            ` : ""}
      </section>
    </main>
  `;
  }
  function renderOnlineLobbyRoomScreen() {
    const state = onlineClientState.roomState;
    const selfPlayer = getOnlineSelfPublicPlayer();
    const isHost = onlineClientState.playerId === "p1";
    const canStart = canCurrentPlayerStartRoom();
    if (!state || state.phase !== "lobby") {
      return "";
    }
    const playersHtml = playerIds.map((playerId) => {
      const player = state.players[playerId];
      const isSelf = playerId === onlineClientState.playerId;
      const slotClass = player.isConnected ? "is-connected" : player.hasJoined ? "is-offline" : "is-empty";
      const statusText = player.isConnected ? player.isReady ? "READY" : "WAIT" : player.hasJoined ? "OFFLINE" : "-";
      const hasOccupiedSlot = player.isConnected || player.hasJoined;
      const playerDisplayName = hasOccupiedSlot ? player.name : "\u0110ang ch\u1EDD...";
      return `
        <div class="online-lobby-player ${slotClass} ${isSelf ? "is-self" : ""}">
          <div class="online-lobby-player__slot">${playerId.toUpperCase()}</div>
          <div class="online-lobby-player__info">
            <strong>${playerDisplayName}</strong>
            <span>${player.isConnected ? player.isReady ? "S\u1EB5n s\xE0ng" : "Ch\u01B0a s\u1EB5n s\xE0ng" : player.hasJoined ? "\u0110\xE3 offline \u2022 gi\u1EEF slot" : "Tr\u1ED1ng"}</span>
          </div>
          <div class="online-lobby-player__status ${player.isReady ? "is-ready" : ""} ${player.hasJoined && !player.isConnected ? "is-offline" : ""}">${statusText}</div>
        </div>
      `;
    }).join("");
    return `
    <main class="online-lobby-screen">
      <section class="online-lobby-card">
        <div class="online-lobby-card__header">
          <div>
            <span>ONLINE ROOM</span>
            <h1>${state.roomId}</h1>
            <p>B\u1EA1n l\xE0 ${onlineClientState.playerId?.toUpperCase()} \u2022 ${selfPlayer?.name ?? "Player"}</p>
          </div>

          <div class="online-lobby-card__header-actions">
            <button class="online-lobby-card__copy" onclick="event.stopPropagation(); copyRoomCodeFromLobby()">Copy code</button>
            <button class="online-lobby-card__leave" onclick="event.stopPropagation(); leaveRoomFromLobby()">Tho\xE1t ph\xF2ng</button>
          </div>
        </div>

        <div class="online-lobby-card__players">
          ${playersHtml}
        </div>

        <div class="online-lobby-card__actions">
          <button
            class="online-lobby-card__ready ${selfPlayer?.isReady ? "is-ready" : ""}"
            onclick="event.stopPropagation(); toggleReadyFromLobby()"
          >
            ${selfPlayer?.isReady ? "H\u1EE7y s\u1EB5n s\xE0ng" : "S\u1EB5n s\xE0ng"}
          </button>

          <button
            class="online-lobby-card__start"
            ${isHost && canStart ? "" : "disabled"}
            onclick="event.stopPropagation(); startOnlineGame()"
            title="${isHost ? "C\u1EA7n t\u1EA5t c\u1EA3 ng\u01B0\u1EDDi ch\u01A1i connected s\u1EB5n s\xE0ng." : "Ch\u1EC9 host P1 \u0111\u01B0\u1EE3c b\u1EAFt \u0111\u1EA7u."}"
          >
            B\u1EAFt \u0111\u1EA7u
          </button>
        </div>

        <div class="online-lobby-card__hint">
          Host l\xE0 P1. T\u1EA5t c\u1EA3 ng\u01B0\u1EDDi ch\u01A1i \u0111ang trong ph\xF2ng c\u1EA7n b\u1EA5m S\u1EB5n s\xE0ng tr\u01B0\u1EDBc khi b\u1EAFt \u0111\u1EA7u.
        </div>
      </section>
    </main>
  `;
  }
  function getOnlinePlayerBoard(playerId) {
    return getOnlinePlayer(playerId)?.board ?? null;
  }
  function getCurrentOnlinePlayerId() {
    return onlineClientState.playerId ?? currentPlayerId;
  }
  function getOnlineScoreForPlayer(playerId) {
    if (!playerId || !onlineClientState.roomState) return null;
    return onlineClientState.roomState.players[playerId]?.score ?? null;
  }
  function getOnlineSelfScore() {
    return getOnlineScoreForPlayer(onlineClientState.playerId ?? currentPlayerId);
  }
  function getKnownOnlineCardById(cardId) {
    const onlineSelf = getOnlineSelfState();
    const allKnownCards = [
      ...onlineDraftDisplayPool ?? [],
      ...onlineDraftPendingPool ?? [],
      ...onlineSelf?.draftPool ?? [],
      ...onlineSelf?.pickedDraftCards ?? [],
      ...onlineSelf?.hand ?? [],
      ...playerHand,
      ...initialDeck
    ];
    return allKnownCards.find((card) => card.id === cardId) ?? null;
  }
  function createCardFromPublicBoardCell(cell) {
    const knownCard = getKnownOnlineCardById(cell.cardId);
    if (knownCard && !cell.type) {
      return knownCard;
    }
    if (cell.type === "debt") {
      return {
        ...createDebtTokenCard({
          rowIndex: 0,
          colIndex: 0,
          amount: cell.debtAmount ?? 0,
          sourceCardName: cell.sourceCardName ?? cell.name ?? "L\xE1 \u0111\xE3 vay",
          lockedReason: cell.lockedReason
        }),
        id: cell.cardId
      };
    }
    if (cell.type === "lock") {
      return {
        ...createExhaustLockTokenCard({
          rowIndex: 0,
          colIndex: 0,
          sourceCardName: cell.sourceCardName ?? cell.name ?? "L\xE1 \u0111\xE3 vay th\u1EC3 l\u1EF1c"
        }),
        id: cell.cardId
      };
    }
    const fallbackName = cell.name ?? cell.cardId;
    const normalizedTag = cell.tag || "food";
    return {
      id: cell.cardId,
      name: fallbackName,
      shortName: fallbackName,
      city: "",
      shortCity: "",
      image: cell.image ?? images.food,
      rarity: "common",
      rarityLabel: "\u2605",
      vp: cell.vp,
      coin: cell.coin ?? 0,
      stamina: cell.stamina ?? 0,
      tag: normalizedTag,
      tagLabel: normalizedTag,
      tags: [normalizedTag.toUpperCase()],
      icon: cell.icon,
      description: "",
      bonusText: ""
    };
  }
  function convertOnlineBoardToBoardSlots(playerId) {
    const onlineBoard = getOnlinePlayerBoard(playerId);
    if (!onlineBoard) return null;
    return onlineBoard.map((row) => {
      return row.map((cell) => {
        if (!cell) return null;
        return createCardFromPublicBoardCell(cell);
      });
    });
  }
  function applyOnlineRoomStateToLocal() {
    const state = onlineClientState.roomState;
    if (!state) return;
    phaseNumber = state.phaseNumber ?? phaseNumber;
    currentDayIndex = Math.max(0, Math.min(PHASE_DAYS - 1, state.dayIndex));
    const onlineSelfPublicState = state.players[onlineClientState.playerId ?? currentPlayerId];
    if (onlineSelfPublicState) {
      accumulatedVP = onlineSelfPublicState.score;
    }
    rememberCurrentCertificatePhase();
    isDraftPhase = state.phase === "draft";
    isSimulationMode = state.phase === "simulation" || state.phase === "result" || state.phase === "gameover";
    isReplayComplete = state.phase === "result" || state.phase === "gameover";
    draftRound = state.draftRound;
    draftPickSecondsLeft = state.timer;
    remainingTurnSeconds = state.timer;
    if (isOnlineRoomActive()) {
      stopDraftTimer();
      stopTurnTimer();
      stopBotPlacementTimer();
    }
    const serverDraftPool = state.self.draftPool ?? [];
    const onlinePoolSignature = getDraftPoolSignature(serverDraftPool);
    const displayPoolSignature = getDraftPoolSignature(onlineDraftDisplayPool);
    const hasDisplayPool = onlineDraftDisplayPool !== null;
    if (isOnlineRoomActive()) {
      const enteredDraft = state.phase === "draft" && lastOnlineAnimationPhase !== "draft";
      const serverPoolChanged = state.phase === "draft" && lastOnlineAnimationPhase === "draft" && onlinePoolSignature !== lastOnlineAnimationPoolSignature;
      if (enteredDraft) {
        clearOnlineDraftAnimationTimer();
        setOnlineDraftDisplayPoolFromServer();
        shouldActivateOnlineDealAnimation = true;
        shouldActivateOnlinePassAnimation = false;
        isInitialDealInProgress = true;
        isPassingDraftCards = false;
        hasPlayedOnlinePlanningDealAfterDraft = false;
        playGameSound("deal");
        onlineDraftAnimationTimerId = window.setTimeout(() => {
          finishOnlineDraftDealVisualOnly();
        }, 1320);
      } else if (serverPoolChanged && hasDisplayPool && displayPoolSignature !== onlinePoolSignature) {
        clearOnlineDraftAnimationTimer();
        onlineDraftPendingPool = [...serverDraftPool];
        shouldActivateOnlineDealAnimation = false;
        shouldActivateOnlinePassAnimation = true;
        isInitialDealInProgress = false;
        isPassingDraftCards = true;
        onlineDraftAnimationTimerId = window.setTimeout(() => {
          if (onlineDraftPendingPool) {
            onlineDraftDisplayPool = [...onlineDraftPendingPool];
            onlineDraftPendingPool = null;
          }
          isPassingDraftCards = false;
          isInitialDealInProgress = true;
          shouldActivateOnlineDealAnimation = true;
          onlineDraftAnimationTimerId = null;
          draftSelectedCardId = state.self.selectedDraftCardId;
          rerenderGameShell();
          activateDraftDealAnimation();
          onlineDraftAnimationTimerId = window.setTimeout(() => {
            finishOnlineDraftDealVisualOnly();
          }, 1320);
        }, 1500);
      } else if (state.phase === "draft" && !hasDisplayPool) {
        setOnlineDraftDisplayPoolFromServer();
      }
      const isEnteringPlanningAfterDraft = state.phase === "planning" && lastOnlineAnimationPhase === "draft" && onlineDraftDisplayPool !== null && onlineDraftDisplayPool.length > 0 && !isOnlineFinalDraftReturnAnimating && onlineFinalDraftReturnTimerId === null;
      if (isEnteringPlanningAfterDraft) {
        clearOnlineDraftAnimationTimer();
        isOnlineFinalDraftReturnAnimating = true;
        isDraftPhase = true;
        isSimulationMode = false;
        isPassingDraftCards = true;
        isInitialDealInProgress = false;
        shouldActivateOnlinePassAnimation = true;
        shouldActivateOnlineDealAnimation = false;
        onlineFinalDraftReturnTimerId = window.setTimeout(() => {
          isOnlineFinalDraftReturnAnimating = false;
          isPassingDraftCards = false;
          onlineDraftDisplayPool = null;
          onlineDraftPendingPool = null;
          onlineFinalDraftReturnTimerId = null;
          lastOnlineRenderSignature = "";
          playOnlinePlanningHandDealAfterDraft();
        }, 1550);
      }
      if (state.phase !== "draft" && !isOnlineFinalDraftReturnAnimating) {
        clearOnlineDraftAnimationTimer();
        onlineDraftDisplayPool = null;
        onlineDraftPendingPool = null;
        shouldActivateOnlineDealAnimation = false;
        shouldActivateOnlinePassAnimation = false;
        isInitialDealInProgress = false;
        isPassingDraftCards = false;
      }
      lastOnlineAnimationPhase = state.phase;
      lastOnlineAnimationDraftRound = state.draftRound;
      lastOnlineAnimationPoolSignature = onlinePoolSignature;
    }
    const shouldPlayPlanningDealFallback = isOnlineRoomActive() && state.phase === "planning" && lastOnlineAnimationPhase === "draft" && !isOnlineFinalDraftReturnAnimating && !hasPlayedOnlinePlanningDealAfterDraft;
    if (shouldPlayPlanningDealFallback) {
      playOnlinePlanningHandDealAfterDraft();
      return;
    }
    if (state.phase === "planning" && !isOnlineFinalDraftReturnAnimating) {
      const onlineHand = getOnlineSelfHand();
      if (onlineHand) {
        playerHand = [...onlineHand];
      }
    }
    if (state.phase === "draft") {
      playerHand = [];
      draftSelectedCardId = state.self.selectedDraftCardId;
      updateDraftSelectedVisualOnly();
    }
    if (state.phase === "simulation" || state.phase === "result") {
      if (isOnlineRoomActive() && !hasStartedOnlineSimulationReplay) {
        runOnlineSimulationReplay();
        return;
      }
      if (!simulationResult) {
        simulationResult = calculateSimulationResult2();
        simulationReplayIndex = 0;
      }
    } else {
      simulationResult = null;
      simulationReplayIndex = 0;
      isReplayComplete = false;
      hasStartedOnlineSimulationReplay = false;
      hasAppliedSimulationScore = false;
    }
  }
  function getCurrentDayPlacedCards2(dayIndex = currentDayIndex) {
    return getCurrentDayPlacedCards(getBoardSlots(), dayIndex);
  }
  var initialDeck = createInitialDeck2();
  var playerIds = ["p1", "p2", "p3", "p4"];
  var currentPlayerId = "p1";
  function createEmptyPlayerBoards() {
    return {
      p1: createEmptyBoardSlots(),
      p2: createEmptyBoardSlots(),
      p3: createEmptyBoardSlots(),
      p4: createEmptyBoardSlots()
    };
  }
  function createEmptyBotPlacedDays() {
    return {
      p1: /* @__PURE__ */ new Set(),
      p2: /* @__PURE__ */ new Set(),
      p3: /* @__PURE__ */ new Set(),
      p4: /* @__PURE__ */ new Set()
    };
  }
  function getCurrentPlayerBoard() {
    if (isOnlineRoomActive()) {
      const onlineBoard = convertOnlineBoardToBoardSlots(getCurrentOnlinePlayerId());
      if (onlineBoard) {
        return onlineBoard;
      }
    }
    return playerBoards[currentPlayerId];
  }
  var phaseNumber = 1;
  var currentDayIndex = 0;
  var accumulatedVP = 0;
  var discardedResourceBonus = {
    coin: 0,
    stamina: 0
  };
  var eventResourceModifier = {
    coin: 0,
    stamina: 0
  };
  var hasAppliedSimulationScore = false;
  var dayAdvanceTimerId = null;
  var dailyDealTimerId = null;
  var deck = shuffleCards2(initialDeck);
  var playerHand = [];
  var isInitialDealInProgress = false;
  var isDraftPhase = true;
  var draftPlayers = [];
  var draftSelectedCardId = null;
  var draftPickSecondsLeft = DRAFT_PICK_SECONDS;
  var draftTimerId = null;
  var isPassingDraftCards = false;
  var draftRound = 1;
  var playerBoards = createEmptyPlayerBoards();
  var botPlacedDays = {
    p1: /* @__PURE__ */ new Set(),
    p2: /* @__PURE__ */ new Set(),
    p3: /* @__PURE__ */ new Set(),
    p4: /* @__PURE__ */ new Set()
  };
  var botPlacementTimerId = null;
  var selectedHandCardId = null;
  var draggedHandCardId = null;
  var handPointerDragState = null;
  var lastPlacedBoardPosition = null;
  var focusedHandCardId = null;
  var focusedBoardCard = null;
  var focusedBoardPosition = null;
  var holdTimer = null;
  var suppressNextClick = false;
  var isSimulationMode = false;
  var simulationResult = null;
  var remainingTurnSeconds = TURN_DURATION_SECONDS;
  var turnTimerId = null;
  var simulationReplayIndex = 0;
  var simulationReplayTimerId = null;
  var isReplayComplete = false;
  var isMidGameRankingOpen = false;
  var didMoveHandPointerDrag = false;
  var lastPointerDownCardId = null;
  function getBoardSlots() {
    return getCurrentPlayerBoard();
  }
  function getOpponentPlayerIds() {
    return playerIds.filter((playerId) => playerId !== currentPlayerId);
  }
  function getFirstEmptyBoardPosition(board, preferredColIndex = currentDayIndex) {
    for (let rowIndex = 0; rowIndex < board.length; rowIndex += 1) {
      if (board[rowIndex]?.[preferredColIndex] === null) {
        return {
          rowIndex,
          colIndex: preferredColIndex
        };
      }
    }
    for (let rowIndex = 0; rowIndex < board.length; rowIndex += 1) {
      for (let colIndex = 0; colIndex < board[rowIndex].length; colIndex += 1) {
        if (board[rowIndex][colIndex] === null) {
          return {
            rowIndex,
            colIndex
          };
        }
      }
    }
    return null;
  }
  function cloneCardForBot(card, playerId, index) {
    return {
      ...card,
      id: `${card.id}_${playerId}_${currentDayIndex}_${index}_${Date.now()}`
    };
  }
  function placeOneBotCard(playerId, card, index) {
    const board = playerBoards[playerId];
    const position = getFirstEmptyBoardPosition(board, currentDayIndex);
    if (!position) return;
    board[position.rowIndex][position.colIndex] = cloneCardForBot(card, playerId, index);
  }
  function countBotCardsInCurrentDay(playerId) {
    let count = 0;
    const board = playerBoards[playerId];
    for (let rowIndex = 0; rowIndex < board.length; rowIndex += 1) {
      if (board[rowIndex]?.[currentDayIndex] !== null) {
        count += 1;
      }
    }
    return count;
  }
  function stopBotPlacementTimer() {
    if (botPlacementTimerId !== null) {
      window.clearInterval(botPlacementTimerId);
      botPlacementTimerId = null;
    }
  }
  function placeBotCardsAfterPlayerMove(sourceCard) {
    if (isOnlineRoomActive()) return;
    const opponentIds = getOpponentPlayerIds();
    opponentIds.forEach((playerId, index) => {
      if (countBotCardsInCurrentDay(playerId) >= 3) return;
      placeOneBotCard(playerId, sourceCard, index);
    });
  }
  function getPlayerBoardUsedSlots(playerId) {
    let usedSlots = 0;
    for (const row of playerBoards[playerId]) {
      for (const card of row) {
        if (card) usedSlots += 1;
      }
    }
    return usedSlots;
  }
  function isLastPlacedBoardCell(rowIndex, colIndex) {
    return lastPlacedBoardPosition !== null && lastPlacedBoardPosition.rowIndex === rowIndex && lastPlacedBoardPosition.colIndex === colIndex;
  }
  function calculateScoreBreakdown2() {
    return calculateScoreBreakdown({
      placedCards: getCurrentDayPlacedCards2(),
      getBoardDisplayName
    });
  }
  function stopSimulationReplayTimer() {
    if (simulationReplayTimerId !== null) {
      window.clearInterval(simulationReplayTimerId);
      simulationReplayTimerId = null;
    }
  }
  function getCurrentReplayStep() {
    if (!simulationResult || simulationResult.replaySteps.length === 0) {
      return null;
    }
    return simulationResult.replaySteps[Math.min(simulationReplayIndex, simulationResult.replaySteps.length - 1)];
  }
  function isBadSimulationReplayStep(step) {
    if (!step) return false;
    const stepData = step;
    return stepData.isBadEvent === true || stepData.isNegativeEvent === true || stepData.eventType === "traffic" || stepData.eventType === "storm" || stepData.eventType === "distance";
  }
  function getSimulationEventSoundName(step) {
    if (!step?.eventType) return null;
    if (step.eventType === "promo") return "eventPromo";
    if (step.eventType === "traffic") return "eventTraffic";
    if (step.eventType === "storm") return "eventStorm";
    if (step.eventType === "distance") return "eventDistance";
    return null;
  }
  function playSimulationScanSoundForCurrentStep() {
    const step = getCurrentReplayStep();
    if (!step) return;
    const eventSoundName = getSimulationEventSoundName(step);
    playGameSound(eventSoundName ?? (isBadSimulationReplayStep(step) ? "scanBad" : "scanCell"));
  }
  function calculateSimulationResult2() {
    return calculateSimulationResult({
      boardSlots: getBoardSlots(),
      currentDayIndex,
      dayLabel: getCurrentDayLabel(),
      rows,
      getBoardDisplayName,
      getCardTagKeys,
      countCardsWithTag,
      getCurrentDayPlacedCards: getCurrentDayPlacedCards2
    });
  }
  function getCurrentScoreBreakdown() {
    if (!simulationResult) {
      return calculateScoreBreakdown2();
    }
    return {
      baseVP: simulationResult.baseVP,
      bonusVP: simulationResult.bonusVP,
      totalVP: simulationResult.finalVP,
      spentCoin: simulationResult.spentCoin,
      spentStamina: simulationResult.spentStamina + getSimulationEventStaminaPenalty(simulationResult),
      usedSlots: simulationResult.usedSlots,
      lines: simulationResult.lines
    };
  }
  function getBoardTotals() {
    const breakdown = simulationResult ? getCurrentScoreBreakdown() : calculateScoreBreakdown2();
    return {
      // Điểm chỉ cộng vào tổng sau khi replay ngày hiện tại chạy xong.
      vp: accumulatedVP,
      coin: breakdown.spentCoin,
      stamina: breakdown.spentStamina,
      usedSlots: breakdown.usedSlots
    };
  }
  function getPlayersLeft() {
    const totals = getBoardTotals();
    return playersLeftBase.map((player) => {
      if (!player.active) {
        return {
          ...player,
          usedSlots: player.id ? getPlayerBoardUsedSlots(player.id) : player.usedSlots
        };
      }
      const remaining = getRemainingResources2();
      return {
        ...player,
        score: totals.vp,
        coin: Math.max(0, remaining.coin),
        stamina: Math.max(0, remaining.stamina),
        usedSlots: totals.usedSlots
      };
    });
  }
  function getRemainingResources2() {
    if (isOnlineRoomActive()) {
      const onlineSelf = getOnlineSelfPublicPlayer();
      if (onlineSelf) {
        return {
          coin: onlineSelf.coin,
          stamina: onlineSelf.stamina
        };
      }
    }
    const remaining = getRemainingResources({
      totals: getBoardTotals(),
      startingCoin: STARTING_COIN,
      startingStamina: STARTING_STAMINA
    });
    return {
      coin: remaining.coin + discardedResourceBonus.coin + eventResourceModifier.coin,
      stamina: remaining.stamina + discardedResourceBonus.stamina + eventResourceModifier.stamina
    };
  }
  function getCardAffordability2(card) {
    return getCardAffordability({
      card,
      remaining: getRemainingResources2()
    });
  }
  function getCardAffordabilityMessage2(card) {
    return getCardAffordabilityMessage(getCardAffordability2(card));
  }
  function getTextFitClass(text, baseClass, mediumThreshold, longThreshold) {
    const len = text.trim().length;
    if (len >= longThreshold) return `${baseClass} ${baseClass}--xs`;
    if (len >= mediumThreshold) return `${baseClass} ${baseClass}--sm`;
    return baseClass;
  }
  function getHandTitleClass(name) {
    return getTextFitClass(name, "hand-card__name", 16, 23);
  }
  function getHandCityClass(city) {
    return getTextFitClass(city, "hand-card__city", 18, 28);
  }
  function getBoardTitleClass(name) {
    return getTextFitClass(name, "board-mini__name", 12, 18);
  }
  function getBoardCityClass(city) {
    return getTextFitClass(city, "board-mini__city", 12, 21);
  }
  function getBoardDisplayName(card) {
    return card.shortName?.trim() || card.name;
  }
  function getBoardDisplayCity(card) {
    return card.shortCity?.trim() || card.city;
  }
  function getBoardTokenType2(card) {
    return card?.boardTokenType ?? null;
  }
  function isBoardDebtToken(card) {
    return getBoardTokenType2(card) === "debt";
  }
  function isBoardLockToken(card) {
    return getBoardTokenType2(card) === "lock";
  }
  function canPlaceOnBoardCell(rowIndex, colIndex) {
    const cell = getBoardSlots()[rowIndex]?.[colIndex] ?? null;
    return cell === null || isBoardDebtToken(cell);
  }
  function createDebtTokenCard(params) {
    return {
      id: `debt_token_${params.rowIndex}_${params.colIndex}_${Date.now()}`,
      name: params.lockedReason ? "N\u1EE3 + Ki\u1EC7t s\u1EE9c" : "Token N\u1EE3",
      shortName: params.lockedReason ? "N\u1EE3 + Ki\u1EC7t s\u1EE9c" : "Token N\u1EE3",
      city: `Tr\u1EA3 ${params.amount} xu`,
      shortCity: `Tr\u1EA3 ${params.amount} xu`,
      image: images.food,
      rarity: "common",
      rarityLabel: "!",
      vp: 0,
      coin: 0,
      stamina: 0,
      tag: "utility",
      tagLabel: "N\u1EE3",
      tags: ["UTILITY"],
      icon: "\u{1F4B8}",
      description: `B\u1EA5m \u0111\u1EC3 tr\u1EA3 ${params.amount} xu. N\u1EBFu kh\xF4ng tr\u1EA3 tr\u01B0\u1EDBc khi h\u1EBFt ng\xE0y s\u1EBD b\u1ECB -20 VP.`,
      bonusText: "Kh\xF4ng tr\u1EA3 n\u1EE3: -20 VP",
      boardTokenType: "debt",
      debtAmount: params.amount,
      lockedReason: params.lockedReason,
      sourceCardName: params.sourceCardName
    };
  }
  function createExhaustLockTokenCard(params) {
    return {
      id: `exhaust_lock_${params.rowIndex}_${params.colIndex}_${Date.now()}`,
      name: "B\u1ECB kh\xF3a",
      shortName: "B\u1ECB kh\xF3a",
      city: "Ki\u1EC7t s\u1EE9c",
      shortCity: "Ki\u1EC7t s\u1EE9c",
      image: images.food,
      rarity: "common",
      rarityLabel: "!",
      vp: 0,
      coin: 0,
      stamina: 0,
      tag: "utility",
      tagLabel: "Kh\xF3a",
      tags: ["UTILITY"],
      icon: "\u{1F512}",
      description: `\xD4 n\xE0y b\u1ECB kh\xF3a v\xEC \u0111\xE3 vay th\u1EC3 l\u1EF1c \u1EDF ${params.sourceCardName}.`,
      bonusText: "Kh\xF4ng th\u1EC3 x\u1EBFp b\xE0i v\xE0o \xF4 n\xE0y.",
      boardTokenType: "lock",
      lockedReason: "Ki\u1EC7t s\u1EE9c",
      sourceCardName: params.sourceCardName
    };
  }
  function addLocalDebtOrExhaustToken(params) {
    const nextDayIndex = currentDayIndex + 1;
    if (nextDayIndex >= PHASE_DAYS) return;
    if (getBoardSlots()[params.rowIndex]?.[nextDayIndex] !== null) return;
    if (params.coinDebt > 0) {
      getBoardSlots()[params.rowIndex][nextDayIndex] = createDebtTokenCard({
        rowIndex: params.rowIndex,
        colIndex: nextDayIndex,
        amount: params.coinDebt,
        sourceCardName: params.card.name,
        lockedReason: params.staminaDebt > 0 ? "Ki\u1EC7t s\u1EE9c" : void 0
      });
      return;
    }
    if (params.staminaDebt > 0) {
      getBoardSlots()[params.rowIndex][nextDayIndex] = createExhaustLockTokenCard({
        rowIndex: params.rowIndex,
        colIndex: nextDayIndex,
        sourceCardName: params.card.name
      });
    }
  }
  function payLocalDebtToken(rowIndex, colIndex, card) {
    const token = card;
    const debtAmount = token.debtAmount ?? 0;
    const remaining = getRemainingResources2();
    if (debtAmount <= 0) return;
    if (remaining.coin < debtAmount) {
      alert(`Kh\xF4ng \u0111\u1EE7 xu \u0111\u1EC3 tr\u1EA3 n\u1EE3. C\u1EA7n ${debtAmount} xu.`);
      return;
    }
    eventResourceModifier = {
      ...eventResourceModifier,
      coin: eventResourceModifier.coin - debtAmount
    };
    getBoardSlots()[rowIndex][colIndex] = null;
    playGameSound("eventPromo");
    rerenderArena();
  }
  function payDebtToken(rowIndex, colIndex, card) {
    if (colIndex !== currentDayIndex) {
      focusedBoardCard = card;
      focusedBoardPosition = { rowIndex, colIndex };
      rerenderArena();
      return;
    }
    if (isOnlineRoomActive()) {
      sendPayDebt({
        rowIndex,
        colIndex
      });
      return;
    }
    payLocalDebtToken(rowIndex, colIndex, card);
  }
  function clearLocalGeneratedTokenForReturnedCard(rowIndex, colIndex, card) {
    const nextDayIndex = colIndex + 1;
    if (nextDayIndex >= PHASE_DAYS) return;
    const nextCell = getBoardSlots()[rowIndex]?.[nextDayIndex] ?? null;
    const token = nextCell;
    if (token && (token.boardTokenType === "debt" || token.boardTokenType === "lock") && token.sourceCardName === card.name) {
      getBoardSlots()[rowIndex][nextDayIndex] = null;
    }
  }
  function getFocusedTitleClass(name) {
    return getTextFitClass(name, "focused-card__name", 18, 25);
  }
  function getFocusedCityClass(city) {
    return getTextFitClass(city, "focused-card__city", 18, 28);
  }
  function getHandCardById(id) {
    if (!id) return null;
    if (isOnlineRoomActive()) {
      const onlineDraftCard = getOnlineSelfDraftPool()?.find((card) => card.id === id) ?? null;
      if (onlineDraftCard) {
        return onlineDraftCard;
      }
      const onlineHandCard = getOnlineSelfHand()?.find((card) => card.id === id) ?? null;
      if (onlineHandCard) {
        return onlineHandCard;
      }
    }
    if (isDraftPhase) {
      const draftCard = getCurrentDraftPlayer2()?.pool.find((card) => card.id === id) ?? null;
      if (draftCard) {
        return draftCard;
      }
    }
    return playerHand.find((card) => card.id === id) ?? null;
  }
  function getBoardCardByPosition2(rowIndex, colIndex) {
    return getBoardCardByPosition(getBoardSlots(), rowIndex, colIndex);
  }
  function isCardBonusActive(card) {
    const placedCards = getCurrentDayPlacedCards2();
    const tagKeys = getCardTagKeys(card);
    if (tagKeys.includes("FOOD") && countCardsWithTag(placedCards, "FOOD") >= 2) {
      return true;
    }
    if (tagKeys.includes("CULTURE") && countCardsWithTag(placedCards, "CULTURE") >= 2) {
      return true;
    }
    if (tagKeys.includes("ACTION") && countCardsWithTag(placedCards, "ACTION") >= 2) {
      return true;
    }
    return card.onPlayEffect?.has_effect === true && card.onPlayEffect.effect_type === "GAIN_VP";
  }
  function renderBoardMiniCard(card, replayStep) {
    const displayName = getBoardDisplayName(card);
    const displayCity = getBoardDisplayCity(card);
    const nameClass = getBoardTitleClass(displayName);
    const cityClass = getBoardCityClass(displayCity);
    const bonusActive = isCardBonusActive(card);
    const token = card;
    if (token.boardTokenType === "debt") {
      return `
      <article
        class="board-mini board-mini--token board-mini--debt"
        title="B\u1EA5m \u0111\u1EC3 tr\u1EA3 ${token.debtAmount ?? 0} xu"
      >
        <div class="board-mini-token__icon">\u{1F4B8}</div>
        <strong>N\u1EE3 ti\u1EC1n ${token.debtAmount ?? 0} xu</strong>
      </article>
    `;
    }
    if (token.boardTokenType === "lock") {
      return `
      <article
        class="board-mini board-mini--token board-mini--lock"
        title="\xD4 b\u1ECB kh\xF3a v\xEC ki\u1EC7t s\u1EE9c"
      >
        <div class="board-mini-token__icon">\u{1F512}</div>
        <strong>B\u1ECB kh\xF3a ki\u1EC7t s\u1EE9c</strong>
      </article>
    `;
    }
    const eventClass = replayStep?.eventType ? `board-mini--event-${replayStep.eventType}` : "";
    const eventIcon = replayStep?.eventType === "promo" ? "\u2728" : replayStep?.eventType === "traffic" ? "\u{1F6A7}" : replayStep?.eventType === "storm" ? "\u26C8\uFE0F" : replayStep?.eventType === "distance" ? "\u26A0\uFE0F" : "";
    const eventLabel = replayStep?.eventType === "promo" ? `+${replayStep.eventVpDelta ?? 0} VP Event` : replayStep?.eventType === "traffic" ? `${replayStep.eventStaminaDelta ?? 0} Th\u1EC3 l\u1EF1c` : replayStep?.eventType === "storm" ? `${replayStep.eventVpDelta ?? 0} VP Event` : replayStep?.eventType === "distance" ? "Kho\u1EA3ng c\xE1ch > 20km" : "";
    return `
    <article
      class="board-mini board-mini--${card.rarity} ${bonusActive ? "board-mini--bonus-active" : ""} ${eventClass}"
      title="${card.name} - ${card.city}${replayStep?.eventText ? ` \u2022 ${replayStep.eventText}` : ""}"
    >
      ${replayStep?.eventType ? `
            <div class="board-mini__event-pill">${eventLabel}</div>
            <div class="board-mini__event-icon">${eventIcon}</div>
            ${replayStep.eventType === "distance" ? "" : replayStep.eventText ? `<div class="board-mini__event-note">${replayStep.eventText}</div>` : ""}
          ` : ""}

      <div
        class="board-mini__image"
        style="background-image: url('${card.image}'), url('${images.food}')"
      ></div>

      <div class="board-mini__tag board-mini__tag--${card.tag}">
        ${card.tagLabel}
      </div>

      <div class="board-mini__info">
        <h3 class="${nameClass}">${displayName}</h3>
        <div class="board-mini__vp">\u2605 ${card.vp}</div>
      </div>
    </article>
  `;
  }
  function renderHandCard(card, index) {
    const isDraftSelected = isDraftPhase && card.id === getDraftVisualSelectedCardId();
    const isPlanningSelected = !isDraftPhase && card.id === selectedHandCardId;
    const isSelected = isDraftSelected || isPlanningSelected;
    const affordability = getCardAffordability2(card);
    const affordabilityMessage = affordability.canAfford ? getCardAffordabilityMessage2(card) : "Thi\u1EBFu t\xE0i nguy\xEAn: \u0111\u1EB7t l\xE1 n\xE0y s\u1EBD t\u1EA1o n\u1EE3 / ki\u1EC7t s\u1EE9c.";
    const unaffordableClass = "";
    return `
    <article
      class="hand-card hand-card--${card.rarity} hand-card--fan-${index + 1} ${isPlanningSelected ? "hand-card--selected" : ""} ${isDraftSelected ? "hand-card--draft-selected" : ""} ${unaffordableClass}"
      data-hand-card-id="${card.id}"
      style="${isSelected ? "box-shadow: 0 0 0 4px rgba(255,255,255,.95), 0 0 0 8px rgba(139,92,246,.82), 0 18px 34px rgba(75,47,25,.28);" : ""}"
      title="${affordabilityMessage}"
      onpointerdown="${isDraftPhase ? `` : `event.stopPropagation(); startHandPointerDrag(event, '${card.id}')`}"
      onclick="${isDraftPhase ? `` : `event.stopPropagation(); window['selectHandCard']('${card.id}')`}"
    >
      ${isPlanningSelected ? `<button
              class="hand-card__close"
              onclick="event.stopPropagation(); clearSelectedHandCard()"
              title="H\u1EE7y ch\u1ECDn"
            >\xD7</button>` : ""}

      <div class="hand-card__header">
        <div class="hand-card__title-block">
          <h3 class="${getHandTitleClass(card.name)}">${card.name}</h3>
          <div class="${getHandCityClass(card.city)}">\u{1F4CD} ${card.city}</div>
        </div>

        <div class="hand-card__vp">${card.vp}</div>
      </div>

      <div class="hand-card__image" style="background-image: url('${card.image}'), url('${images.food}')">
        <div class="hand-card__icons">
          <span>${card.icon}</span>
          <span>\u2605</span>
        </div>
      </div>

      <div class="hand-card__content">
        <div class="hand-card__meta-row">
          <span class="hand-card__rarity">${card.rarityLabel}</span>
          <span class="hand-card__tag">${card.tagLabel}</span>
        </div>

        <p>${card.description}</p>

        <div class="hand-card__bonus">
          ${card.bonusText}
        </div>
      </div>

      <div class="hand-card__footer">
        <div>
          <span>GOLD</span>
          <strong>${card.coin}</strong>
        </div>

        <div>
          <span>STAMINA</span>
          <strong>${card.stamina}</strong>
        </div>
      </div>
    </article>
  `;
  }
  function renderFocusedCard(card) {
    const titleClass = getFocusedTitleClass(card.name);
    const cityClass = getFocusedCityClass(card.city);
    return `
    <div class="focused-card-overlay" onclick="closeFocusedHandCard()">
      <div class="focused-card-backdrop-glow"></div>

      <article
        class="focused-card focused-card--${card.rarity}"
        onclick="event.stopPropagation()"
      >
        <button
          class="focused-card__close"
          onclick="event.stopPropagation(); closeFocusedHandCard()"
          title="\u0110\xF3ng"
        >\xD7</button>

        <div class="focused-card__header">
          <div class="focused-card__title-wrap">
            <h2 class="${titleClass}">${card.name}</h2>
            <span class="${cityClass}">\u{1F4CD} ${card.city}</span>
          </div>

          <div class="focused-card__vp">${card.vp}</div>
        </div>

        <div class="focused-card__image" style="background-image: url('${card.image}'), url('${images.food}')">
          <div class="focused-card__icons">
            <span>${card.icon}</span>
            <span>\u2605</span>
          </div>
        </div>

        <div class="focused-card__body">
          <div class="focused-card__tags">
            <span>${card.rarityLabel}</span>
            <span>${card.tagLabel}</span>
          </div>

          <p>${card.description}</p>

          <div class="focused-card__bonus">
            ${card.bonusText}
          </div>
        </div>

        <div class="focused-card__footer">
          <div>
            <span>GOLD</span>
            <strong>${card.coin}</strong>
          </div>

          <div>
            <span>STAMINA</span>
            <strong>${card.stamina}</strong>
          </div>
        </div>

        ${focusedBoardPosition ? `
              <button
                class="focused-card__return-button"
                onclick="event.stopPropagation(); returnFocusedBoardCardToHand()"
                title="R\xFAt l\xE1 n\xE0y t\u1EEB board v\u1EC1 tay"
              >
                \u21A9 R\xFAt v\u1EC1 tay
              </button>
            ` : ""}
      </article>
    </div>
  `;
  }
  function renderDraftHandTopMeta() {
    const activePlayer = getCurrentDraftPlayer2();
    const activePool = activePlayer?.pool ?? [];
    const selectedCard = getDraftSelectedCard();
    return `
    <div class="draft-hand-meta">
      <div class="draft-hand-meta__info">
        <span>V\xF2ng ${draftRound}/5</span>
        <strong>${selectedCard ? getBoardDisplayName(selectedCard) : "B\u1EA5m 1 l\xE1 \u0111\u1EC3 ch\u1ECDn"}</strong>
        <em>
          ${isInitialDealInProgress ? "\u0110ang ph\xE1t b\xE0i v\xE0o tay..." : isPassingDraftCards ? "\u0110ang chuy\u1EC1n b\xE0i c\xF2n l\u1EA1i v\xE0o l\u01B0\u1EE3t k\u1EBF ti\u1EBFp..." : selectedCard ? "\u0110\xE3 ch\u1ECDn. H\u1EBFt gi\u1EDD m\u1EDBi chuy\u1EC1n b\xE0i." : activePool.length > 0 ? "B\u1EA5m \u0111\u1EC3 ch\u1ECDn, gi\u1EEF 0.5s \u0111\u1EC3 xem l\u1EDBn." : "\u0110ang chu\u1EA9n b\u1ECB b\xE0i..."}
        </em>
      </div>

      <div class="draft-hand-meta__wait">
        <span>Ch\u1EDD h\u1EBFt gi\u1EDD</span>
      </div>
    </div>
  `;
  }
  function renderDraftHandCards() {
    const onlinePool = isOnlineRoomActive() ? getOnlineDraftDisplayPool() : null;
    const activePlayer = getCurrentDraftPlayer2();
    const activePool = onlinePool ?? activePlayer?.pool ?? [];
    if (activePool.length === 0) {
      return `<div class="draft-hand-empty">\u0110ang chu\u1EA9n b\u1ECB b\xE0i...</div>`;
    }
    return activePool.map((card, index) => renderDailyDraftCard(card, index)).join("");
  }
  function getDraftPreviewIconsForPlayer(playerId) {
    const draftIndexByPlayerId = {
      p1: 1,
      p2: 0,
      p3: 2,
      p4: 3
    };
    const draftPlayer = draftPlayers[draftIndexByPlayerId[playerId]];
    const pickedCards = draftPlayer?.picked ?? [];
    return pickedCards.map((card) => card.icon);
  }
  function shouldRenderDraftPreviewOnSideBoard(playerId) {
    return Boolean(playerId && playerId !== currentPlayerId && isDraftPhase);
  }
  function renderOnlineSideBoard(playerId) {
    const onlineBoard = getOnlinePlayerBoard(playerId);
    if (!onlineBoard) {
      return Array.from({ length: 25 }).map(() => `<div class="opponent-cell">+</div>`).join("");
    }
    const cells = [];
    for (const row of onlineBoard) {
      for (const cell of row) {
        if (!cell) {
          cells.push(`<div class="opponent-cell">+</div>`);
          continue;
        }
        cells.push(`
        <div
          class="opponent-cell opponent-cell--filled opponent-cell--${cell.tag}"
          title="${cell.cardId} \u2022 ${cell.tag} \u2022 ${cell.vp} VP"
        >
          ${cell.icon}
        </div>
      `);
      }
    }
    return cells.join("");
  }
  function renderSidePlayerBoard(playerId) {
    if (!playerId) {
      return Array.from({ length: 25 }).map(() => `<div class="opponent-cell">+</div>`).join("");
    }
    if (onlineClientState.roomState) {
      return renderOnlineSideBoard(playerId);
    }
    const board = playerBoards[playerId];
    const draftPreviewIcons = shouldRenderDraftPreviewOnSideBoard(playerId) ? getDraftPreviewIconsForPlayer(playerId) : [];
    const cells = [];
    let flatIndex = 0;
    for (const row of board) {
      for (const card of row) {
        const previewIcon = draftPreviewIcons[flatIndex] ?? "";
        if (!card) {
          cells.push(`
          <div
            class="opponent-cell ${previewIcon ? "opponent-cell--draft-preview" : ""}"
            title="${previewIcon ? "Ng\u01B0\u1EDDi ch\u01A1i n\xE0y \u0111\xE3 ch\u1ECDn 1 l\xE1 trong phase draft" : ""}"
          >
            ${previewIcon || "+"}
          </div>
        `);
          flatIndex += 1;
          continue;
        }
        cells.push(`
        <div
          class="opponent-cell opponent-cell--filled opponent-cell--${card.tag}"
          title="${card.name} \u2022 ${card.tagLabel} \u2022 ${card.vp} VP"
        >
          ${card.icon}
        </div>
      `);
        flatIndex += 1;
      }
    }
    return cells.join("");
  }
  function renderPlayer(player) {
    const onlinePlayer = getOnlinePlayer(player.id);
    const displayPlayer = onlinePlayer ? {
      ...player,
      name: onlinePlayer.name,
      score: onlinePlayer.score,
      coin: onlinePlayer.coin,
      stamina: onlinePlayer.stamina,
      usedSlots: onlinePlayer.usedSlots
    } : player;
    const connectionClass = onlinePlayer?.isConnected === false ? " side-player--offline" : "";
    return `
    <section class="side-player ${displayPlayer.active ? "side-player--active" : ""}${connectionClass}">
      <div class="side-player__top">
        <div class="side-player__identity">
          <span class="rank">#${displayPlayer.rank}</span>
          <h3>${displayPlayer.name}</h3>
        </div>

        <div class="side-player__score">
          ${displayPlayer.score}
          ${onlinePlayer?.hasJoined && onlinePlayer?.isConnected === false ? `<span class="side-player__offline-badge">OFFLINE</span>` : ""}
        </div>
      </div>

      <div class="side-player__resources">
        <span>\u{1FA99} ${displayPlayer.coin}</span>
        <span class="separator">|</span>
        <span>\u26A1 ${displayPlayer.stamina}</span>
        <span class="slot-count">${displayPlayer.usedSlots}/25</span>
      </div>

      <div class="opponent-board">
        ${renderSidePlayerBoard(displayPlayer.id)}
      </div>
    </section>
  `;
  }
  function getCurrentDraftPlayer2() {
    return getCurrentDraftPlayer(draftPlayers, getActiveDraftPlayerIndex());
  }
  function stopDraftTimer() {
    if (draftTimerId !== null) {
      window.clearInterval(draftTimerId);
      draftTimerId = null;
    }
  }
  function getDraftSelectedCard() {
    if (isOnlineRoomActive()) {
      const onlinePool = getOnlineDraftDisplayPool();
      const selectedId = getDraftVisualSelectedCardId();
      if (!onlinePool || !selectedId) return null;
      return onlinePool.find((card) => card.id === selectedId) ?? null;
    }
    const currentPlayer = getCurrentDraftPlayer2();
    if (!currentPlayer || !draftSelectedCardId) return null;
    return currentPlayer.pool.find((card) => card.id === draftSelectedCardId) ?? null;
  }
  function renderDailyDraftCard(card, index) {
    const isSelected = card.id === getDraftVisualSelectedCardId();
    return `
    <article
      class="daily-draft-card daily-draft-card--${index + 1} draft-deal-slot ${isSelected ? "daily-draft-card--selected" : ""}"
      data-draft-card-id="${card.id}"
      title="${card.name} - ${card.city}"
    >
      ${renderHandCard(card, index)}
    </article>
  `;
  }
  function updateDraftSelectedVisualOnly() {
    const selectedId = getDraftVisualSelectedCardId();
    const draftCards = Array.from(
      document.querySelectorAll("[data-draft-card-id]")
    );
    draftCards.forEach((element) => {
      const isSelected = element.dataset.draftCardId === selectedId;
      const innerCard = element.querySelector(".hand-card");
      element.classList.toggle("daily-draft-card--selected", isSelected);
      innerCard?.classList.toggle("hand-card--draft-selected", isSelected);
      if (isSelected) {
        element.style.setProperty("z-index", "99999", "important");
        element.style.setProperty("isolation", "isolate", "important");
      } else {
        element.style.removeProperty("z-index");
        element.style.removeProperty("isolation");
      }
      if (innerCard) {
        if (isSelected) {
          innerCard.style.setProperty("z-index", "99999", "important");
          innerCard.style.setProperty("position", "relative", "important");
        } else {
          innerCard.style.removeProperty("z-index");
          innerCard.style.removeProperty("position");
        }
      }
    });
    const selectedCard = getDraftSelectedCard();
    const titleElement = document.querySelector(".draft-hand-meta__info strong");
    if (titleElement) {
      titleElement.textContent = selectedCard ? getBoardDisplayName(selectedCard) : "B\u1EA5m 1 l\xE1 \u0111\u1EC3 ch\u1ECDn";
    }
    const hintElement = document.querySelector(".draft-hand-meta__info em");
    if (hintElement) {
      hintElement.textContent = selectedCard ? "\u0110\xE3 ch\u1ECDn. B\u1EA5m l\u1EA1i l\xE1 \u0111\xF3 \u0111\u1EC3 h\u1EE7y ch\u1ECDn." : "B\u1EA5m \u0111\u1EC3 ch\u1ECDn, gi\u1EEF 0.5s \u0111\u1EC3 xem l\u1EDBn.";
    }
  }
  function selectDraftCard(cardId) {
    if (!isDraftPhase || isPassingDraftCards) return;
    if (suppressNextClick) {
      suppressNextClick = false;
      if (focusedHandCardId || focusedBoardCard || focusedBoardPosition) {
        return;
      }
    }
    const nextSelectedCardId = draftSelectedCardId === cardId ? null : cardId;
    playGameSound("cardSelect");
    draftSelectedCardId = nextSelectedCardId;
    focusedHandCardId = null;
    focusedBoardCard = null;
    focusedBoardPosition = null;
    if (isOnlineRoomActive()) {
      selectOnlineDraftCard(cardId);
      updateDraftSelectedVisualOnly();
      return;
    }
    rerenderGameShell();
  }
  function selectHandCard(cardId) {
    if (isDraftPhase || isSimulationMode || isInitialDealInProgress) return;
    if (suppressNextClick) {
      suppressNextClick = false;
      return;
    }
    playGameSound("cardSelect");
    selectedHandCardId = selectedHandCardId === cardId ? null : cardId;
    draggedHandCardId = null;
    focusedHandCardId = null;
    focusedBoardCard = null;
    focusedBoardPosition = null;
    rerenderGameShell();
  }
  function clearSelectedHandCard() {
    if (isDraftPhase) return;
    selectedHandCardId = null;
    draggedHandCardId = null;
    focusedHandCardId = null;
    focusedBoardCard = null;
    focusedBoardPosition = null;
    rerenderArena();
  }
  function formatTurnTimer(seconds) {
    const safeSeconds = Math.max(0, seconds);
    const minutes = Math.floor(safeSeconds / 60);
    const remainingSeconds = safeSeconds % 60;
    const secondsText = remainingSeconds < 10 ? `0${remainingSeconds}` : `${remainingSeconds}`;
    return `${minutes}:${secondsText}`;
  }
  function stopTurnTimer() {
    if (turnTimerId !== null) {
      window.clearInterval(turnTimerId);
      turnTimerId = null;
    }
  }
  function startTurnTimer() {
    stopTurnTimer();
    if (isOnlineRoomActive()) return;
    if (isSimulationMode || isDraftPhase) return;
    turnTimerId = window.setInterval(() => {
      remainingTurnSeconds -= 1;
      if (remainingTurnSeconds <= 0) {
        remainingTurnSeconds = 0;
        stopTurnTimer();
        runSystemSimulation();
        return;
      }
      rerenderArena();
    }, 1e3);
  }
  function clearDayAdvanceTimer() {
    if (dayAdvanceTimerId !== null) {
      window.clearTimeout(dayAdvanceTimerId);
      dayAdvanceTimerId = null;
    }
  }
  function clearDailyDealTimer() {
    if (dailyDealTimerId !== null) {
      window.clearTimeout(dailyDealTimerId);
      dailyDealTimerId = null;
    }
  }
  function activateDraftDealAnimation() {
    playGameSound("deal");
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const handElement = document.querySelector(".player-hand--draft.player-hand--dealing");
        handElement?.classList.add("deal-active");
      });
    });
  }
  function ensureOnlineDraftDealAnimationStarted() {
    if (!isOnlineRoomActive() || !isDraftPhase || !isInitialDealInProgress) return;
    const handElement = document.querySelector(".player-hand--draft.player-hand--dealing");
    if (!handElement || handElement.classList.contains("deal-active")) return;
    handElement.classList.add("deal-active");
  }
  function activateDraftPassAnimation() {
    playGameSound("returnDeck");
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const handCardsElement = document.querySelector(".player-hand__cards.is-passing");
        const deckStackElement = document.querySelector(".deck-card-stack");
        if (!handCardsElement || !deckStackElement) return;
        const passingCards = Array.from(
          handCardsElement.querySelectorAll(".draft-deal-slot:not(.daily-draft-card--selected)")
        );
        const handRect = handCardsElement.getBoundingClientRect();
        const deckRect = deckStackElement.getBoundingClientRect();
        const gatherCenterX = handRect.left + handRect.width * 0.5;
        const gatherCenterY = handRect.top + handRect.height * 0.38;
        const deckInsertX = deckRect.left + deckRect.width * 0.34;
        const deckInsertY = deckRect.top + deckRect.height * 0.54;
        passingCards.forEach((card, index) => {
          const cardRect = card.getBoundingClientRect();
          const cardCenterX = cardRect.left + cardRect.width * 0.5;
          const cardCenterY = cardRect.top + cardRect.height * 0.5;
          const stackOffset = index - (passingCards.length - 1) / 2;
          const gatherX = gatherCenterX - cardCenterX + stackOffset * 5;
          const gatherY = gatherCenterY - cardCenterY + Math.abs(stackOffset) * 3;
          const deckX = deckInsertX - cardCenterX + stackOffset * 2;
          const deckY = deckInsertY - cardCenterY + stackOffset * 2;
          const arc1X = gatherX + (deckX - gatherX) * 0.34;
          const arc1Y = Math.min(gatherY, deckY) - 150 - Math.abs(stackOffset) * 7;
          const arc2X = gatherX + (deckX - gatherX) * 0.72;
          const arc2Y = Math.min(gatherY, deckY) - 185 - Math.abs(stackOffset) * 5;
          card.style.setProperty("--gather-x", `${gatherX}px`);
          card.style.setProperty("--gather-y", `${gatherY}px`);
          card.style.setProperty("--gather-r", `${stackOffset * 4}deg`);
          card.style.setProperty("--arc1-x", `${arc1X}px`);
          card.style.setProperty("--arc1-y", `${arc1Y}px`);
          card.style.setProperty("--arc2-x", `${arc2X}px`);
          card.style.setProperty("--arc2-y", `${arc2Y}px`);
          card.style.setProperty("--deck-in-x", `${deckX}px`);
          card.style.setProperty("--deck-in-y", `${deckY}px`);
          card.style.setProperty("--deck-r", `${-6 + stackOffset * 3}deg`);
        });
        deckStackElement.closest(".deck-pile-panel")?.classList.add("deck-receiving");
        handCardsElement.classList.add("pass-active");
      });
    });
  }
  function finishOnlineDraftDealVisualOnly() {
    isInitialDealInProgress = false;
    onlineDraftAnimationTimerId = null;
    const handElement = document.querySelector(".player-hand");
    handElement?.classList.remove("player-hand--dealing", "is-dealing", "deal-active");
    const handMeta = handElement?.querySelector(".player-hand__meta");
    if (handMeta) {
      handMeta.textContent = `C\xF2n ${draftPickSecondsLeft}s \u2022 b\u1EA5m 1 l\xE1 \u0111\u1EC3 ch\u1ECDn`;
    }
    const draftInfo = handElement?.querySelector(".draft-hand-meta__info em");
    if (draftInfo) {
      draftInfo.textContent = "B\u1EA5m \u0111\u1EC3 ch\u1ECDn, gi\u1EEF 0.5s \u0111\u1EC3 xem l\u1EDBn.";
    }
    updateDraftSelectedVisualOnly();
  }
  function playOnlinePlanningHandDealAfterDraft() {
    const onlineHand = getOnlineSelfHand();
    if (onlineHand) {
      playerHand = [...onlineHand];
    }
    isDraftPhase = false;
    isSimulationMode = false;
    isPassingDraftCards = false;
    isInitialDealInProgress = true;
    hasPlayedOnlinePlanningDealAfterDraft = true;
    playGameSound("deal");
    rerenderGameShell();
    lastOnlineRenderSignature = getOnlineRenderSignature();
    window.requestAnimationFrame(() => {
      const handElement = document.querySelector(".player-hand:not(.player-hand--draft)");
      handElement?.classList.add("planning-deal-active");
    });
    window.setTimeout(() => {
      isInitialDealInProgress = false;
      const handElement = document.querySelector(".player-hand");
      handElement?.classList.remove("player-hand--dealing", "is-dealing", "deal-active", "planning-deal-active");
      const handMeta = handElement?.querySelector(".player-hand__meta");
      if (handMeta) {
        handMeta.textContent = "Gi\u1EEF 0.5s \u0111\u1EC3 xem l\u1EDBn";
      }
    }, 1760);
  }
  function startNextDayOrPhase() {
    clearDayAdvanceTimer();
    clearDailyDealTimer();
    stopSimulationReplayTimer();
    stopTurnTimer();
    stopBotPlacementTimer();
    returnUnplayedHandToDeck2();
    if (currentDayIndex >= PHASE_DAYS - 1) {
      phaseNumber += 1;
      currentDayIndex = 0;
      playerBoards = createEmptyPlayerBoards();
      botPlacedDays = createEmptyBotPlacedDays();
      deck = shuffleCards2(initialDeck);
      discardedResourceBonus = {
        coin: 0,
        stamina: 0
      };
      eventResourceModifier = {
        coin: 0,
        stamina: 0
      };
    } else {
      currentDayIndex += 1;
    }
    isSimulationMode = false;
    simulationResult = null;
    simulationReplayIndex = 0;
    isReplayComplete = false;
    hasAppliedSimulationScore = false;
    remainingTurnSeconds = TURN_DURATION_SECONDS;
    selectedHandCardId = null;
    draggedHandCardId = null;
    focusedHandCardId = null;
    focusedBoardCard = null;
    focusedBoardPosition = null;
    lastPlacedBoardPosition = null;
    suppressNextClick = false;
  }
  function getSimulationEventResourceModifier(result) {
    if (!result) {
      return {
        coin: 0,
        stamina: 0
      };
    }
    return result.replaySteps.reduce(
      (sum, step) => {
        return {
          coin: sum.coin,
          stamina: sum.stamina + (step.eventStaminaDelta ?? 0)
        };
      },
      {
        coin: 0,
        stamina: 0
      }
    );
  }
  function getSimulationEventStaminaPenalty(result) {
    const modifier = getSimulationEventResourceModifier(result);
    return Math.abs(Math.min(0, modifier.stamina));
  }
  function applyDailyScoreOnce() {
    if (!simulationResult || hasAppliedSimulationScore) return;
    const eventModifier = getSimulationEventResourceModifier(simulationResult);
    accumulatedVP += simulationResult.finalVP;
    eventResourceModifier = {
      coin: eventResourceModifier.coin + eventModifier.coin,
      stamina: eventResourceModifier.stamina + eventModifier.stamina
    };
    hasAppliedSimulationScore = true;
  }
  function runSystemSimulation() {
    clearHoldTimer();
    clearCustomHandDragVisuals();
    stopBotPlacementTimer();
    selectedHandCardId = null;
    draggedHandCardId = null;
    focusedHandCardId = null;
    focusedBoardCard = null;
    focusedBoardPosition = null;
    suppressNextClick = false;
    simulationResult = calculateSimulationResult2();
    simulationReplayIndex = 0;
    isReplayComplete = false;
    isSimulationMode = true;
    playSimulationScanSoundForCurrentStep();
    stopTurnTimer();
    stopSimulationReplayTimer();
    simulationReplayTimerId = window.setInterval(() => {
      if (!simulationResult) return;
      if (simulationReplayIndex >= simulationResult.replaySteps.length - 1) {
        simulationReplayIndex = simulationResult.replaySteps.length - 1;
        isReplayComplete = true;
        applyDailyScoreOnce();
        stopSimulationReplayTimer();
        rerenderArena();
        clearDayAdvanceTimer();
        dayAdvanceTimerId = window.setTimeout(() => {
          startNextDayOrPhase();
        }, 1800);
        return;
      }
      simulationReplayIndex += 1;
      playSimulationScanSoundForCurrentStep();
      rerenderArena();
    }, 850);
    rerenderArena();
  }
  function runOnlineSimulationReplay() {
    clearHoldTimer();
    clearCustomHandDragVisuals();
    stopBotPlacementTimer();
    stopTurnTimer();
    stopSimulationReplayTimer();
    selectedHandCardId = null;
    draggedHandCardId = null;
    focusedHandCardId = null;
    focusedBoardCard = null;
    focusedBoardPosition = null;
    suppressNextClick = false;
    simulationResult = calculateSimulationResult2();
    simulationReplayIndex = 0;
    isReplayComplete = false;
    isSimulationMode = true;
    hasStartedOnlineSimulationReplay = true;
    playSimulationScanSoundForCurrentStep();
    simulationReplayTimerId = window.setInterval(() => {
      if (!simulationResult) return;
      if (simulationReplayIndex >= simulationResult.replaySteps.length - 1) {
        simulationReplayIndex = simulationResult.replaySteps.length - 1;
        isReplayComplete = true;
        stopSimulationReplayTimer();
        rerenderGameShell();
        return;
      }
      simulationReplayIndex += 1;
      playSimulationScanSoundForCurrentStep();
      rerenderGameShell();
    }, 850);
    rerenderGameShell();
  }
  function resetTurnForPrototype() {
    stopBotPlacementTimer();
    isSimulationMode = false;
    simulationResult = null;
    simulationReplayIndex = 0;
    isReplayComplete = false;
    hasAppliedSimulationScore = false;
    remainingTurnSeconds = TURN_DURATION_SECONDS;
    clearDayAdvanceTimer();
    clearDailyDealTimer();
    isInitialDealInProgress = false;
    stopSimulationReplayTimer();
    selectedHandCardId = null;
    draggedHandCardId = null;
    focusedHandCardId = null;
    focusedBoardCard = null;
    focusedBoardPosition = null;
    suppressNextClick = false;
    rerenderArena();
    startTurnTimer();
  }
  function renderScoreBreakdownPanel() {
    const breakdown = getCurrentScoreBreakdown();
    const isOnlineLobby = onlineClientState.roomState?.phase === "lobby";
    const onlineSelfScore = getOnlineSelfScore();
    const totalScoreToDisplay = onlineSelfScore ?? (simulationResult ? getStablePhaseScoreDisplay() : accumulatedVP);
    const compactPhaseDayLabel = getCompactPhaseDayLabel();
    return `
    <section class="score-breakdown score-breakdown--status" title="${compactPhaseDayLabel}">
      <div class="score-breakdown__header score-breakdown__capsule score-breakdown__capsule--score">
        <span>\u0110I\u1EC2M</span>
        <strong>${totalScoreToDisplay}</strong>
      </div>

      <div class="score-breakdown__details score-breakdown__capsule score-breakdown__capsule--phase">
        <span>PHASE</span>
        <strong>${compactPhaseDayLabel}</strong>
      </div>

      <div class="score-breakdown__item score-breakdown__capsule score-breakdown__capsule--slots">
        <span>SLOT</span>
        <strong>${breakdown.usedSlots}/5</strong>
      </div>

      ${isOnlineLobby ? `
            <div class="score-breakdown__lobby-actions">
              <button
                class="online-start-button"
                onclick="event.stopPropagation(); startOnlineGame()"
                title="B\u1EAFt \u0111\u1EA7u tr\xF2 ch\u01A1i cho to\xE0n b\u1ED9 ng\u01B0\u1EDDi ch\u01A1i trong ph\xF2ng."
              >
                \u25B6 B\u1EAFt \u0111\u1EA7u tr\xF2 ch\u01A1i
              </button>
            </div>
          ` : ""}

      ${simulationResult ? `
            <button
              class="score-breakdown__timer score-breakdown__timer--reset"
              onclick="event.stopPropagation(); resetSimulation()"
              title="Prototype: m\u1EDF kh\xF3a \u0111\u1EC3 test l\u1EA1i l\u01B0\u1EE3t"
            >
              \u21BA Test l\u1EA1i
            </button>
          ` : isDraftPhase ? `
              <div
                class="score-breakdown__timer ${draftPickSecondsLeft <= 3 ? "score-breakdown__timer--danger" : ""}"
                title="Th\u1EDDi gian ch\u1ECDn b\xE0i trong phase chia b\xE0i."
              >
                <span>DRAFT</span>
                <strong>${draftPickSecondsLeft}s</strong>
              </div>
            ` : `
              <div
                class="score-breakdown__timer ${remainingTurnSeconds <= 10 ? "score-breakdown__timer--danger" : ""}"
                title="\u0110\u1ED3ng h\u1ED3 \u0111\u1EBFm ng\u01B0\u1EE3c. H\u1EBFt gi\u1EDD h\u1EC7 th\u1ED1ng t\u1EF1 m\xF4 ph\u1ECFng."
              >
                <span>TIME</span>
                <strong>${formatTurnTimer(remainingTurnSeconds)}</strong>
              </div>
            `}
    </section>
  `;
  }
  function renderResourceOrbs() {
    if (isSimulationMode || simulationResult || isOnlineGameOver()) {
      return "";
    }
    const remaining = getRemainingResources2();
    return `
    <div class="resource-orbs" aria-label="T\xE0i nguy\xEAn hi\u1EC7n t\u1EA1i">
      <div class="resource-orb resource-orb--coin" title="Xu hi\u1EC7n c\xF3">
        <div class="resource-orb__frame">
          <div class="resource-orb__icon resource-orb__icon--coin">\u{1F4B0}</div>
          <div class="resource-orb__value">${remaining.coin}</div>
        </div>
        <div class="resource-orb__label">TI\u1EC0N</div>
      </div>

      <div class="resource-orb resource-orb--stamina" title="Th\u1EC3 l\u1EF1c hi\u1EC7n c\xF3">
        <div class="resource-orb__frame">
          <div class="resource-orb__icon resource-orb__icon--stamina">\u{1F3C3}</div>
          <div class="resource-orb__value">${remaining.stamina}</div>
        </div>
        <div class="resource-orb__label">TH\u1EC2 L\u1EF0C</div>
      </div>
    </div>
  `;
  }
  function renderFinalRankingPanel() {
    if (!isOnlineGameOver()) return "";
    const rankings = getOnlineFinalRankings();
    const selfPlayerId = onlineClientState.playerId;
    return `
    <section class="final-ranking-panel">
      <div class="final-ranking-panel__header">
        <span>K\u1EBET TH\xDAC PHASE</span>
        <h2>B\u1EA3ng x\u1EBFp h\u1EA1ng cu\u1ED1i c\xF9ng</h2>
        <p>H\u1EBFt 5 ng\xE0y. BXH s\u1EBD t\u1EF1 \u0111\xF3ng sau ${onlineClientState.roomState?.timer ?? 10}s \u0111\u1EC3 qua Phase ${phaseNumber + 1}.</p>
      </div>

      <div class="final-ranking-panel__list">
        ${rankings.map((player, index) => {
      const isSelf = player.playerId === selfPlayerId;
      return `
              <div class="final-ranking-row ${isSelf ? "final-ranking-row--self" : ""}">
                <div class="final-ranking-row__rank">#${index + 1}</div>

                <div class="final-ranking-row__name">
                  <strong>${player.name}</strong>
                  <span>${player.playerId}${player.isConnected ? "" : " \u2022 offline"}</span>
                </div>

                <div class="final-ranking-row__score">${player.score} VP</div>

                <div class="final-ranking-row__meta">
                  <span>\u{1FA99} ${player.coin}</span>
                  <span>\u26A1 ${player.stamina}</span>
                  <span>${player.usedSlots}/25</span>
                </div>
              </div>
            `;
    }).join("")}
      </div>

      ${renderTravelTimelineExportPanel("travel-export-panel--final")}

      <div class="final-ranking-panel__footer">
        ${phaseNumber >= 3 ? "\u0110\xE3 k\u1EBFt th\xFAc Phase 3. \u0110\xE2y l\xE0 k\u1EBFt qu\u1EA3 cu\u1ED1i c\u1EE7a game." : `\u0110ang chu\u1EA9n b\u1ECB chuy\u1EC3n sang Phase ${phaseNumber + 1}...`}
      </div>
    </section>
  `;
  }
  function renderTravelTimelineExportPanel(extraClass = "") {
    return `
    <div class="flow-export travel-export-panel ${extraClass}">
      <span>Xu\u1EA5t l\u1ECBch tr\xECnh</span>
      <p>Xu\u1EA5t board hi\u1EC7n t\u1EA1i th\xE0nh l\u1ECBch tr\xECnh du l\u1ECBch \u0111\u1EC3 l\u01B0u ho\u1EB7c chia s\u1EBB.</p>
      <div class="flow-export__actions">
        <button onclick="event.stopPropagation(); downloadTravelCertificateHtml()">Certificate</button>
        <button onclick="event.stopPropagation(); copyTravelTimeline()">Copy text</button>
      </div>
    </div>
  `;
  }
  function formatSignedVP(value) {
    if (value > 0) return `+${value} VP`;
    if (value < 0) return `${value} VP`;
    return "0 VP";
  }
  function getCurrentReplayPartialVP() {
    if (!simulationResult) return 0;
    return simulationResult.replaySteps.slice(0, simulationReplayIndex + 1).reduce((sum, step) => sum + step.vpDelta, 0);
  }
  function getPhaseScoreBeforeCurrentSimulation() {
    if (!simulationResult) return accumulatedVP;
    return hasAppliedSimulationScore ? accumulatedVP - simulationResult.finalVP : accumulatedVP;
  }
  function getPhaseScorePreview() {
    if (!simulationResult) return accumulatedVP;
    const baseScore = getPhaseScoreBeforeCurrentSimulation();
    const currentDayDelta = isReplayComplete ? simulationResult.finalVP : getCurrentReplayPartialVP();
    return baseScore + currentDayDelta;
  }
  function getStablePhaseScoreDisplay() {
    if (!simulationResult) return accumulatedVP;
    return isReplayComplete ? accumulatedVP : getPhaseScoreBeforeCurrentSimulation();
  }
  function renderSimulationResultPanel() {
    if (!simulationResult) return "";
    const result = simulationResult;
    const currentStep = getCurrentReplayStep();
    const totalSteps = result.replaySteps.length;
    const activeDayIndex = currentDayIndex;
    const daySummary = result.daySummaries[0];
    return `
    <section class="simulation-flowchart simulation-flowchart--single-day">
      <div class="simulation-flowchart__header">
        <div>
          <span>FLOW CHART M\xD4 PH\u1ECENG 1 NG\xC0Y</span>
          <h3>
            ${currentStep ? `${getCurrentPhaseLabel()} \u2022 ${currentStep.dayLabel} \u0111ang ch\u1EA1y qua ${currentStep.timeLabel}` : "\u0110ang chu\u1EA9n b\u1ECB m\xF4 ph\u1ECFng"}
          </h3>
        </div>

        <div class="simulation-flowchart__progress">
          <strong>${Math.min(simulationReplayIndex + 1, totalSteps)}</strong>
          <span>/ ${totalSteps}</span>
        </div>
      </div>

      <div class="simulation-flowchart__main">
        <div class="simulation-flowchart__days">
          <div class="flow-day is-active">
            <span>${daySummary?.label ?? getCurrentDayLabel()}</span>
            <strong>${daySummary?.vp ?? 0} VP</strong>
          </div>
        </div>

        <div class="simulation-flowchart__path">
          ${result.replaySteps.map((step, stepIndex) => {
      const isActive = stepIndex === simulationReplayIndex;
      const isDone = stepIndex < simulationReplayIndex;
      const isFuture = stepIndex > simulationReplayIndex;
      return `
                <div class="flow-node ${isActive ? "is-active" : ""} ${isDone ? "is-done" : ""} ${isFuture ? "is-future" : ""} ${step.isEmpty ? "is-empty" : ""} ${step.eventType ? `flow-node--event-${step.eventType}` : ""}">
                  <div class="flow-node__time">${step.timeLabel}</div>

                  <div class="flow-node__card">
                    <h4>${step.title}</h4>
                    <p>${step.subtitle}</p>

                    <div class="flow-node__meta">
                      <span class="${step.vpDelta >= 0 ? "is-positive" : "is-negative"}">
                        ${step.vpDelta >= 0 ? "+" : ""}${step.vpDelta} VP
                      </span>
                      <span>${step.coinDelta} Xu</span>
                      <span>${step.staminaDelta} L\u1EF1c</span>
                    </div>

                    ${step.eventText ? `<div class="flow-node__event-badge">${step.eventText}</div>` : ""}

                    ${step.comboText ? `<div class="flow-node__badge">Combo</div>` : ""}
                  </div>
                </div>
              `;
    }).join("")}
        </div>

        <div class="simulation-flowchart__side">
          <div class="flow-current">
            <span>B\u01B0\u1EDBc hi\u1EC7n t\u1EA1i</span>
            <strong>${currentStep ? `${currentStep.dayLabel} \u2022 ${currentStep.timeLabel}` : "-"}</strong>
            <p>${currentStep ? currentStep.title : "\u0110ang chu\u1EA9n b\u1ECB..."}</p>
          </div>

          <div class="flow-total">
            <span>\u0110i\u1EC3m ng\xE0y</span>
            <strong>
              ${isReplayComplete ? formatSignedVP(result.finalVP) : formatSignedVP(result.replaySteps.slice(0, simulationReplayIndex + 1).reduce((sum, step) => sum + step.vpDelta, 0))}
            </strong>
          </div>

          <div class="flow-total flow-total--phase">
            <span>T\u1ED5ng phase</span>
            <strong>${getStablePhaseScoreDisplay()} VP</strong>
          </div>

          ${isReplayComplete ? `
                <div class="flow-final">
                  <span>\u0110\xE3 c\u1EADp nh\u1EADt \u0111i\u1EC3m</span>
                  <strong>${getPhaseScoreBeforeCurrentSimulation()} \u2192 ${getPhaseScorePreview()} VP</strong>
                  <p>\u0110i\u1EC3m ng\xE0y: ${formatSignedVP(result.finalVP)}. N\u1EBFu \xE2m, t\u1ED5ng phase \u0111\xE3 b\u1ECB tr\u1EEB tr\u1EF1c ti\u1EBFp.</p>
                </div>

${renderTravelTimelineExportPanel()}
              ` : ""}
        </div>
      </div>
    </section>
  `;
  }
  function getReplayStepForBoardCell(rowIndex, colIndex) {
    if (!simulationResult) return null;
    const stepIndex = simulationResult.replaySteps.findIndex(
      (step) => step.rowIndex === rowIndex && step.dayIndex === colIndex
    );
    if (stepIndex < 0 || stepIndex > simulationReplayIndex) {
      return null;
    }
    return simulationResult.replaySteps[stepIndex] ?? null;
  }
  function getBoardCellReplayClass(rowIndex, colIndex) {
    if (!simulationResult || colIndex !== currentDayIndex) return "";
    const currentStep = getCurrentReplayStep();
    const isCurrent = currentStep?.rowIndex === rowIndex && currentStep?.dayIndex === colIndex;
    const stepIndex = simulationResult.replaySteps.findIndex(
      (step2) => step2.rowIndex === rowIndex && step2.dayIndex === colIndex
    );
    const step = stepIndex >= 0 ? simulationResult.replaySteps[stepIndex] : null;
    const isProcessed = stepIndex >= 0 && stepIndex < simulationReplayIndex;
    const eventClass = step?.eventType && stepIndex <= simulationReplayIndex ? `board-cell--event-${step.eventType}` : "";
    if (isCurrent) return `board-cell--replay-current ${eventClass}`.trim();
    if (isProcessed) return `board-cell--replay-done ${eventClass}`.trim();
    return "board-cell--replay-pending";
  }
  function renderDeckPilePanel() {
    const deckCount = isOnlineRoomActive() ? 0 : deck.length;
    const handCount = (isOnlineRoomActive() ? getOnlineSelfHand() : null)?.length ?? playerHand.length;
    return `
    <section
      class="deck-pile-panel"
      data-discard-drop-zone="true"
      title="K\xE9o th\u1EA3 l\xE1 b\xE0i tr\xEAn tay v\xE0o \u0111\xE2y \u0111\u1EC3 discard v\xE0 nh\u1EADn l\u1EA1i Xu/Th\u1EC3 l\u1EF1c b\u1EB1ng chi ph\xED c\u1EE7a l\xE1."
    >
      <div class="deck-pile-panel__top">
        <div>
          <span>DECK</span>
          <h3>B\u1ED9 b\xE0i h\xE0nh tr\xECnh</h3>
        </div>

        <strong>${deckCount}</strong>
      </div>

      <div class="deck-pile-panel__visual">
        <div class="deck-card-stack">
          <div class="deck-card-stack__card deck-card-stack__card--layer-3"></div>
          <div class="deck-card-stack__card deck-card-stack__card--layer-2"></div>
          <div class="deck-card-stack__card deck-card-stack__card--layer-1"></div>

          <div class="deck-card-stack__card deck-card-stack__card--back">
            <div class="deck-card-stack__back-frame">
              <div class="deck-card-stack__corner deck-card-stack__corner--tl">\u2726</div>
              <div class="deck-card-stack__corner deck-card-stack__corner--tr">\u2726</div>
              <div class="deck-card-stack__corner deck-card-stack__corner--bl">\u2726</div>
              <div class="deck-card-stack__corner deck-card-stack__corner--br">\u2726</div>

              <div class="deck-card-stack__crest">
                <div class="deck-card-stack__crest-ring"></div>
                <div class="deck-card-stack__crest-core">\u{1F9ED}</div>
              </div>

              <div class="deck-card-stack__brand">
                <span class="deck-card-stack__brand-top">L\u1EEE KH\xC1CH</span>
                <strong class="deck-card-stack__brand-main">B\xC0N C\u1EDC</strong>
                <em class="deck-card-stack__brand-sub">TRAVEL DECK</em>
              </div>

              <div class="deck-card-stack__route">
                <span></span>
                <span></span>
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="deck-pile-panel__info">
        <div>
          <span>Tr\xEAn tay</span>
          <strong>${handCount}</strong>
        </div>

        <div>
          <span>\u0110\xE3 x\u1EBFp ng\xE0y</span>
          <strong>${getCurrentDayPlacedCards2().length}</strong>
        </div>
      </div>

      <p>K\xE9o l\xE1 b\xE0i tr\xEAn tay v\xE0o deck \u0111\u1EC3 discard, nh\u1EADn l\u1EA1i Xu v\xE0 Th\u1EC3 l\u1EF1c b\u1EB1ng chi ph\xED c\u1EE7a l\xE1.</p>
    </section>
  `;
  }
  function renderMainArena() {
    const focusedCard = getHandCardById(focusedHandCardId) ?? focusedBoardCard;
    return `
    <main class="arena ${isOnlineGameOver() ? "arena--gameover" : ""}">
      <div class="arena__top arena__top--with-score">
        <div class="arena__title-block">
          <div class="blue-line"></div>

          <div>
            <h1>${getDisplayPlayerName()}</h1>
          </div>
        </div>

        ${renderScoreBreakdownPanel()}
      </div>

      ${renderResourceOrbs()}

      <div class="arena__main">
        <div class="board-block">
          <div class="days-header">
            ${days.map((day, dayIndex) => `<div class="day-pill ${dayIndex === currentDayIndex ? "day-pill--current" : ""} ${dayIndex < currentDayIndex ? "day-pill--done" : ""}">NG\xC0Y ${day}</div>`).join("")}
          </div>

          <section class="board-grid">
            ${rows.map((row, rowIndex) => {
      return `
                  <div class="time-label">${row}</div>

                  ${days.map((_, colIndex) => {
        const card = getBoardCardByPosition2(rowIndex, colIndex);
        const isCurrentDayColumn = colIndex === currentDayIndex;
        const isPlaceable = !isDraftPhase && !isSimulationMode && !isInitialDealInProgress && isCurrentDayColumn && selectedHandCardId !== null && card === null;
        if (!card) {
          return `
                          <div
                            class="board-cell board-cell--empty ${getBoardCellReplayClass(rowIndex, colIndex)} ${isSimulationMode ? "board-cell--locked-mode" : ""} ${!isCurrentDayColumn && !isSimulationMode ? "board-cell--not-current-day" : ""} ${isPlaceable ? "board-cell--placeable" : ""}"
                            data-board-drop-cell="true"
                            data-row-index="${rowIndex}"
                            data-col-index="${colIndex}"
                            onclick="event.stopPropagation(); handleBoardCellClick(${rowIndex}, ${colIndex})"
                            title="${isCurrentDayColumn ? isPlaceable ? "Th\u1EA3 l\xE1 \u0111ang k\xE9o v\xE0o \xF4 ng\xE0y hi\u1EC7n t\u1EA1i" : "Ch\u1EC9 x\u1EBFp b\xE0i cho ng\xE0y hi\u1EC7n t\u1EA1i" : "Kh\xF4ng ph\u1EA3i ng\xE0y hi\u1EC7n t\u1EA1i"}"
                          >
                            <span class="empty-plus">+</span>
                          </div>
                        `;
        }
        return `
                        <div
                          class="board-cell board-cell--occupied board-cell--clickable ${getBoardCellReplayClass(rowIndex, colIndex)} ${isLastPlacedBoardCell(rowIndex, colIndex) ? "board-cell--just-placed" : ""}"
                          data-board-drop-cell="true"
                          data-row-index="${rowIndex}"
                          data-col-index="${colIndex}"
                          onclick="event.stopPropagation(); handleBoardCellClick(${rowIndex}, ${colIndex})"
                          title="\xD4 \u0111\xE3 c\xF3 b\xE0i - b\u1EA5m \u0111\u1EC3 xem l\u1EDBn"
                        >
                          ${renderBoardMiniCard(card, getReplayStepForBoardCell(rowIndex, colIndex))}
                        </div>
                      `;
      }).join("")}
                `;
    }).join("")}
          </section>
        </div>

        ${isOnlineGameOver() ? renderFinalRankingPanel() : isDraftPhase ? "" : renderSimulationResultPanel()}

        ${isSimulationMode ? "" : `
              <section
          class="player-hand ${isInitialDealInProgress ? "player-hand--dealing is-dealing" : ""} ${isDraftPhase ? "player-hand--draft" : ""}"
          onclick="${isDraftPhase ? "" : "clearSelectedHandCard()"}"
        >
          <div class="player-hand__top">
            <div class="player-hand__title">
              <span class="hand-badge">${isDraftPhase ? "DRAFT" : "HAND"}</span>
              <h2>
                ${isDraftPhase ? `Ch\u1ECDn b\xE0i ng\xE0y ${days[currentDayIndex]}` : `B\xE0i ng\xE0y ${days[currentDayIndex]}`}
              </h2>
            </div>

            <div class="player-hand__meta ${isDraftPhase && draftPickSecondsLeft <= 3 ? "player-hand__meta--danger" : ""}">
              ${isDraftPhase ? isInitialDealInProgress ? "\u0110ang ph\xE1t b\xE0i..." : `C\xF2n ${draftPickSecondsLeft}s \u2022 ${isPassingDraftCards ? "\u0110ang chuy\u1EC1n b\xE0i..." : "b\u1EA5m 1 l\xE1 \u0111\u1EC3 ch\u1ECDn"}` : isInitialDealInProgress ? "\u0110ang chia b\xE0i..." : "Gi\u1EEF 0.5s \u0111\u1EC3 xem l\u1EDBn"}
            </div>
          </div>

          ${isDraftPhase ? renderDraftHandTopMeta() : ""}

          <div class="player-hand__cards ${isDraftPhase && isPassingDraftCards ? "is-passing" : ""}">
            ${isDraftPhase ? renderDraftHandCards() : playerHand.map((card, index) => renderHandCard(card, index)).join("")}
          </div>
        </section>
            `}
      </div>

      ${focusedCard ? renderFocusedCard(focusedCard) : ""}
    </main>
  `;
  }
  function clearHoldTimer() {
    if (holdTimer !== null) {
      window.clearTimeout(holdTimer);
      holdTimer = null;
    }
  }
  function rerenderArena() {
    const arena = document.querySelector(".arena");
    if (!arena) return;
    arena.outerHTML = renderMainArena();
  }
  function placeHandCardOnBoard(cardId, rowIndex, colIndex) {
    if (isSimulationMode || isInitialDealInProgress) return;
    if (colIndex !== currentDayIndex) return;
    if (!canPlaceOnBoardCell(rowIndex, colIndex)) return;
    const handIndex = playerHand.findIndex((card) => card.id === cardId);
    if (handIndex === -1) return;
    const selectedCard = playerHand[handIndex];
    if (isOnlineRoomActive()) {
      playGameSound("cardPlace");
      sendPlaceCard({
        cardId: selectedCard.id,
        rowIndex,
        colIndex,
        tag: selectedCard.tag,
        icon: selectedCard.icon,
        vp: selectedCard.vp,
        coin: selectedCard.coin,
        stamina: selectedCard.stamina,
        name: selectedCard.name
      });
      selectedHandCardId = null;
      draggedHandCardId = null;
      focusedHandCardId = null;
      focusedBoardCard = null;
      focusedBoardPosition = null;
      suppressNextClick = false;
      return;
    }
    const remainingBeforePlace = getRemainingResources2();
    const coinDebt = Math.max(0, selectedCard.coin - remainingBeforePlace.coin);
    const staminaDebt = Math.max(0, selectedCard.stamina - remainingBeforePlace.stamina);
    playGameSound("cardPlace");
    playerHand.splice(handIndex, 1);
    getBoardSlots()[rowIndex][colIndex] = selectedCard;
    addLocalDebtOrExhaustToken({
      rowIndex,
      card: selectedCard,
      coinDebt,
      staminaDebt
    });
    sendPlaceCard({
      cardId: selectedCard.id,
      rowIndex,
      colIndex,
      tag: selectedCard.tag,
      icon: selectedCard.icon,
      vp: selectedCard.vp,
      coin: selectedCard.coin,
      stamina: selectedCard.stamina,
      image: selectedCard.image,
      name: selectedCard.name
    });
    placeBotCardsAfterPlayerMove(selectedCard);
    selectedHandCardId = null;
    draggedHandCardId = null;
    focusedHandCardId = null;
    focusedBoardCard = null;
    focusedBoardPosition = null;
    suppressNextClick = false;
    lastPlacedBoardPosition = { rowIndex, colIndex };
    rerenderArena();
    window.setTimeout(() => {
      if (lastPlacedBoardPosition?.rowIndex === rowIndex && lastPlacedBoardPosition?.colIndex === colIndex) {
        lastPlacedBoardPosition = null;
        rerenderArena();
      }
    }, 420);
  }
  function placeSelectedHandCard(rowIndex, colIndex) {
    if (!selectedHandCardId) return;
    placeHandCardOnBoard(selectedHandCardId, rowIndex, colIndex);
  }
  function returnFocusedBoardCardToHand() {
    if (isSimulationMode) return;
    if (!focusedBoardPosition) return;
    const { rowIndex, colIndex } = focusedBoardPosition;
    if (colIndex !== currentDayIndex) return;
    const card = getBoardSlots()[rowIndex]?.[colIndex];
    if (!card || isBoardDebtToken(card) || isBoardLockToken(card)) return;
    if (isOnlineRoomActive()) {
      sendReturnBoardCard({
        rowIndex,
        colIndex
      });
      focusedHandCardId = null;
      focusedBoardCard = null;
      focusedBoardPosition = null;
      lastPlacedBoardPosition = null;
      selectedHandCardId = null;
      suppressNextClick = false;
      return;
    }
    getBoardSlots()[rowIndex][colIndex] = null;
    clearLocalGeneratedTokenForReturnedCard(rowIndex, colIndex, card);
    playerHand.unshift(card);
    while (playerHand.length > HAND_SIZE) {
      const overflowCard = playerHand.pop();
      if (overflowCard) {
        deck.unshift(overflowCard);
      }
    }
    focusedHandCardId = null;
    focusedBoardCard = null;
    focusedBoardPosition = null;
    lastPlacedBoardPosition = null;
    selectedHandCardId = null;
    suppressNextClick = false;
    rerenderArena();
  }
  function beginHandCardVisualDrag(event) {
    if (!handPointerDragState || handPointerDragState.isDragging) return;
    clearHoldTimer();
    focusedHandCardId = null;
    focusedBoardCard = null;
    focusedBoardPosition = null;
    suppressNextClick = false;
    const { source } = handPointerDragState;
    const rect = source.getBoundingClientRect();
    const clone = source.cloneNode(true);
    clone.classList.add("hand-card--drag-clone");
    clone.classList.remove("hand-card--selected");
    clone.style.width = `${rect.width}px`;
    clone.style.height = `${rect.height}px`;
    clone.style.left = `${rect.left}px`;
    clone.style.top = `${rect.top}px`;
    clone.style.transform = "none";
    clone.style.pointerEvents = "none";
    document.body.appendChild(clone);
    source.classList.add("hand-card--drag-source-hidden");
    handPointerDragState.clone = clone;
    handPointerDragState.offsetX = event.clientX - rect.left;
    handPointerDragState.offsetY = event.clientY - rect.top;
    handPointerDragState.isDragging = true;
    didMoveHandPointerDrag = true;
    draggedHandCardId = handPointerDragState.id;
    selectedHandCardId = handPointerDragState.id;
    updateHandCardDragPosition(event);
  }
  function updateHandCardDragPosition(event) {
    if (!handPointerDragState?.clone) return;
    handPointerDragState.clone.style.left = `${event.clientX - handPointerDragState.offsetX}px`;
    handPointerDragState.clone.style.top = `${event.clientY - handPointerDragState.offsetY}px`;
  }
  function getDropCellFromPointer(event) {
    const element = document.elementFromPoint(event.clientX, event.clientY);
    return element?.closest("[data-board-drop-cell='true']");
  }
  function getDeckDiscardTargetFromPointer(event) {
    const element = document.elementFromPoint(event.clientX, event.clientY);
    return element?.closest("[data-discard-drop-zone='true']");
  }
  function clearDeckDiscardHoverClass() {
    document.querySelectorAll(".deck-pile-panel--discard-hover").forEach((element) => {
      element.classList.remove("deck-pile-panel--discard-hover");
      delete element.dataset.discardCoin;
      delete element.dataset.discardStamina;
    });
  }
  function canDiscardHandCard() {
    return !isDraftPhase && !isSimulationMode && !isInitialDealInProgress;
  }
  function discardHandCardToDeck(cardId) {
    if (!canDiscardHandCard()) return;
    const handIndex = playerHand.findIndex((card) => card.id === cardId);
    if (handIndex === -1) return;
    const selectedCard = playerHand[handIndex];
    playGameSound("returnDeck");
    if (isOnlineRoomActive()) {
      const state = onlineClientState.roomState;
      const selfPlayerId = onlineClientState.playerId;
      if (state && selfPlayerId) {
        const onlineHandIndex = state.self.hand.findIndex((card) => card.id === selectedCard.id);
        if (onlineHandIndex >= 0) {
          state.self.hand.splice(onlineHandIndex, 1);
        }
        const publicSelf = state.players[selfPlayerId];
        if (publicSelf) {
          publicSelf.coin += selectedCard.coin;
          publicSelf.stamina += selectedCard.stamina;
        }
        playerHand = [...state.self.hand];
      }
      sendDiscardCard({
        cardId: selectedCard.id,
        coin: selectedCard.coin,
        stamina: selectedCard.stamina,
        name: selectedCard.name
      });
      selectedHandCardId = null;
      draggedHandCardId = null;
      focusedHandCardId = null;
      focusedBoardCard = null;
      focusedBoardPosition = null;
      suppressNextClick = false;
      rerenderGameShell();
      return;
    }
    playerHand.splice(handIndex, 1);
    discardedResourceBonus = {
      coin: discardedResourceBonus.coin + selectedCard.coin,
      stamina: discardedResourceBonus.stamina + selectedCard.stamina
    };
    selectedHandCardId = null;
    draggedHandCardId = null;
    focusedHandCardId = null;
    focusedBoardCard = null;
    focusedBoardPosition = null;
    suppressNextClick = false;
    rerenderArena();
  }
  function clearCustomHandDragVisuals() {
    clearBoardDragHoverClass();
    clearDeckDiscardHoverClass();
    if (handPointerDragState?.source) {
      handPointerDragState.source.classList.remove("hand-card--drag-source-hidden");
    }
    handPointerDragState?.clone?.remove();
    handPointerDragState = null;
    draggedHandCardId = null;
  }
  function handleHandPointerMove(event) {
    if (!handPointerDragState) return;
    const distanceX = event.clientX - handPointerDragState.startX;
    const distanceY = event.clientY - handPointerDragState.startY;
    const distance = Math.hypot(distanceX, distanceY);
    if (!handPointerDragState.isDragging && distance >= 8) {
      clearHoldTimer();
      beginHandCardVisualDrag(event);
    }
    if (!handPointerDragState?.isDragging) return;
    event.preventDefault();
    updateHandCardDragPosition(event);
    clearBoardDragHoverClass();
    clearDeckDiscardHoverClass();
    const discardTarget = getDeckDiscardTargetFromPointer(event);
    if (discardTarget && canDiscardHandCard()) {
      const draggedDiscardCard = getHandCardById(draggedHandCardId);
      discardTarget.classList.add("deck-pile-panel--discard-hover");
      discardTarget.dataset.discardCoin = String(draggedDiscardCard?.coin ?? 0);
      discardTarget.dataset.discardStamina = String(draggedDiscardCard?.stamina ?? 0);
      return;
    }
    const dropCell = getDropCellFromPointer(event);
    if (!dropCell) return;
    const rowIndex = Number(dropCell.dataset.rowIndex);
    const colIndex = Number(dropCell.dataset.colIndex);
    const draggedCard = getHandCardById(draggedHandCardId);
    if (Number.isInteger(rowIndex) && Number.isInteger(colIndex) && canPlaceOnBoardCell(rowIndex, colIndex) && draggedCard) {
      dropCell.classList.add("board-cell--drag-hover");
    } else {
      dropCell.classList.add("board-cell--drag-invalid");
    }
  }
  function handleHandPointerUp(event) {
    document.removeEventListener("pointermove", handleHandPointerMove);
    document.removeEventListener("pointerup", handleHandPointerUp);
    document.removeEventListener("pointercancel", handleHandPointerCancel);
    const dragState = handPointerDragState;
    const wasDragging = dragState?.isDragging === true;
    clearHoldTimer();
    if (!dragState) return;
    if (wasDragging) {
      const dropCell = getDropCellFromPointer(event);
      const discardTarget = getDeckDiscardTargetFromPointer(event);
      const rowIndex = Number(dropCell?.dataset.rowIndex);
      const colIndex = Number(dropCell?.dataset.colIndex);
      const cardId = dragState.id;
      clearCustomHandDragVisuals();
      suppressNextClick = true;
      window.setTimeout(() => {
        suppressNextClick = false;
      }, 0);
      const draggedCard = getHandCardById(cardId);
      if (discardTarget && draggedCard && canDiscardHandCard()) {
        discardHandCardToDeck(cardId);
        return;
      }
      if (dropCell && Number.isInteger(rowIndex) && Number.isInteger(colIndex) && getBoardSlots()[rowIndex]?.[colIndex] === null && draggedCard) {
        placeHandCardOnBoard(cardId, rowIndex, colIndex);
        return;
      }
      if (dropCell && Number.isInteger(rowIndex) && Number.isInteger(colIndex)) {
        triggerResourceRejectedFeedback(rowIndex, colIndex);
      } else {
        triggerResourceRejectedFeedback();
      }
      selectedHandCardId = null;
      rerenderArena();
      return;
    }
    clearCustomHandDragVisuals();
  }
  function handleHandPointerCancel() {
    document.removeEventListener("pointermove", handleHandPointerMove);
    document.removeEventListener("pointerup", handleHandPointerUp);
    document.removeEventListener("pointercancel", handleHandPointerCancel);
    clearHoldTimer();
    clearCustomHandDragVisuals();
    selectedHandCardId = null;
    suppressNextClick = false;
    rerenderArena();
  }
  function triggerResourceRejectedFeedback(rowIndex, colIndex) {
    playGameSound("reject");
    const target = rowIndex !== void 0 && colIndex !== void 0 ? document.querySelector(`[data-row-index="${rowIndex}"][data-col-index="${colIndex}"]`) : document.querySelector(".arena");
    target?.classList.add("resource-rejected-feedback");
    window.setTimeout(() => {
      target?.classList.remove("resource-rejected-feedback");
    }, 380);
  }
  function getDraggedCardIdFromEvent(event) {
    const fromDataTransfer = event.dataTransfer?.getData("text/plain");
    return fromDataTransfer || draggedHandCardId;
  }
  function clearBoardDragHoverClass() {
    document.querySelectorAll(".board-cell--drag-hover, .board-cell--drag-invalid").forEach((element) => {
      element.classList.remove("board-cell--drag-hover");
      element.classList.remove("board-cell--drag-invalid");
    });
  }
  window.startDragHandCard = (event, id) => {
    clearHoldTimer();
    draggedHandCardId = id;
    selectedHandCardId = id;
    focusedHandCardId = null;
    focusedBoardCard = null;
    focusedBoardPosition = null;
    suppressNextClick = true;
    event.dataTransfer?.setData("text/plain", id);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
    }
  };
  window.endDragHandCard = () => {
    clearHoldTimer();
    clearBoardDragHoverClass();
    draggedHandCardId = null;
    window.setTimeout(() => {
      suppressNextClick = false;
    }, 0);
  };
  window.handleBoardCellDragOver = (event, rowIndex, colIndex) => {
    if (!draggedHandCardId) return;
    if (getBoardSlots()[rowIndex][colIndex] !== null) return;
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
    const target = event.currentTarget;
    target?.classList.add("board-cell--drag-hover");
  };
  window.handleBoardCellDragLeave = (event) => {
    const target = event.currentTarget;
    target?.classList.remove("board-cell--drag-hover");
  };
  window.dropHandCardOnBoard = (event, rowIndex, colIndex) => {
    clearHoldTimer();
    clearBoardDragHoverClass();
    const cardId = getDraggedCardIdFromEvent(event);
    draggedHandCardId = null;
    if (!cardId) return;
    const card = getHandCardById(cardId);
    if (!canPlaceOnBoardCell(rowIndex, colIndex) || !card) {
      triggerResourceRejectedFeedback(rowIndex, colIndex);
      return;
    }
    placeHandCardOnBoard(cardId, rowIndex, colIndex);
  };
  window.startHandPointerDrag = (event, id) => {
    if (isInitialDealInProgress) return;
    if (isSimulationMode) return;
    if (event.button !== 0) return;
    didMoveHandPointerDrag = false;
    lastPointerDownCardId = id;
    const card = getHandCardById(id);
    if (!card) return;
    clearCustomHandDragVisuals();
    const source = event.currentTarget;
    if (!source) return;
    handPointerDragState = {
      id,
      source,
      clone: null,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: 0,
      offsetY: 0,
      isDragging: false
    };
    document.addEventListener("pointermove", handleHandPointerMove);
    document.addEventListener("pointerup", handleHandPointerUp);
    document.addEventListener("pointercancel", handleHandPointerCancel);
  };
  window.selectDraftCard = selectDraftCard;
  window.confirmDraftPick = () => {
  };
  window.startHoldHandCard = (id) => {
    if (isPassingDraftCards || isInitialDealInProgress) return;
    clearHoldTimer();
    holdTimer = window.setTimeout(() => {
      focusedHandCardId = id;
      focusedBoardCard = null;
      focusedBoardPosition = null;
      suppressNextClick = true;
      clearHoldTimer();
      rerenderArena();
    }, 500);
  };
  window.cancelHoldHandCard = () => {
    clearHoldTimer();
  };
  window.clearSelectedHandCard = () => {
    clearHoldTimer();
    if (selectedHandCardId === null) return;
    selectedHandCardId = null;
    rerenderArena();
  };
  window.handleBoardCellClick = (rowIndex, colIndex) => {
    clearHoldTimer();
    const card = getBoardCardByPosition2(rowIndex, colIndex);
    if (card) {
      if (isBoardDebtToken(card)) {
        if (!isDraftPhase && !isInitialDealInProgress && colIndex === currentDayIndex && selectedHandCardId) {
          placeSelectedHandCard(rowIndex, colIndex);
          return;
        }
        payDebtToken(rowIndex, colIndex, card);
        return;
      }
      clearCustomHandDragVisuals();
      focusedHandCardId = null;
      focusedBoardCard = card;
      focusedBoardPosition = { rowIndex, colIndex };
      selectedHandCardId = null;
      suppressNextClick = false;
      rerenderArena();
      return;
    }
    if (!isDraftPhase && !isInitialDealInProgress && colIndex === currentDayIndex) {
      placeSelectedHandCard(rowIndex, colIndex);
    }
  };
  window.focusBoardCard = (rowIndex, colIndex) => {
    const card = getBoardCardByPosition2(rowIndex, colIndex);
    if (!card) return;
    focusedHandCardId = null;
    focusedBoardCard = card;
    focusedBoardPosition = { rowIndex, colIndex };
    selectedHandCardId = null;
    suppressNextClick = false;
    rerenderArena();
  };
  window.runSimulation = () => {
    runSystemSimulation();
  };
  window.resetSimulation = () => {
    resetTurnForPrototype();
  };
  window.returnFocusedBoardCardToHand = () => {
    returnFocusedBoardCardToHand();
  };
  window.closeFocusedHandCard = () => {
    clearHoldTimer();
    focusedHandCardId = null;
    focusedBoardCard = null;
    focusedBoardPosition = null;
    draggedHandCardId = null;
    suppressNextClick = false;
    rerenderArena();
  };
  function getStaticPlayerById(playerId) {
    const fallbackRankByPlayerId = {
      p1: 1,
      p2: 3,
      p3: 3,
      p4: 3
    };
    return [...playersLeftBase, ...playersRight].find((player) => player.id === playerId) ?? {
      id: playerId,
      rank: fallbackRankByPlayerId[playerId],
      name: playerId.toUpperCase(),
      score: 0,
      coin: STARTING_COIN,
      stamina: STARTING_STAMINA,
      usedSlots: 0
    };
  }
  function getVisibleSidePlayersForOnline() {
    const selfPlayerId = onlineClientState.playerId;
    if (!selfPlayerId || !onlineClientState.roomState) {
      return [];
    }
    return playerIds.filter((playerId) => {
      if (playerId === selfPlayerId) return false;
      const onlinePlayer = onlineClientState.roomState?.players[playerId];
      return onlinePlayer?.isConnected === true;
    }).map((playerId) => {
      const staticPlayer = getStaticPlayerById(playerId);
      const onlinePlayer = onlineClientState.roomState?.players[playerId];
      return {
        ...staticPlayer,
        name: onlinePlayer?.name ?? staticPlayer.name,
        score: onlinePlayer?.score ?? staticPlayer.score,
        coin: onlinePlayer?.coin ?? staticPlayer.coin,
        stamina: onlinePlayer?.stamina ?? staticPlayer.stamina,
        usedSlots: onlinePlayer?.usedSlots ?? staticPlayer.usedSlots,
        active: false
      };
    });
  }
  function getLeftSidePlayersToRender() {
    if (isOnlineRoomActive()) {
      return getVisibleSidePlayersForOnline().slice(0, 2);
    }
    return getPlayersLeft();
  }
  function getRightSidePlayersToRender() {
    if (isOnlineRoomActive()) {
      return getVisibleSidePlayersForOnline().slice(2);
    }
    return [playersRight[0]];
  }
  function getMidGameRankings() {
    const state = onlineClientState.roomState;
    if (!state) return [];
    return playerIds.map((playerId) => {
      const player = state.players[playerId];
      return {
        playerId,
        name: player?.name ?? playerId.toUpperCase(),
        score: player?.score ?? 0,
        coin: player?.coin ?? STARTING_COIN,
        stamina: player?.stamina ?? STARTING_STAMINA,
        usedSlots: player?.usedSlots ?? 0,
        isConnected: player?.isConnected ?? false,
        hasJoined: player?.hasJoined ?? false
      };
    }).filter((player) => player.hasJoined || player.isConnected).sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.usedSlots !== a.usedSlots) return b.usedSlots - a.usedSlots;
      return a.playerId.localeCompare(b.playerId);
    });
  }
  function renderMidGameRankingModal() {
    if (!isMidGameRankingOpen || !isOnlineRoomActive()) {
      return "";
    }
    const rankings = getMidGameRankings();
    const selfPlayerId = onlineClientState.playerId;
    const phaseDayLabel = getCompactPhaseDayLabel();
    return `
    <div class="mid-ranking-backdrop" onclick="event.stopPropagation(); closeMidGameRanking()">
      <section class="mid-ranking-modal" onclick="event.stopPropagation()">
        <div class="mid-ranking-modal__header">
          <div>
            <span>B\u1EA2NG X\u1EBEP H\u1EA0NG GI\u1EEEA TR\u1EACN</span>
            <h2>${phaseDayLabel}</h2>
            <p>C\u1EADp nh\u1EADt sau m\u1ED7i ng\xE0y khi server c\u1ED9ng \u0111i\u1EC3m simulation xong.</p>
          </div>

          <button
            class="mid-ranking-modal__close"
            onclick="event.stopPropagation(); closeMidGameRanking()"
            title="\u0110\xF3ng b\u1EA3ng x\u1EBFp h\u1EA1ng"
          >
            \u2715
          </button>
        </div>

        <div class="mid-ranking-modal__list">
          ${rankings.length > 0 ? rankings.map((player, index) => {
      const isSelf = player.playerId === selfPlayerId;
      return `
                      <div class="mid-ranking-row ${isSelf ? "mid-ranking-row--self" : ""}">
                        <div class="mid-ranking-row__rank">#${index + 1}</div>

                        <div class="mid-ranking-row__player">
                          <strong>${player.name}</strong>
                          <span>${player.playerId}${player.isConnected ? "" : " \u2022 offline"}</span>
                        </div>

                        <div class="mid-ranking-row__score">${player.score} VP</div>

                        <div class="mid-ranking-row__meta">
                          <span>\u{1FA99} ${player.coin}</span>
                          <span>\u26A1 ${player.stamina}</span>
                          <span>${player.usedSlots}/25</span>
                        </div>
                      </div>
                    `;
    }).join("") : `<div class="mid-ranking-empty">Ch\u01B0a c\xF3 ng\u01B0\u1EDDi ch\u01A1i trong ph\xF2ng.</div>`}
        </div>

        <div class="mid-ranking-modal__footer">
          \u0110i\u1EC3m ch\u1EC9 thay \u0111\u1ED5i sau khi k\u1EBFt th\xFAc qu\xE9t \u0111i\u1EC3m t\u1EEBng ng\xE0y.
        </div>
      </section>
    </div>
  `;
  }
  function renderOnlineRoomMenu() {
    if (!isOnlineRoomActive() || onlineClientState.roomState?.phase === "lobby") {
      return "";
    }
    return `
    <div class="online-room-menu" onclick="event.stopPropagation()">
      <input id="online-room-menu-toggle" class="online-room-menu__toggle-input" type="checkbox" />

      <label
        class="online-room-menu__button"
        for="online-room-menu-toggle"
        title="M\u1EDF menu ph\xF2ng"
      >
        \u2630
      </label>

      <div class="online-room-menu__panel">
        <div class="online-room-menu__text">
          <strong>Menu ph\xF2ng</strong>
          <span>Room ${onlineClientState.roomId ?? "-"}</span>
        </div>

        <button
          class="online-room-menu__ranking"
          onclick="event.stopPropagation(); openMidGameRanking()"
          title="Xem b\u1EA3ng x\u1EBFp h\u1EA1ng gi\u1EEFa tr\u1EADn"
        >
          BXH
        </button>

        <div class="online-room-menu__export" title="Xu\u1EA5t ch\u1EE9ng nh\u1EADn h\xE0nh tr\xECnh">
          <span>Xu\u1EA5t</span>
          <button onclick="event.stopPropagation(); downloadTravelCertificateHtml()">Certificate</button>
        </div>

        <button
          class="online-room-menu__leave"
          onclick="event.stopPropagation(); leaveRoomFromLobby()"
          title="Tho\xE1t kh\u1ECFi ph\xF2ng online"
        >
          \u2715
        </button>
      </div>
    </div>
  `;
  }
  function renderSidePlayerSpacers(count) {
    return Array.from({ length: Math.max(0, count) }, () => {
      return `<section class="side-player side-player--empty-spacer" aria-hidden="true"></section>`;
    }).join("");
  }
  var currentAppScreen = "dashboard";
  var bgSmokeVideo = null;
  function transitionToScreen(newScreen) {
    if (!document.startViewTransition) {
      currentAppScreen = newScreen;
      rerenderGameShell();
      return;
    }
    document.startViewTransition(() => {
      currentAppScreen = newScreen;
      rerenderGameShell();
    });
  }
  window.gotoMapSelection = () => {
    if (!authClientState.user) {
      window.focusHubAuthPanel();
      setAuthStatus("\u0110\u0103ng nh\u1EADp ho\u1EB7c \u0111\u0103ng k\xFD \u0111\u1EC3 b\u1EAFt \u0111\u1EA7u h\xE0nh tr\xECnh.");
      return;
    }
    const vid = document.createElement("video");
    vid.src = "./assets/chuyencanh.mp4";
    vid.muted = true;
    vid.playsInline = true;
    vid.style.cssText = [
      "position:fixed",
      "inset:0",
      "width:100%",
      "height:100%",
      "object-fit:cover",
      "z-index:9999",
      "pointer-events:none",
      "opacity:0",
      "transition:opacity 0.4s ease"
    ].join(";");
    document.body.appendChild(vid);
    void vid.play().catch(() => {
      vid.muted = true;
      void vid.play();
    });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        vid.style.opacity = "1";
      });
    });
    let transitioned = false;
    vid.addEventListener("timeupdate", () => {
      if (!transitioned && vid.currentTime >= 3.5) {
        transitioned = true;
        bgSmokeVideo = vid;
        document.body.removeChild(vid);
        vid.style.cssText = [
          "position:absolute",
          "inset:0",
          "width:100%",
          "height:100%",
          "object-fit:cover",
          "z-index:0",
          "pointer-events:none",
          "opacity:1"
        ].join(";");
        currentAppScreen = "map_selection";
        rerenderGameShell();
        requestAnimationFrame(() => {
          const cols = document.querySelectorAll(".map-card-col");
          cols.forEach((el, i) => {
            setTimeout(() => el.classList.add("map-card-col--slide-in"), 200 + i * 140);
          });
        });
      }
      if (vid.duration && vid.currentTime >= vid.duration - 0.5) {
        vid.currentTime = 5;
      }
    });
  };
  window.gotoOnlineLobby = () => {
    if (!authClientState.user) {
      window.focusHubAuthPanel();
      setAuthStatus("\u0110\u0103ng nh\u1EADp ho\u1EB7c \u0111\u0103ng k\xFD \u0111\u1EC3 b\u1EAFt \u0111\u1EA7u h\xE0nh tr\xECnh.");
      return;
    }
    transitionToScreen("lobby");
  };
  window.gotoDashboard = () => {
    if (bgSmokeVideo) {
      bgSmokeVideo.pause();
      bgSmokeVideo.remove();
      bgSmokeVideo = null;
    }
    transitionToScreen("dashboard");
  };
  window.switchHubAuthTab = (tab) => {
    document.querySelectorAll("[data-hub-auth-tab]").forEach((element) => {
      element.classList.toggle(
        "is-active",
        element.dataset.hubAuthTab === tab
      );
    });
    document.querySelectorAll("[data-hub-auth-panel]").forEach((element) => {
      element.classList.toggle(
        "is-active",
        element.dataset.hubAuthPanel === tab
      );
    });
  };
  window.focusHubAuthPanel = () => {
    const authPanel = document.getElementById("hub-auth");
    if (!authPanel) {
      currentAppScreen = "dashboard";
      rerenderGameShell();
      window.requestAnimationFrame(() => {
        window.focusHubAuthPanel();
      });
      return;
    }
    authPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    authPanel.classList.remove("hub-auth--pulse");
    window.requestAnimationFrame(() => {
      authPanel.classList.add("hub-auth--pulse");
    });
    const firstInput = authPanel.querySelector("input");
    firstInput?.focus();
  };
  window.startOfflineGame = () => {
    alert("Ch\u1EBF \u0111\u1ED9 ch\u01A1i offline (Bot) \u0111ang \u0111\u01B0\u1EE3c ph\xE1t tri\u1EC3n!");
  };
  function renderGameShell() {
    if (!authClientState.isReady) {
      return renderDashboard(true);
    }
    if (!isOnlineRoomActive()) {
      if (!authClientState.user || currentAppScreen === "dashboard") {
        currentAppScreen = "dashboard";
        return renderDashboard();
      }
      if (currentAppScreen === "map_selection") {
        return renderMapSelectionScreen();
      }
      return renderOnlineEntryScreen();
    }
    if (onlineClientState.roomState?.phase === "lobby") {
      return renderOnlineLobbyRoomScreen();
    }
    const leftPlayers = getLeftSidePlayersToRender();
    const rightPlayers = getRightSidePlayersToRender();
    return `
    <div class="game-shell">
      ${renderOnlineRoomMenu()}
      ${renderMidGameRankingModal()}

      <aside class="players-column players-column--left">
        ${leftPlayers.map(renderPlayer).join("")}
        ${renderSidePlayerSpacers(2 - leftPlayers.length)}
      </aside>

      ${renderMainArena()}

      <aside class="players-column players-column--right">
        ${rightPlayers.map(renderPlayer).join("")}
        ${renderSidePlayerSpacers(1 - rightPlayers.length)}
        ${renderDeckPilePanel()}
      </aside>
    </div>
  `;
  }
  window.rerenderGameShell = rerenderGameShell;
  function rerenderGameShell() {
    app.innerHTML = renderGameShell();
    initDashboardHub();
    if (currentAppScreen === "map_selection" && bgSmokeVideo) {
      const screen = document.querySelector(".map-selection-screen");
      if (screen && screen.firstChild) {
        screen.insertBefore(bgSmokeVideo, screen.firstChild);
      }
    }
  }
  var lastOnlineRenderSignature = "";
  var lastOnlineAnimationPhase = null;
  var lastOnlineAnimationDraftRound = 0;
  var lastOnlineAnimationPoolSignature = "";
  var onlineDraftAnimationTimerId = null;
  var hasStartedOnlineSimulationReplay = false;
  var onlineDraftDisplayPool = null;
  var onlineDraftPendingPool = null;
  var shouldActivateOnlineDealAnimation = false;
  var shouldActivateOnlinePassAnimation = false;
  var isOnlineFinalDraftReturnAnimating = false;
  var onlineFinalDraftReturnTimerId = null;
  var hasPlayedOnlinePlanningDealAfterDraft = false;
  function clearOnlineDraftAnimationTimer() {
    if (onlineDraftAnimationTimerId !== null) {
      window.clearTimeout(onlineDraftAnimationTimerId);
      onlineDraftAnimationTimerId = null;
    }
    if (onlineFinalDraftReturnTimerId !== null) {
      window.clearTimeout(onlineFinalDraftReturnTimerId);
      onlineFinalDraftReturnTimerId = null;
    }
  }
  function getOnlineRenderSignature() {
    const state = onlineClientState.roomState;
    if (!state) return "offline";
    const self = state.self;
    const playersSignature = playerIds.map((playerId) => {
      const player = state.players[playerId];
      const boardSignature = player.board.map((row) => row.map((cell) => {
        if (!cell) return "-";
        return `${cell.cardId}:${cell.tag}:${cell.icon}:${cell.vp}`;
      }).join(",")).join("|");
      return [
        playerId,
        player.name,
        player.score,
        player.coin,
        player.stamina,
        player.usedSlots,
        player.isConnected ? "1" : "0",
        player.isReady ? "1" : "0",
        boardSignature
      ].join("~");
    }).join("||");
    return [
      state.phase,
      state.phaseNumber ?? 1,
      state.dayIndex,
      state.draftRound,
      self.draftPool.map((card) => card.id).join(","),
      self.pickedDraftCards.map((card) => card.id).join(","),
      self.hand.map((card) => card.id).join(","),
      playersSignature
    ].join("##");
  }
  function updateOnlineTimerOnly() {
    const state = onlineClientState.roomState;
    const timerElement = document.querySelector(".score-breakdown__timer");
    const timerValueElement = timerElement?.querySelector("strong");
    if (!state || !timerElement || !timerValueElement) return;
    if (state.phase === "draft") {
      timerValueElement.textContent = `${state.timer}s`;
      timerElement.classList.toggle("score-breakdown__timer--danger", state.timer <= 3);
      return;
    }
    if (state.phase === "planning") {
      timerValueElement.textContent = formatTurnTimer(state.timer);
      timerElement.classList.toggle("score-breakdown__timer--danger", state.timer <= 10);
      return;
    }
    if (state.phase === "gameover") {
      timerValueElement.textContent = `${state.timer}s`;
      timerElement.classList.toggle("score-breakdown__timer--danger", state.timer <= 3);
    }
  }
  function renderAfterOnlineStateChange() {
    const nextSignature = getOnlineRenderSignature();
    if (nextSignature !== lastOnlineRenderSignature) {
      lastOnlineRenderSignature = nextSignature;
      rerenderGameShell();
      if (shouldActivateOnlineDealAnimation) {
        shouldActivateOnlineDealAnimation = false;
        activateDraftDealAnimation();
        window.setTimeout(() => {
          ensureOnlineDraftDealAnimationStarted();
        }, 80);
      }
      if (shouldActivateOnlinePassAnimation) {
        shouldActivateOnlinePassAnimation = false;
        activateDraftPassAnimation();
      }
      return;
    }
    updateOnlineTimerOnly();
  }
  rerenderGameShell();
  lastOnlineRenderSignature = getOnlineRenderSignature();
  function setupCardClickDelegation() {
    let holdStartX = 0;
    let holdStartY = 0;
    let holdCardId = null;
    let holdMode = null;
    let didOpenHoldPreview = false;
    let skipNextDraftClick = false;
    function clearDelegatedHold() {
      clearHoldTimer();
      holdCardId = null;
      holdMode = null;
      didOpenHoldPreview = false;
    }
    document.addEventListener("pointerdown", (event) => {
      const target = event.target;
      if (!target) return;
      const draftCardElement = target.closest("[data-draft-card-id]");
      const handCardElement = target.closest("[data-hand-card-id]");
      let nextCardId = null;
      let nextMode = null;
      if (isDraftPhase && draftCardElement) {
        nextCardId = draftCardElement.dataset.draftCardId ?? null;
        nextMode = "draft";
      } else if (!isDraftPhase && !isSimulationMode && handCardElement) {
        nextCardId = handCardElement.dataset.handCardId ?? null;
        nextMode = "hand";
      }
      if (!nextCardId || !nextMode) return;
      holdCardId = nextCardId;
      holdMode = nextMode;
      didOpenHoldPreview = false;
      holdStartX = event.clientX;
      holdStartY = event.clientY;
      clearHoldTimer();
      if (nextMode === "draft" && !isPassingDraftCards) {
        skipNextDraftClick = true;
        selectDraftCard(nextCardId);
      }
      holdTimer = window.setTimeout(() => {
        if (!holdCardId) return;
        didOpenHoldPreview = true;
        focusedHandCardId = holdCardId;
        focusedBoardCard = null;
        focusedBoardPosition = null;
        suppressNextClick = true;
        rerenderGameShell();
      }, 500);
    }, true);
    document.addEventListener("pointermove", (event) => {
      if (!holdCardId || holdTimer === null) return;
      const distance = Math.hypot(
        event.clientX - holdStartX,
        event.clientY - holdStartY
      );
      if (distance > 8) {
        clearDelegatedHold();
      }
    }, true);
    document.addEventListener("pointerup", (event) => {
      const cardId = holdCardId;
      const mode = holdMode;
      const openedPreview = didOpenHoldPreview;
      const distance = Math.hypot(
        event.clientX - holdStartX,
        event.clientY - holdStartY
      );
      clearDelegatedHold();
      if (mode === "draft" && cardId && !openedPreview && distance <= 8 && isDraftPhase) {
        event.preventDefault();
        event.stopPropagation();
      }
    }, true);
    document.addEventListener("pointercancel", () => {
      clearDelegatedHold();
    }, true);
    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!target) return;
      const draftCardElement = target.closest("[data-draft-card-id]");
      if (draftCardElement && isDraftPhase) {
        event.preventDefault();
        event.stopPropagation();
        if (skipNextDraftClick) {
          skipNextDraftClick = false;
          return;
        }
        const cardId = draftCardElement.dataset.draftCardId;
        if (cardId) {
          selectDraftCard(cardId);
        }
        return;
      }
      const handCardElement = target.closest("[data-hand-card-id]");
      if (handCardElement && !isDraftPhase) {
        event.preventDefault();
        event.stopPropagation();
        const cardId = handCardElement.dataset.handCardId;
        if (cardId) {
          selectHandCard(cardId);
        }
      }
    }, true);
  }
  setupCardClickDelegation();
  setupAuthFormDelegation();
  setupGameAudioDelegation();
  initOnlineClient(() => {
    applyOnlineRoomStateToLocal();
    renderAfterOnlineStateChange();
  });
  window.createOnlineRoom = (playerName = "An") => {
    createOnlineRoom(playerName);
  };
  window.joinOnlineRoom = (roomId, playerName = "Player") => {
    joinOnlineRoom(roomId, playerName);
  };
  window.startOnlineGame = () => {
    startOnlineGame();
  };
  window.selectDraftCard = selectDraftCard;
  window.selectHandCard = selectHandCard;
  window.clearSelectedHandCard = clearSelectedHandCard;
  function setAuthStatus(message, isError = false) {
    const statusElement = document.querySelector("#hub-auth-status") ?? document.querySelector("#auth-status");
    if (!statusElement) return;
    statusElement.textContent = message;
    statusElement.classList.toggle("hub-auth__status--error", isError);
    statusElement.classList.toggle("hub-auth__status--success", Boolean(message) && !isError);
    statusElement.classList.toggle("auth-card__status--error", isError);
    statusElement.classList.toggle("auth-card__status--success", Boolean(message) && !isError);
  }
  function setupAuthFormDelegation() {
    document.addEventListener("submit", (event) => {
      const form = event.target;
      if (!form) return;
      if (form.id === "auth-login-form" || form.id === "hub-auth-login-form") {
        event.preventDefault();
        event.stopPropagation();
        window.loginFromAuthScreen();
        return;
      }
      if (form.id === "auth-register-form" || form.id === "hub-auth-register-form") {
        event.preventDefault();
        event.stopPropagation();
        window.registerFromAuthScreen();
      }
    }, true);
  }
  window.loginFromAuthScreen = async () => {
    const usernameInput = document.querySelector("#hub-auth-login-username") ?? document.querySelector("#auth-login-username");
    const passwordInput = document.querySelector("#hub-auth-login-password") ?? document.querySelector("#auth-login-password");
    setAuthStatus("\u0110ang \u0111\u0103ng nh\u1EADp...");
    try {
      await loginAccount({
        username: usernameInput?.value.trim() ?? "",
        password: passwordInput?.value ?? ""
      });
      setAuthStatus("\u0110\u0103ng nh\u1EADp th\xE0nh c\xF4ng.");
      rerenderGameShell();
    } catch (error) {
      const message = error instanceof Error ? error.message : "\u0110\u0103ng nh\u1EADp th\u1EA5t b\u1EA1i.";
      setAuthStatus(message, true);
      alert(message);
    }
  };
  window.registerFromAuthScreen = async () => {
    const displayNameInput = document.querySelector("#hub-auth-register-display-name") ?? document.querySelector("#auth-register-display-name");
    const usernameInput = document.querySelector("#hub-auth-register-username") ?? document.querySelector("#auth-register-username");
    const passwordInput = document.querySelector("#hub-auth-register-password") ?? document.querySelector("#auth-register-password");
    setAuthStatus("\u0110ang t\u1EA1o t\xE0i kho\u1EA3n...");
    try {
      await registerAccount({
        displayName: displayNameInput?.value.trim() || void 0,
        username: usernameInput?.value.trim() ?? "",
        password: passwordInput?.value ?? ""
      });
      setAuthStatus("T\u1EA1o t\xE0i kho\u1EA3n th\xE0nh c\xF4ng.");
      rerenderGameShell();
    } catch (error) {
      const message = error instanceof Error ? error.message : "\u0110\u0103ng k\xFD th\u1EA5t b\u1EA1i.";
      setAuthStatus(message, true);
      alert(message);
    }
  };
  window.logoutFromAuthScreen = () => {
    logoutAccount();
    onlineClientState.roomId = null;
    onlineClientState.playerId = null;
    onlineClientState.roomState = null;
    currentAppScreen = "dashboard";
    rerenderGameShell();
  };
  window.createRoomFromLobby = () => {
    const input = document.querySelector("#lobby-create-name");
    const playerName = input?.value.trim() || authClientState.user?.displayName || authClientState.user?.username || "An";
    createOnlineRoom(playerName);
  };
  window.joinRoomFromLobby = () => {
    const nameInput = document.querySelector("#lobby-join-name");
    const roomInput = document.querySelector("#lobby-room-code");
    const playerName = nameInput?.value.trim() || "Player";
    const roomId = roomInput?.value.trim().toUpperCase();
    if (!roomId) {
      alert("Nh\u1EADp room code tr\u01B0\u1EDBc.");
      return;
    }
    joinOnlineRoom(roomId, playerName);
  };
  window.reconnectSavedRoomFromLobby = () => {
    const savedSession = getSavedOnlineSession();
    if (!savedSession) return;
    reconnectOnlineRoom(savedSession.roomId, savedSession.playerId, savedSession.playerName);
  };
  window.clearSavedRoomFromLobby = () => {
    clearSavedOnlineSession();
    rerenderGameShell();
  };
  window.toggleReadyFromLobby = () => {
    const selfPlayer = getOnlineSelfPublicPlayer();
    if (!selfPlayer || !onlineClientState.playerId || !onlineClientState.roomState) return;
    const nextReadyState = !selfPlayer.isReady;
    onlineClientState.roomState.players[onlineClientState.playerId].isReady = nextReadyState;
    rerenderGameShell();
    setOnlineReady(nextReadyState);
  };
  window.leaveRoomFromLobby = () => {
    leaveOnlineRoom();
    rerenderGameShell();
  };
  window.copyRoomCodeFromLobby = async () => {
    const roomId = onlineClientState.roomId;
    if (!roomId) return;
    try {
      await navigator.clipboard.writeText(roomId);
      alert(`\u0110\xE3 copy room code: ${roomId}`);
    } catch {
      prompt("Copy room code:", roomId);
    }
  };
  window.openMidGameRanking = () => {
    isMidGameRankingOpen = true;
    rerenderGameShell();
  };
  window.closeMidGameRanking = () => {
    isMidGameRankingOpen = false;
    rerenderGameShell();
  };
  window.downloadTravelCertificateHtml = () => {
    downloadTravelCertificateHtml();
  };
  window.downloadTravelTimelineTxt = () => {
    downloadTravelTimeline("txt");
  };
  window.downloadTravelTimelineJson = () => {
    downloadTravelTimeline("json");
  };
  window.copyTravelTimeline = () => {
    copyTravelTimelineToClipboard();
  };
  window.debugOnlineBoards = () => {
    const state = onlineClientState.roomState;
    if (!state) {
      console.log("No online room state.");
      return null;
    }
    const result = {};
    const playerIds2 = ["p1", "p2", "p3", "p4"];
    for (const playerId of playerIds2) {
      const player = state.players[playerId];
      const filledCells = [];
      for (let rowIndex = 0; rowIndex < player.board.length; rowIndex += 1) {
        const row = player.board[rowIndex];
        for (let colIndex = 0; colIndex < row.length; colIndex += 1) {
          const cell = row[colIndex];
          if (!cell) continue;
          filledCells.push({
            rowIndex,
            colIndex,
            cardId: cell.cardId,
            tag: cell.tag,
            icon: cell.icon,
            vp: cell.vp
          });
        }
      }
      result[playerId] = {
        name: player.name,
        connected: player.isConnected,
        usedSlots: player.usedSlots,
        filledCells
      };
    }
    console.table(
      playerIds2.map((playerId) => ({
        playerId,
        name: result[playerId].name,
        connected: result[playerId].connected,
        usedSlots: result[playerId].usedSlots,
        filled: result[playerId].filledCells.length
      }))
    );
    console.log(result);
    return result;
  };
  window.onlineClientState = onlineClientState;
  window.debugOnlineScores = () => {
    const state = onlineClientState.roomState;
    if (!state) {
      console.log("No online room state.");
      return null;
    }
    const result = playerIds.map((playerId) => {
      const player = state.players[playerId];
      return {
        playerId,
        name: player.name,
        score: player.score,
        coin: player.coin,
        stamina: player.stamina,
        usedSlots: player.usedSlots,
        connected: player.isConnected,
        ready: player.isReady,
        joined: player.hasJoined
      };
    });
    console.table(result);
    return result;
  };
  globalThis.createOnlineRoom = window.createOnlineRoom;
  globalThis.joinOnlineRoom = window.joinOnlineRoom;
  globalThis.startOnlineGame = window.startOnlineGame;
  globalThis.selectDraftCard = window.selectDraftCard;
  globalThis.selectHandCard = window.selectHandCard;
  globalThis.clearSelectedHandCard = window.clearSelectedHandCard;
  globalThis.loginFromAuthScreen = window.loginFromAuthScreen;
  globalThis.registerFromAuthScreen = window.registerFromAuthScreen;
  globalThis.logoutFromAuthScreen = window.logoutFromAuthScreen;
  globalThis.forceLogoutAuth = window.logoutFromAuthScreen;
  globalThis.createRoomFromLobby = window.createRoomFromLobby;
  globalThis.joinRoomFromLobby = window.joinRoomFromLobby;
  globalThis.reconnectSavedRoomFromLobby = window.reconnectSavedRoomFromLobby;
  globalThis.clearSavedRoomFromLobby = window.clearSavedRoomFromLobby;
  globalThis.toggleReadyFromLobby = window.toggleReadyFromLobby;
  globalThis.copyRoomCodeFromLobby = window.copyRoomCodeFromLobby;
  globalThis.leaveRoomFromLobby = window.leaveRoomFromLobby;
  globalThis.onlineClientState = onlineClientState;
  globalThis.openMidGameRanking = window.openMidGameRanking;
  globalThis.closeMidGameRanking = window.closeMidGameRanking;
  globalThis.downloadTravelCertificateHtml = window.downloadTravelCertificateHtml;
  globalThis.downloadTravelTimelineTxt = window.downloadTravelTimelineTxt;
  globalThis.downloadTravelTimelineJson = window.downloadTravelTimelineJson;
  globalThis.copyTravelTimeline = window.copyTravelTimeline;
  globalThis.playGameSound = playGameSound;
  globalThis.debugOnlineBoards = window.debugOnlineBoards;
  globalThis.selectDraftCard = window.selectDraftCard;
  rerenderGameShell();
})();
