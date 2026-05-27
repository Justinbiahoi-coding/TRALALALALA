import re

with open("src/app.ts", "r") as f:
    content = f.read()

replacement = """export let currentAppScreen: AppScreen = "dashboard";

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
  transitionToScreen("map_selection");
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
  transitionToScreen("dashboard");
};"""

pattern = r'export let currentAppScreen: AppScreen = "dashboard";.*?\(window as any\)\.gotoDashboard = \(\) => \{.*?\};'
new_content = re.sub(pattern, replacement, content, flags=re.DOTALL)

with open("src/app.ts", "w") as f:
    f.write(new_content)

print("Reverted app.ts")

# Now revert mapSelection.less
with open("src/styles/mapSelection.less", "r") as f:
    less_content = f.read()
    
less_content = less_content.replace('background: rgba(15, 10, 6, 0.4); /* Dark transparent overlay to let video show through */', 'background: linear-gradient(135deg, #1f1814 0%, #3e2e22 100%);')

with open("src/styles/mapSelection.less", "w") as f:
    f.write(less_content)

print("Reverted mapSelection.less")
