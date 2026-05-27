import re

with open("src/app.ts", "r") as f:
    app_content = f.read()

# 1. Import GameSoundName in app.ts
app_content = app_content.replace(
    'import {\n  playGameSound,',
    'import {\n  GameSoundName,\n  playGameSound,'
)

# 2. Add copyTravelTimelineToClipboard to imports from certificate.js
app_content = app_content.replace(
    'downloadTravelTimeline\n} from "./export/certificate.js";',
    'downloadTravelTimeline,\n  copyTravelTimelineToClipboard\n} from "./export/certificate.js";'
)

# 3. Export variables from app.ts
exports = [
    'getBoardSlots', 'getCurrentScoreBreakdown', 'getRemainingResources', 
    'getDisplayPlayerName', 'isOnlineRoomActive', 'phaseNumber', 
    'currentDayIndex', 'simulationResult', 'accumulatedVP', 
    'onlineClientState', 'currentPlayerId'
]
for exp in exports:
    # Handle function definitions
    app_content = re.sub(rf'^function {exp}\(', f'export function {exp}(', app_content, flags=re.MULTILINE)
    # Handle let declarations
    app_content = re.sub(rf'^let {exp} ', f'export let {exp} ', app_content, flags=re.MULTILINE)
    # Handle const declarations
    app_content = re.sub(rf'^const {exp} ', f'export const {exp} ', app_content, flags=re.MULTILINE)

# 4. Move CERTIFICATE_HISTORY_STORAGE_KEY and types to certificate.ts
start_marker = 'const CERTIFICATE_HISTORY_STORAGE_KEY = "travel_board_certificate_history";'
end_marker = 'const playersLeftBase: Player[] = ['

start_idx = app_content.find(start_marker)
end_idx = app_content.find(end_marker)

if start_idx != -1 and end_idx != -1:
    cert_types = app_content[start_idx:end_idx]
    app_content = app_content[:start_idx] + app_content[end_idx:]
    
    with open("src/export/certificate.ts", "r") as f:
        cert_content = f.read()
    
    # insert after imports
    import_end = cert_content.find('\n\n')
    if import_end != -1:
        cert_content = cert_content[:import_end+2] + cert_types + cert_content[import_end+2:]
    else:
        cert_content = cert_types + "\n" + cert_content
        
    with open("src/export/certificate.ts", "w") as f:
        f.write(cert_content)

with open("src/app.ts", "w") as f:
    f.write(app_content)

print("TS fixes applied")
