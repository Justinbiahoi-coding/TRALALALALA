import re

with open("src/export/certificate.ts", "r") as f:
    content = f.read()

# Replace import of onlineClientState from app.js to socketClient.js
content = content.replace(
    'onlineClientState,\n  currentPlayerId',
    'currentPlayerId'
)
# And add import for onlineClientState
content = 'import { onlineClientState } from "../online/socketClient.js";\n' + content

with open("src/export/certificate.ts", "w") as f:
    f.write(content)

