import re

with open("src/app.ts", "r") as f:
    content = f.read()

replacement = """export let currentAppScreen: AppScreen = "dashboard";

let smokeVideo: HTMLVideoElement | null = null;

function transitionToScreen(newScreen: AppScreen) {
  if (!(document as any).startViewTransition) {
    currentAppScreen = newScreen;
    (window as any).rerenderGameShell();
    return;
  }

  (document as any).startViewTransition(() => {
    currentAppScreen = newScreen;
    (window as any).rerenderGameShell();
  });
}

(window as any).gotoMapSelection = () => {
  if (!authClientState.user) {
    (window as any).focusHubAuthPanel();
    setAuthStatus("Đăng nhập hoặc đăng ký để bắt đầu hành trình.");
    return;
  }
  
  // Create smoke video transition
  smokeVideo = document.createElement("video");
  smokeVideo.src = "./assets/chuyencanh.mp4";
  smokeVideo.autoplay = true;
  smokeVideo.muted = true;
  smokeVideo.playsInline = true;
  smokeVideo.loop = true;
  smokeVideo.style.position = "fixed";
  smokeVideo.style.inset = "0";
  smokeVideo.style.width = "100%";
  smokeVideo.style.height = "100%";
  smokeVideo.style.objectFit = "cover";
  smokeVideo.style.zIndex = "9999";
  smokeVideo.style.opacity = "0";
  smokeVideo.style.transition = "opacity 0.8s ease";
  smokeVideo.style.pointerEvents = "none";
  
  document.body.appendChild(smokeVideo);
  
  // Fade in the video
  requestAnimationFrame(() => {
    if (smokeVideo) smokeVideo.style.opacity = "1";
  });
  
  let transitioned = false;
  
  smokeVideo.addEventListener("timeupdate", () => {
    if (smokeVideo && smokeVideo.currentTime > 1.5 && !transitioned) {
      transitioned = true;
      currentAppScreen = "map_selection";
      (window as any).rerenderGameShell();
      smokeVideo.style.zIndex = "-1";
    }
  });

  setTimeout(() => {
    if (!transitioned) {
      transitioned = true;
      currentAppScreen = "map_selection";
      (window as any).rerenderGameShell();
      if (smokeVideo) smokeVideo.style.zIndex = "-1";
    }
  }, 2000);
};

(window as any).gotoOnlineLobby = () => {
  if (!authClientState.user) {
    (window as any).focusHubAuthPanel();
    setAuthStatus("Đăng nhập hoặc đăng ký để bắt đầu hành trình.");
    return;
  }
  transitionToScreen("lobby");
};

(window as any).gotoDashboard = () => {
  if (smokeVideo) {
    smokeVideo.style.opacity = "0";
    setTimeout(() => {
      smokeVideo?.remove();
      smokeVideo = null;
    }, 800);
  }
  transitionToScreen("dashboard");
};"""

pattern = r'export let currentAppScreen: AppScreen = "dashboard";.*?\(window as any\)\.gotoDashboard = \(\) => \{.*?\};'
new_content = re.sub(pattern, replacement, content, flags=re.DOTALL)

with open("src/app.ts", "w") as f:
    f.write(new_content)

print("Updated app.ts")
