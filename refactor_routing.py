import re

with open("src/app.ts", "r") as f:
    content = f.read()

# 1. Add import
if 'renderMapSelectionScreen' not in content:
    content = 'import { renderMapSelectionScreen } from "./ui/mapSelection.js";\n' + content

# 2. Update AppScreen type
content = content.replace(
    'export type AppScreen = "dashboard" | "lobby" | "game";',
    'export type AppScreen = "dashboard" | "map_selection" | "lobby" | "game";'
)

# 3. Add gotoMapSelection
goto_map_code = """
(window as any).gotoMapSelection = () => {
  if (!authClientState.user) {
    (window as any).focusHubAuthPanel();
    setAuthStatus("Đăng nhập hoặc đăng ký để bắt đầu hành trình.");
    return;
  }
  currentAppScreen = "map_selection";
  (window as any).rerenderGameShell();
};
"""
if 'gotoMapSelection' not in content:
    content = content.replace(
        '(window as any).gotoOnlineLobby = () => {',
        goto_map_code + '\n(window as any).gotoOnlineLobby = () => {'
    )

# 4. Update renderGameShell
old_check = """  if (!isOnlineRoomActive()) {
    if (!authClientState.user || currentAppScreen === "dashboard") {
      currentAppScreen = "dashboard";
      return renderDashboard();
    }

    return renderOnlineEntryScreen();
  }"""

new_check = """  if (!isOnlineRoomActive()) {
    if (!authClientState.user || currentAppScreen === "dashboard") {
      currentAppScreen = "dashboard";
      return renderDashboard();
    }
    
    if (currentAppScreen === "map_selection") {
      return renderMapSelectionScreen();
    }

    return renderOnlineEntryScreen();
  }"""
content = content.replace(old_check, new_check)

with open("src/app.ts", "w") as f:
    f.write(content)

print("app.ts updated!")
