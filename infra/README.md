# Infrastructure
Root vercel.json is the authoritative web config. Static web and optional encrypted image relay are separate deployables. Local release checks never deploy. The manual deployment workflows require operator-managed production environments and secrets. See docs/deployment.md, headers.md and relay-deployment.md. No provider IDs or credentials are bundled.
