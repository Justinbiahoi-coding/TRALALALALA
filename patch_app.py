import re

with open("src/app.ts", "r") as f:
    content = f.read()

# 1. Add import
if 'renderDashboard' not in content:
    content = 'import { renderDashboard } from "./ui/dashboard.js";\n' + content

# 2. Add currentAppScreen
if 'currentAppScreen' not in content:
    screen_code = """
export type AppScreen = "dashboard" | "lobby" | "game";
export let currentAppScreen: AppScreen = "dashboard";

(window as any).gotoOnlineLobby = () => {
  currentAppScreen = "lobby";
  (window as any).rerenderGameShell();
};

(window as any).startOfflineGame = () => {
  alert("Chế độ chơi offline (Bot) đang được phát triển!");
};
"""
    content = content.replace('function renderGameShell() {', screen_code + '\nfunction renderGameShell() {')

# 3. Update renderGameShell
# In renderGameShell, replace:
#   if (!isOnlineRoomActive()) {
#     return renderOnlineEntryScreen();
#   }
# With:
#   if (!isOnlineRoomActive()) {
#     if (currentAppScreen === "dashboard") return renderDashboard();
#     return renderOnlineEntryScreen();
#   }
old_check = """  if (!isOnlineRoomActive()) {
    return renderOnlineEntryScreen();
  }"""

new_check = """  if (!isOnlineRoomActive()) {
    if (currentAppScreen === "dashboard") {
      return renderDashboard();
    }
    return renderOnlineEntryScreen();
  }"""

content = content.replace(old_check, new_check)

# also expose rerenderGameShell
if '(window as any).rerenderGameShell = rerenderGameShell;' not in content:
    content = content.replace('function rerenderGameShell() {', '(window as any).rerenderGameShell = rerenderGameShell;\nfunction rerenderGameShell() {')

with open("src/app.ts", "w") as f:
    f.write(content)

