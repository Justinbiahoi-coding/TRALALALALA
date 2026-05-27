import re

with open("src/app.ts", "r") as f:
    app_content = f.read()

# Fix let declarations with type annotations
app_content = re.sub(r'^let (simulationResult): ', r'export let \1: ', app_content, flags=re.MULTILINE)

# Fix const/let declarations that might have types or be spread across lines
app_content = re.sub(r'^const (onlineClientState)\b', r'export const \1', app_content, flags=re.MULTILINE)
app_content = re.sub(r'^const (currentPlayerId)\b', r'export const \1', app_content, flags=re.MULTILINE)

with open("src/app.ts", "w") as f:
    f.write(app_content)

with open("src/export/certificate.ts", "r") as f:
    cert_content = f.read()

# Fix async function export
cert_content = re.sub(r'^async function (copyTravelTimelineToClipboard)\(', r'export async function \1(', cert_content, flags=re.MULTILINE)

with open("src/export/certificate.ts", "w") as f:
    f.write(cert_content)

