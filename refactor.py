import re

with open("src/app.ts", "r") as f:
    content = f.read()

# Find boundaries
start_marker = "function getExportFileSafeName(value: string) {"
end_marker = "function renderTravelTimelineExportPanel"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print("Could not find markers")
    exit(1)

export_block = content[start_idx:end_idx]

# Add export keyword to top-level functions
export_block = re.sub(r'^function ', 'export function ', export_block, flags=re.MULTILINE)

# Prepend imports needed by certificate.ts (best guess based on usage)
imports = """import type { TravelCardData } from "../types.js";
import { days, rows } from "../game/constants.js";
// You may need to import state getters from app.ts or inject them
import { 
  getBoardSlots, 
  getCurrentScoreBreakdown, 
  getRemainingResources, 
  getDisplayPlayerName,
  isOnlineRoomActive,
  phaseNumber,
  currentDayIndex,
  simulationResult,
  accumulatedVP,
  onlineClientState,
  currentPlayerId
} from "../app.js";
"""

import os
os.makedirs("src/export", exist_ok=True)
with open("src/export/certificate.ts", "w") as f:
    f.write(imports + "\n" + export_block)

# Replace in app.ts
new_content = content[:start_idx] + """
import {
  getExportFileSafeName,
  buildTravelTimelineExport,
  getCertificateHistoryStorageKey,
  loadCertificateHistory,
  saveCertificateHistory,
  getPhaseStyleLabel,
  createCertificatePhaseSnapshot,
  rememberCurrentCertificatePhase,
  getCertificateExportData,
  buildTravelCertificateHtml,
  downloadTravelCertificateHtml,
  formatTravelTimelineAsText,
  downloadTextFile,
  downloadTravelTimeline
} from "./export/certificate.js";

""" + content[end_idx:]

with open("src/app.ts", "w") as f:
    f.write(new_content)

print("Refactored successfully!")
